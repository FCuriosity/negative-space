import AppKit
import WebKit
import JavaScriptCore
import SQLite3
import CoreGraphics
import UniformTypeIdentifiers

func milliseconds() -> Double { Date().timeIntervalSince1970 * 1000 }
func monotonicMilliseconds() -> Double { ProcessInfo.processInfo.systemUptime * 1000 }
func jsonText(_ value: Any) throws -> String { String(data: try JSONSerialization.data(withJSONObject:value,options:[.fragmentsAllowed,.sortedKeys]),encoding:.utf8)! }
func decode(_ text: String) throws -> Any { try JSONSerialization.jsonObject(with:Data(text.utf8),options:[.fragmentsAllowed]) }
struct LocalError: Error, LocalizedError { let message: String; var errorDescription: String? { message } }

final class Store {
    private var db: OpaquePointer?
    init(path: String) throws {
        guard sqlite3_open(path,&db) == SQLITE_OK else { throw LocalError(message:"无法打开本地数据库") }
        let sql="PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS native_state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);"
        guard sqlite3_exec(db,sql,nil,nil,nil) == SQLITE_OK else { throw LocalError(message:"无法初始化本地数据库") }
    }
    deinit { sqlite3_close(db) }
    func load() throws -> String? {
        var stmt: OpaquePointer?; defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db,"SELECT json FROM native_state WHERE id=1",-1,&stmt,nil) == SQLITE_OK else { throw LocalError(message:"读取本地数据失败") }
        let status=sqlite3_step(stmt)
        if status == SQLITE_DONE { return nil }
        guard status == SQLITE_ROW,let bytes=sqlite3_column_text(stmt,0) else { throw LocalError(message:"本地数据无法读取，原始文件未被覆盖") }
        return String(cString:bytes)
    }
    func save(_ json: String) throws {
        var stmt: OpaquePointer?; defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(db,"INSERT INTO native_state(id,json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json",-1,&stmt,nil) == SQLITE_OK else { throw LocalError(message:"无法准备本地保存") }
        sqlite3_bind_text(stmt,1,json,-1,unsafeBitCast(-1,to:sqlite3_destructor_type.self))
        guard sqlite3_step(stmt) == SQLITE_DONE else { throw LocalError(message:"保存失败，系统拦截已暂停") }
    }
}

final class Engine {
    let context: JSContext
    private let root: JSValue
    private var lastError: String?
    init(script: URL, raw: String?) throws {
        context=JSContext()!
        context.evaluateScript("var structuredClone = function(value) { return JSON.parse(JSON.stringify(value)); };")
        context.evaluateScript(try String(contentsOf:script,encoding:.utf8))
        guard let root=context.objectForKeyedSubscript("LiubaiRuntime"),!root.isUndefined else { throw LocalError(message:"规则引擎加载失败") }
        self.root=root
        context.exceptionHandler={ [weak self] _,value in self?.lastError=value?.toString() }
        _ = try call("initialize",[raw as Any? ?? NSNull()])
    }
    func call(_ method: String,_ arguments: [Any]=[]) throws -> String {
        lastError=nil
        let result=root.invokeMethod(method,withArguments:arguments)
        if let error=lastError { throw LocalError(message:error) }
        return result?.toString() ?? "null"
    }
}

func menuBarIcon() -> NSImage {
    let image=NSImage(size:NSSize(width:18,height:18),flipped:true) { _ in
        let path=NSBezierPath()
        let outline:[(CGFloat,CGFloat)]=[(644,204),(220,204),(220,780),(804,780),(804,338),(736,338),(736,712),(288,712),(288,272),(644,272)]
        let points=outline.map { point in NSPoint(x:2+(point.0-220)*14/584,y:2+(point.1-204)*14/576) }
        path.move(to:points[0]); for point in points.dropFirst() { path.line(to:point) }
        path.close(); NSColor.black.setFill(); path.fill()
        return true
    }
    image.isTemplate=true
    return image
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var engine: Engine!
    var store: Store!
    var timer: Timer?
    var statusItem: NSStatusItem!
    var statusDescription: NSMenuItem!
    var isSampling=false
    var locked=false
    var ready=false
    var lastState=""
    var lastDisk=""
    var lastError=""
    let browserBridge=BrowserBridge()
    var browserHealth=BrowserConnectionHealth()
    var browserError=""
    var installed: [[String:Any]]=[]
    var observers: [NSObjectProtocol]=[]
    let resource=Bundle.main.resourceURL!

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            if let other=NSRunningApplication.runningApplications(withBundleIdentifier:Bundle.main.bundleIdentifier ?? "local.liubai.native").first(where: { $0.processIdentifier != ProcessInfo.processInfo.processIdentifier }) {
                other.activate(options:[.activateAllWindows]); NSApp.terminate(nil); return
            }
            let directory=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("留白",isDirectory:true)
            try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
            store=try Store(path:directory.appendingPathComponent("native.sqlite3").path)
            engine=try Engine(script:resource.appendingPathComponent("runtime.js"),raw:try store.load())
            try browserBridge.start { [weak self] request in
                guard let self else {return ["error":"留白已退出"]}
                do {
                    guard let host=request["host"] as? String,host.count<254,host.range(of:"^[a-z0-9.-]*$",options:.regularExpression) != nil,let visit=request["visit"] as? String,visit.count<100 else{throw LocalError(message:"网页消息格式无效")}
                    let front=NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""
                    let expected=request["browser"] as? String == "edge" ? "com.microsoft.edgemac" : "com.google.Chrome"
                    guard let browser=request["browser"] as? String,["chrome","edge"].contains(browser) else {throw LocalError(message:"浏览器标识无效")}
                    self.browserHealth.receive(browser:browser,wallTime:milliseconds(),monotonicTime:monotonicMilliseconds())
                    try self.publish()
                    // Heartbeats only refresh connectivity, never visits, usage or break state.
                    if request["operation"] as? String == "heartbeat" {
                        return ["connected":true,"enabled":(try decode(self.engine.call("status")) as? [String:Any])?["enabled"] ?? false]
                    }
                    guard expected==front,request["active"] as? Bool == true else {return ["inactive":true,"enabled":(try decode(self.engine.call("status")) as? [String:Any])?["enabled"] ?? false]}
                    let active=true
                    let result=try self.engine.call("observeWebsite",[["host":host,"visit":visit,"active":active,"at":milliseconds(),"monotonicMs":monotonicMilliseconds(),"idleSeconds":CGEventSource.secondsSinceLastEventType(.combinedSessionState,eventType:CGEventType(rawValue:UInt32.max)!),"locked":self.locked]])
                    if request["operation"] as? String == "allow",let reply=try decode(result) as? [String:Any],let target=reply["targetId"] as? String {
                        _ = try self.engine.call("allowWebsite",[target,milliseconds(),monotonicMilliseconds(),request["typed"] as? String ?? "",request["reason"] as? String ?? ""])
                    }
                    try self.persist();try self.publish()
                    return try decode(result) as? [String:Any] ?? [:]
                }catch{return ["error":error.localizedDescription]}
            }
            installed=installedApps()
            setupWindow(); setupMenu(); setupObservers()
            timer=Timer(timeInterval:1,repeats:true) { [weak self] _ in self?.sample() }
            RunLoop.main.add(timer!,forMode:.common)
            sample()
        } catch { alert(error.localizedDescription); NSApp.terminate(nil) }
    }
    func setupWindow() {
        let config=WKWebViewConfiguration()
        config.userContentController.addScriptMessageHandler(self,contentWorld:.page,name:"liubai")
        web=WKWebView(frame:NSRect(x:0,y:0,width:1280,height:900),configuration:config)
        web.navigationDelegate=self; web.uiDelegate=self
        window=NSWindow(contentRect:web.frame,styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.title="留白 · 电脑应用自律"; window.minSize=NSSize(width:860,height:680); window.contentView=web; window.delegate=self
        window.isReleasedWhenClosed=false; window.center(); window.makeKeyAndOrderFront(nil)
        web.loadFileURL(resource.appendingPathComponent("web/index.html"),allowingReadAccessTo:resource.appendingPathComponent("web"))
        NSApp.activate(ignoringOtherApps:true)
    }
    func setupMenu() {
        let menu=NSMenu(); let root=NSMenuItem(); menu.addItem(root); let application=NSMenu(); root.submenu=application
        application.addItem(withTitle:"显示留白",action:#selector(showWindow),keyEquivalent:"1").target=self
        application.addItem(.separator())
        application.addItem(withTitle:"退出留白（停止应用限制）",action:#selector(quitApp),keyEquivalent:"q").target=self
        let edit=NSMenuItem(); edit.title="编辑"; let submenu=NSMenu(title:"编辑"); edit.submenu=submenu; menu.addItem(edit)
        for (title,selector,key) in [("剪切",#selector(NSText.cut(_:)),"x"),("复制",#selector(NSText.copy(_:)),"c"),("粘贴",#selector(NSText.paste(_:)),"v"),("全选",#selector(NSText.selectAll(_:)),"a")] { submenu.addItem(withTitle:title,action:selector,keyEquivalent:key) }
        NSApp.mainMenu=menu
        statusItem=NSStatusBar.system.statusItem(withLength:NSStatusItem.variableLength)
        statusItem.button?.title=""
        statusItem.button?.image=menuBarIcon()
        statusItem.button?.imagePosition = .imageLeading
        statusItem.button?.font = .monospacedDigitSystemFont(ofSize:13,weight:.medium)
        statusItem.button?.toolTip="留白"
        statusItem.button?.setAccessibilityLabel("留白")
        let tray=NSMenu()
        statusDescription=NSMenuItem(title:"留白",action:nil,keyEquivalent:"")
        tray.addItem(statusDescription); tray.addItem(.separator())
        tray.addItem(withTitle:"显示留白",action:#selector(showWindow),keyEquivalent:"").target=self
        tray.addItem(withTitle:"退出留白（停止应用限制）",action:#selector(quitApp),keyEquivalent:"").target=self
        statusItem.menu=tray
    }
    func setupObservers() {
        let workspace=NSWorkspace.shared.notificationCenter
        observers.append(workspace.addObserver(forName:NSWorkspace.didActivateApplicationNotification,object:nil,queue:.main) { [weak self] event in
            let application=event.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            self?.sample(frontBundle:application?.bundleIdentifier ?? "")
        })
        for name in [NSWorkspace.willSleepNotification,NSWorkspace.sessionDidResignActiveNotification] {
            observers.append(workspace.addObserver(forName:name,object:nil,queue:.main) { [weak self] _ in self?.locked=true })
        }
        for name in [NSWorkspace.didWakeNotification,NSWorkspace.sessionDidBecomeActiveNotification] {
            observers.append(workspace.addObserver(forName:name,object:nil,queue:.main) { [weak self] _ in self?.locked=false })
        }
        for (name,value) in [("com.apple.screenIsLocked",true),("com.apple.screenIsUnlocked",false)] {
            observers.append(DistributedNotificationCenter.default().addObserver(forName:Notification.Name(name),object:nil,queue:.main) { [weak self] _ in self?.locked=value })
        }
    }
    func sample(frontBundle:String?=nil) {
        guard !isSampling else { return }; isSampling=true; defer { isSampling=false }
        do {
            var current=observation(locked:locked)
            if let frontBundle { current["frontBundleId"]=(managedBundles[frontBundle] != nil || ["local.liubai.native","com.google.Chrome","com.microsoft.edgemac"].contains(frontBundle)) ? frontBundle as Any : NSNull() }
            let commands=try decode(engine.call("tick",[current])) as? [[String:Any]] ?? []
            try persist()
            for command in commands {
                guard let identity=command["process"] as? [String:Any],let bundle=identity["bundleId"] as? String,managedBundles[bundle] != nil else { continue }
                if command["kind"] as? String == "show" { showWindow() }
                if command["kind"] as? String == "quit",let app=matchingProcess(identity) { _ = app.terminate() }
            }
            try publish()
        } catch {
            lastError=error.localizedDescription
            _ = try? engine.call("setEnabled",[false])
            try? publish()
        }
    }
    func persist() throws {
        let json=try engine.call("snapshot")
        if json != lastDisk { try store.save(json); lastDisk=json }
    }
    func status() throws -> [String:Any] {
        var data=try decode(engine.call("status")) as! [String:Any]
        let browsers=browserHealth.connectedBrowsers(at:monotonicMilliseconds())
        data["browserConnected"] = !browsers.isEmpty
        data["connectedBrowsers"]=browsers; data["browserLastSeen"]=browserHealth.lastSeen
        data["installedApps"]=installed; data["platform"]="macOS"; data["lastError"]=lastError
        data["idleSeconds"]=CGEventSource.secondsSinceLastEventType(.combinedSessionState,eventType:CGEventType(rawValue:UInt32.max)!)
        let front=NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""
        data["frontApp"]=managedBundles[front] ?? "其他应用"
        data["sampledAt"]=milliseconds(); data["monotonicMs"]=monotonicMilliseconds()
        return data
    }
    func publish() throws {
        let current=try status()
        if let display=current["menuBar"] as? [String:Any], let title=display["title"] as? String, let detail=display["detail"] as? String {
            statusItem.button?.title=title.isEmpty ? "" : " " + title
            statusItem.button?.toolTip=detail
            statusItem.button?.setAccessibilityLabel(detail)
            statusDescription.title=detail
        }
        guard ready else { return }
        let state=try engine.call("state")
        if state != lastState {
            let detail=try jsonText(try decode(state))
            web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('liubai:state',{detail:\(detail)}))",completionHandler:nil)
            lastState=state
        }
        web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('liubai:status',{detail:\(try jsonText(current))}))",completionHandler:nil)
    }
    func userContentController(_ userContentController: WKUserContentController,didReceive message: WKScriptMessage,replyHandler: @escaping (Any?,String?) -> Void) {
        guard message.frameInfo.isMainFrame,let frame=message.frameInfo.request.url,frame.isFileURL,frame.path.hasPrefix(resource.appendingPathComponent("web").path + "/"),let body=message.body as? [String:Any],let method=body["method"] as? String else { replyHandler(nil,"拒绝未知来源"); return }
        do {
            switch method {
            case "load_state": replyHandler(try engine.call("state"),nil)
            case "save_state":
                guard let json=body["json"] as? String,json.utf8.count<10_000_000 else { throw LocalError(message:"保存内容不正确") }
                let result=try engine.call("save",[json,milliseconds()]); try persist(); replyHandler(result,nil)
            case "save_reflection", "save_open_reason":
                guard let id=body["id"] as? String,let text=body["text"] as? String,text.utf8.count<10000 else { throw LocalError(message:"记录内容不正确") }
                let result: String
                if method == "save_reflection" { result=try engine.call("saveReflection",[id,text,milliseconds()]) }
                else { result=try engine.call("saveOpenReason",[id,text,milliseconds(),body["skip"] as? Bool ?? false,body["intention"] as? String ?? NSNull()]) }
                try persist(); try publish()
                if method == "save_open_reason",body["returnToApp"] as? Bool == true,
                   let state=try decode(result) as? [String:Any],let opens=state["opens"] as? [[String:Any]],let event=opens.first(where:{$0["id"] as? String == id}),let targetId=event["targetId"] as? String,
                   let targets=state["targets"] as? [[String:Any]],let target=targets.first(where:{$0["id"] as? String == targetId}),let bundles=target["identities"] as? [String],
                   let app=NSWorkspace.shared.runningApplications.first(where:{bundles.contains($0.bundleIdentifier ?? "") && managedBundles[$0.bundleIdentifier ?? ""] != nil}),let identity=processInfo(app),matchingProcess(identity) != nil {
                    _ = try engine.call("prepareReturn",[identity]); app.activate(options:[.activateAllWindows])
                }
                replyHandler(result,nil)
            case "close_opening":
                guard let id=body["id"] as? String,let text=body["text"] as? String,text.utf8.count<10000 else {throw LocalError(message:"记录内容不正确")}
                let processes=NSWorkspace.shared.runningApplications.compactMap { app -> [String:Any]? in
                    guard let bundle=app.bundleIdentifier,managedBundles[bundle] != nil else {return nil}
                    return processInfo(app)
                }
                guard let identity=try decode(engine.call("closeOpeningProcess",[id,text,milliseconds(),processes])) as? [String:Any],let app=matchingProcess(identity) else {throw LocalError(message:"原应用进程已退出或变化，请刷新后重试")}
                guard app.terminate() else {throw LocalError(message:"未能请求正常关闭，请保存工作后手动关闭应用")}
                let result=try engine.call("recordClosedOpening",[id,text,milliseconds()]);try persist();try publish();replyHandler(result,nil)
            case "finish_countup":
                guard let id=body["id"] as? String else { throw LocalError(message:"专注记录不存在") }
                let result=try engine.call("finishCountUp",[id,milliseconds()]); try persist(); try publish(); replyHandler(result,nil)
            case "classify_opening":
                guard let id=body["id"] as? String,let intention=body["intention"] as? String else { throw LocalError(message:"请选择打开意图") }
                let result=try engine.call("classifyOpening",[id,intention]); try persist(); try publish(); replyHandler(result,nil)
            case "install_browser_host":
                guard let browser=body["browser"] as? String else{throw LocalError(message:"请选择浏览器")}
                replyHandler(try installBrowserHost(browser:browser),nil)
            case "open_extension_folder":
                NSWorkspace.shared.open(resource.appendingPathComponent("extension"));replyHandler("ok",nil)
            case "native_status": replyHandler(try status(),nil)
            case "set_management":
                guard let value=body["enabled"] as? Bool else { throw LocalError(message:"开关参数不正确") }
                _ = try engine.call("setEnabled",[value]); lastError=""; try persist(); sample(); replyHandler(try status(),nil)
            case "allow_app":
                guard let id=body["noticeId"] as? String,let typed=body["typed"] as? String,let reason=body["reason"] as? String else { throw LocalError(message:"解除信息不完整") }
                let before=try status(); let notices=before["notices"] as? [[String:Any]] ?? []
                let notice=notices.first { $0["id"] as? String == id }; let quit=notice?["quit"] as? [String:Any]; let identity=quit?["process"] as? [String:Any]
                _ = try engine.call("allow",[id,milliseconds(),monotonicMilliseconds(),typed,reason,body["intention"] as? String ?? NSNull()]); try persist()
                if let identity,let app=matchingProcess(identity) { _ = try engine.call("prepareReturn",[identity]); app.activate(options:[.activateAllWindows]) }
                replyHandler(try status(),nil)
            case "quit_now", "return_to_app":
                guard let id=body["noticeId"] as? String,let notice=(try status()["notices"] as? [[String:Any]])?.first(where:{ $0["id"] as? String == id }),let quit=notice["quit"] as? [String:Any],let identity=quit["process"] as? [String:Any],let app=matchingProcess(identity) else { throw LocalError(message:"应用状态已变化，请刷新") }
                if method == "return_to_app" { _ = try engine.call("prepareReturn",[identity]) }
                replyHandler(["requested":method == "return_to_app" ? app.activate(options:[.activateAllWindows]) : app.terminate()],nil)
            case "force_quit":
                guard body["confirmed"] as? Bool == true,let id=body["noticeId"] as? String,let notice=(try status()["notices"] as? [[String:Any]])?.first(where:{ $0["id"] as? String == id }),let quit=notice["quit"] as? [String:Any],quit["stage"] as? String == "needs-confirmation",quit["forceQuitOptIn"] as? Bool == true,let identity=quit["process"] as? [String:Any],let app=matchingProcess(identity) else { throw LocalError(message:"未获准强制退出或进程已变化") }
                replyHandler(["requested":app.forceTerminate()],nil)
            default: replyHandler(nil,"不支持的操作")
            }
        } catch { replyHandler(nil,error.localizedDescription) }
    }
    func webView(_ webView: WKWebView,runOpenPanelWith parameters: WKOpenPanelParameters,initiatedByFrame frame: WKFrameInfo,completionHandler: @escaping ([URL]?) -> Void) {
        let panel=NSOpenPanel(); panel.canChooseDirectories=false; panel.allowsMultipleSelection=false
        panel.allowedContentTypes=[.jpeg,.png,UTType(filenameExtension:"webp") ?? .image]
        panel.beginSheetModal(for:window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView,didFinish navigation: WKNavigation!) { ready=true; try? publish() }
    func webView(_ webView: WKWebView,decidePolicyFor navigationAction: WKNavigationAction,decisionHandler: @escaping (WKNavigationActionPolicy)->Void) {
        let url=navigationAction.request.url
        decisionHandler(url?.isFileURL == true && url!.path.hasPrefix(resource.appendingPathComponent("web").path + "/") ? .allow : .cancel)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication,hasVisibleWindows flag: Bool) -> Bool { showWindow(); return true }
    func applicationWillTerminate(_ notification: Notification) { try? persist() }
    @objc func showWindow() { window?.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps:true) }
    @objc func quitApp() { NSApp.terminate(nil) }
    func alert(_ text: String) { let alert=NSAlert(); alert.messageText="留白"; alert.informativeText=text; alert.runModal() }
}

if CommandLine.arguments.contains("--browser-host") {
    runBrowserHost()
} else if CommandLine.arguments.contains("--probe") {
    print(try jsonText(["installedApps":installedApps(),"observation":observation(locked:false)]))
} else if CommandLine.arguments.contains("--self-test") {
    try browserFrameSelfTest()
    let engine=try Engine(script:Bundle.main.resourceURL!.appendingPathComponent("runtime.js"),raw:nil)
    let at=milliseconds()
    let fake: [String:Any]=["pid":123,"startedAt":at-1000,"executable":"/test/bili","protected":false,"bundleId":"com.bilibili.bilibiliPC"]
    var testPolicy=try decode(engine.call("state")) as! [String:Any]
    precondition((testPolicy["rules"] as! [[String:Any]]).isEmpty)
    var firstRunRejected=false
    do { _ = try engine.call("setEnabled",[true]) } catch { firstRunRejected=true }
    precondition(firstRunRejected)
    var testSettings=testPolicy["settings"] as! [String:Any]
    testSettings["onboarding"]=["stage":"complete"]
    testPolicy["settings"]=testSettings
    var testRules:[[String:Any]]=[["id":"self-test-rule","name":"测试规则","targetId":"bilibili-app","listId":"entertainment","enabled":true,"mode":"gentle","dailyMinutes":30,"dailyOpens":NSNull(),"weekdays":[:],"allowedWindows":[],"breakEveryMinutes":NSNull(),"breakMinutes":5,"graceSeconds":60,"forceQuitOptIn":false]]
    var calendar=Calendar(identifier:.gregorian); calendar.timeZone=TimeZone(identifier:"Asia/Shanghai")!
    let components=calendar.dateComponents([.hour,.minute],from:Date(timeIntervalSince1970:at/1000))
    let windowStart=((components.hour! * 60 + components.minute!) + 60) % 1440
    for index in testRules.indices where testRules[index]["targetId"] as? String == "bilibili-app" {
        testRules[index]["dailyOpens"]=0
        testRules[index]["allowedWindows"]=[["days":[0,1,2,3,4,5,6],"start":windowStart,"end":(windowStart+1)%1440]]
    }
    testPolicy["rules"]=testRules
    let scheduledStart=components.hour! * 60 + components.minute!
    let focusSpace:[String:Any]=["id":"self-test-space","name":"测试专注空间","durationMinutes":37,"projectId":"personal","listIds":["entertainment"],"mode":"gentle","tone":"mint"]
    testPolicy["focusSpaces"]=[focusSpace]
    let weekday=calendar.component(.weekday,from:Date(timeIntervalSince1970:at/1000))-1
    testPolicy["schedules"]=[["id":"self-test-plan","name":"测试专注空间","listIds":["entertainment"],"mode":"gentle","enabled":true,"focusSpace":focusSpace,"windows":[["days":[weekday],"start":scheduledStart,"end":(scheduledStart+37)%1440]]]]
    _ = try engine.call("save",[try jsonText(testPolicy),at])
    _ = try engine.call("setEnabled",[true])
    _ = try engine.call("tick",[["at":at,"monotonicMs":0,"idleSeconds":0,"locked":false,"frontBundleId":NSNull(),"processes":[fake]]])
    _ = try engine.call("tick",[["at":at+1000,"monotonicMs":1000,"idleSeconds":0,"locked":false,"frontBundleId":"com.bilibili.bilibiliPC","processes":[fake]]])
    var policy=try decode(engine.call("state")) as! [String:Any]
    let event=(policy["opens"] as! [[String:Any]])[0]
    precondition(event["outsideAllowedWindow"] as? Bool == true)
    var missingIntentionRejected=false
    do { _ = try engine.call("saveOpenReason",[event["id"]!,"测试：观看收藏课程",at+2000,false]) } catch { missingIntentionRejected=true }
    precondition(missingIntentionRejected)
    _ = try engine.call("saveOpenReason",[event["id"]!,"测试：观看收藏课程",at+2000,false,"accidental"])
    _ = try engine.call("classifyOpening",[event["id"]!,"accidental"])
    policy=try decode(engine.call("state")) as! [String:Any]
    policy["sessions"]=[["id":"test-session","startedAt":at-60000,"endsAt":at,"durationMinutes":1,"listIds":["entertainment"],"projectId":"personal","mode":"gentle","status":"completed"]]
    _ = try engine.call("save",[try jsonText(policy),at+2000])
    _ = try engine.call("saveReflection",["test-session","测试：今天理清了思路",at+3000])
    let store=try Store(path:":memory:")
    let snapshot=try engine.call("snapshot"); try store.save(snapshot)
    let loaded=try store.load(); precondition(loaded == snapshot)
    let restored=try Engine(script:Bundle.main.resourceURL!.appendingPathComponent("runtime.js"),raw:try store.load())
    _ = try restored.call("tick",[observation(locked:false)])
    let state=try decode(restored.call("state")) as! [String:Any]; precondition(state["version"] as? Int == 1)
    precondition((state["focusSpaces"] as? [[String:Any]])?.count == 1)
    precondition((state["scheduleRuns"] as? [[String:Any]])?.count == 1)
    precondition((state["sessions"] as? [[String:Any]])?.filter { $0["scheduleId"] as? String == "self-test-plan" }.count == 1)
    precondition((state["opens"] as? [[String:Any]])?.first?["outsideAllowedWindow"] as? Bool == true)
    precondition((state["reflections"] as? [[String:Any]])?.count == 1)
    precondition((state["openReasons"] as? [[String:Any]])?.count == 1)
    precondition((state["opens"] as? [[String:Any]])?.first?["intention"] as? String == "accidental")
    precondition(((state["opens"] as? [[String:Any]])?.first?["quotaExceeded"] as? [String]) == ["daily-opens"])
    let countEngine=try Engine(script:Bundle.main.resourceURL!.appendingPathComponent("runtime.js"),raw:nil)
    var countPolicy=try decode(countEngine.call("state")) as! [String:Any]
    countPolicy["sessions"]=[["id":"countup-test","startedAt":at,"endsAt":at,"durationMinutes":0,"timerMode":"countup","listIds":["entertainment"],"projectId":"personal","mode":"friction","status":"active","backgroundId":"image-test"]]
    countPolicy["focusBackgrounds"]=[["id":"image-test","name":"本机背景","dataUrl":"data:image/jpeg;base64,AA=="]]
    _ = try countEngine.call("save",[try jsonText(countPolicy),at])
    let menuStatus=try decode(countEngine.call("status",[at+3601500])) as! [String:Any]
    precondition((menuStatus["menuBar"] as? [String:Any])?["title"] as? String == "专注 01:00:01")
    let counted=try decode(countEngine.call("finishCountUp",["countup-test",at+3601500])) as! [String:Any]
    precondition((counted["sessions"] as! [[String:Any]])[0]["status"] as? String == "completed")
    precondition(abs(((counted["sessions"] as! [[String:Any]])[0]["durationMinutes"] as! Double)-60.025)<0.000001)
    precondition((counted["rewards"] as! [[String:Any]])[0]["minutes"] as? Int == 15)
    try store.save(try countEngine.call("snapshot"))
    let countRestored=try Engine(script:Bundle.main.resourceURL!.appendingPathComponent("runtime.js"),raw:try store.load())
    let countState=try decode(countRestored.call("state")) as! [String:Any]
    precondition((countState["focusBackgrounds"] as! [[String:Any]])[0]["name"] as? String == "本机背景")
    _ = try countRestored.call("finishCountUp",["countup-test",at+4000000])
    print("PASS: 正向计时实际时长、奖励与背景 SQLite 往返、专注空间定时启动与重启去重、时段外理由与判断校验、镜湖超额快照与意图保存、JavaScriptCore 规则引擎、心得和打开理由 SQLite 往返、系统观测接口")
} else {
    let application=NSApplication.shared
    let delegate=AppDelegate()
    application.delegate=delegate
    application.setActivationPolicy(.regular)
    application.run()
}
