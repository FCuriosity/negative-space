import AppKit
import CoreGraphics

let managedBundles: [String:String] = ["com.bilibili.bilibiliPC":"哔哩哔哩 App","com.xingin.discover":"小红书 App","com.tencent.xinWeChat":"微信","com.valvesoftware.steam":"Steam"]

func processInfo(_ app: NSRunningApplication) -> [String:Any]? {
    guard let bundle=app.bundleIdentifier,let launched=app.launchDate,let executable=app.executableURL else { return nil }
    return ["pid":Int(app.processIdentifier),"startedAt":launched.timeIntervalSince1970*1000,"executable":executable.path,"bundleId":bundle,"protected":bundle.hasPrefix("com.apple.") || bundle == Bundle.main.bundleIdentifier]
}

func matchingProcess(_ identity: [String:Any]) -> NSRunningApplication? {
    guard let pid=identity["pid"] as? Int,let started=identity["startedAt"] as? Double,let executable=identity["executable"] as? String,let bundle=identity["bundleId"] as? String,
          !bundle.hasPrefix("com.apple."),bundle != Bundle.main.bundleIdentifier,
          let app=NSRunningApplication(processIdentifier:pid_t(pid)),app.bundleIdentifier == bundle,
          app.executableURL?.path == executable,let launch=app.launchDate,abs(launch.timeIntervalSince1970*1000-started)<2 else { return nil }
    return app
}

func observation(locked: Bool) -> [String:Any] {
    let front=NSWorkspace.shared.frontmostApplication?.bundleIdentifier
    let processes=NSWorkspace.shared.runningApplications.compactMap { app -> [String:Any]? in
        guard let bundle=app.bundleIdentifier,managedBundles[bundle] != nil else { return nil }
        return processInfo(app)
    }
    return ["at":milliseconds(),"monotonicMs":monotonicMilliseconds(),"idleSeconds":CGEventSource.secondsSinceLastEventType(.combinedSessionState,eventType:CGEventType(rawValue:UInt32.max)!),"locked":locked,"frontBundleId":front.flatMap { (managedBundles[$0] != nil || ["local.liubai.native","com.google.Chrome","com.microsoft.edgemac"].contains($0)) ? $0 : nil } as Any? ?? NSNull(),"processes":processes]
}

func installedApps() -> [[String:Any]] {
    let fm=FileManager.default
    let roots=[URL(fileURLWithPath:"/Applications"),fm.homeDirectoryForCurrentUser.appendingPathComponent("Applications")]
    var apps: [String:[String:Any]]=[:]
    for directory in roots {
        for app in (try? fm.contentsOfDirectory(at:directory,includingPropertiesForKeys:nil)) ?? [] where app.pathExtension == "app" {
            var infos=[app.appendingPathComponent("Contents/Info.plist")]
            let wrappers=(try? fm.contentsOfDirectory(at:app.appendingPathComponent("Wrapper"),includingPropertiesForKeys:nil)) ?? []
            infos += wrappers.filter { $0.pathExtension == "app" }.map { $0.appendingPathComponent("Info.plist") }
            for info in infos {
                guard let data=try? Data(contentsOf:info),let dict=try? PropertyListSerialization.propertyList(from:data,format:nil) as? [String:Any],let bundle=dict["CFBundleIdentifier"] as? String,let name=managedBundles[bundle] else { continue }
                apps[bundle]=["name":name,"bundleId":bundle,"path":app.path,"installed":true]
            }
        }
    }
    return managedBundles.map { bundle,name in apps[bundle] ?? ["name":name,"bundleId":bundle,"installed":false] }.sorted { ($0["name"] as! String)<($1["name"] as! String) }
}
