import Foundation
import Darwin

// A 30-second extension alarm renews this lease, even on unmanaged pages.
// Monotonic time avoids false disconnects after wall-clock adjustments.
struct BrowserConnectionHealth {
    private var seen:[String:Double]=[:]
    private(set) var lastSeen:Double=0
    mutating func receive(browser:String,wallTime:Double,monotonicTime:Double) {
        seen[browser]=monotonicTime; lastSeen=wallTime
    }
    func connectedBrowsers(at now:Double) -> [String] {
        seen.filter { now >= $0.value && now-$0.value < 90000 }.map { $0.key }.sorted()
    }
}

private let bridgeDirectory=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("留白")
private var bridgePath:String { bridgeDirectory.appendingPathComponent("browser.sock").path }
private func address(_ path:String) throws -> sockaddr_un {
    guard path.utf8.count<104 else {throw LocalError(message:"本地浏览器连接路径过长")}
    var a=sockaddr_un();a.sun_family=sa_family_t(AF_UNIX);a.sun_len=UInt8(MemoryLayout<sockaddr_un>.size)
    withUnsafeMutableBytes(of:&a.sun_path){buffer in buffer.initializeMemory(as:UInt8.self,repeating:0);buffer.copyBytes(from:Array(path.utf8)+[0])}
    return a
}
private func exactRead(_ fd:Int32,_ count:Int) throws -> Data {
    var data=Data(count:count);var offset=0
    try data.withUnsafeMutableBytes { buffer in
        while offset<count { let n=Darwin.read(fd,buffer.baseAddress!.advanced(by:offset),count-offset);if n<=0 {throw LocalError(message:"浏览器连接已关闭")};offset+=n }
    };return data
}
private func readFrame(_ fd:Int32) throws -> Data {
    let header=try exactRead(fd,4);let count=header.enumerated().reduce(0){$0 | Int($1.element)<<($1.offset*8)}
    guard count>0 && count<=65536 else {throw LocalError(message:"浏览器消息过大")};return try exactRead(fd,count)
}
private func writeFrame(_ fd:Int32,_ data:Data) throws {
    var length=UInt32(data.count).littleEndian;var packet=withUnsafeBytes(of:&length){Data($0)};packet.append(data)
    var offset=0;try packet.withUnsafeBytes {buffer in while offset<packet.count {let n=Darwin.write(fd,buffer.baseAddress!.advanced(by:offset),packet.count-offset);if n<=0{throw LocalError(message:"浏览器回复失败")};offset+=n}}
}
private func configureSocket(_ fd:Int32) {var noPipe:Int32=1;setsockopt(fd,SOL_SOCKET,SO_NOSIGPIPE,&noPipe,socklen_t(MemoryLayout.size(ofValue:noPipe)));var timeout=timeval(tv_sec:3,tv_usec:0);setsockopt(fd,SOL_SOCKET,SO_RCVTIMEO,&timeout,socklen_t(MemoryLayout.size(ofValue:timeout)));setsockopt(fd,SOL_SOCKET,SO_SNDTIMEO,&timeout,socklen_t(MemoryLayout.size(ofValue:timeout)))}
final class BrowserBridge {
    private var fd:Int32 = -1
    func start(handler:@escaping([String:Any])->[String:Any]) throws {
        var a=try address(bridgePath)
        unlink(bridgePath);fd=socket(AF_UNIX,SOCK_STREAM,0)
        guard fd>=0 else{throw LocalError(message:"无法建立浏览器连接")}
        let result=withUnsafePointer(to:&a){$0.withMemoryRebound(to:sockaddr.self,capacity:1){Darwin.bind(fd,$0,socklen_t(MemoryLayout<sockaddr_un>.size))}}
        guard result==0,chmod(bridgePath,0o600)==0,listen(fd,8)==0 else {Darwin.close(fd);fd = -1;throw LocalError(message:"无法开启本地浏览器接口")}
        let server=fd
        DispatchQueue.global(qos:.utility).async {
            while true {let client=accept(server,nil,nil);if client<0{return};configureSocket(client)
                do {let raw=try readFrame(client);guard let request=try JSONSerialization.jsonObject(with:raw) as? [String:Any] else{throw LocalError(message:"消息格式无效")};let reply=DispatchQueue.main.sync {handler(request)};try writeFrame(client,JSONSerialization.data(withJSONObject:reply))}catch {try? writeFrame(client,Data("{\"error\":\"本地连接处理失败\"}".utf8))}
                Darwin.close(client)
            }
        }
    }
}
func runBrowserHost() {
    signal(SIGPIPE,SIG_IGN)
    while let input=try? readFrame(STDIN_FILENO) {
        do {var a=try address(bridgePath);let fd=socket(AF_UNIX,SOCK_STREAM,0);defer{Darwin.close(fd)};configureSocket(fd)
            let connected=withUnsafePointer(to:&a){$0.withMemoryRebound(to:sockaddr.self,capacity:1){connect(fd,$0,socklen_t(MemoryLayout<sockaddr_un>.size))}}
            guard connected==0 else{throw LocalError(message:"请先打开留白 Mac 应用")}
            try writeFrame(fd,input);try writeFrame(STDOUT_FILENO,readFrame(fd))
        }catch {let reply=(try? JSONSerialization.data(withJSONObject:["error":error.localizedDescription])) ?? Data();try? writeFrame(STDOUT_FILENO,reply)}
    }
}

func installBrowserHost(browser:String) throws -> String {
    let folder:String
    switch browser {case "edge":folder="Microsoft Edge";case "chrome":folder="Google/Chrome";default:throw LocalError(message:"目前连接支持 Chrome 和 Edge")}
    let resource=Bundle.main.resourceURL!
    let extensionID=try String(contentsOf:resource.appendingPathComponent("extension-id.txt"),encoding:.utf8).trimmingCharacters(in:.whitespacesAndNewlines)
    guard extensionID.range(of:"^[a-p]{32}$",options:.regularExpression) != nil else {throw LocalError(message:"扩展标识无效")}
    let hostFolder=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent(folder).appendingPathComponent("NativeMessagingHosts")
    try FileManager.default.createDirectory(at:hostFolder,withIntermediateDirectories:true)
    let manifest:[String:Any] = ["name":"local.liubai.browser","description":"留白本地网页配额连接","path":resource.appendingPathComponent("browser-host.sh").path,"type":"stdio","allowed_origins":["chrome-extension://\(extensionID)/"]]
    try JSONSerialization.data(withJSONObject:manifest,options:.prettyPrinted).write(to:hostFolder.appendingPathComponent("local.liubai.browser.json"),options:.atomic)
    return "本地连接已准备请在浏览器扩展页加载留白扩展"
}

func browserFrameSelfTest() throws {
    var health=BrowserConnectionHealth()
    precondition(health.connectedBrowsers(at:0).isEmpty)
    health.receive(browser:"edge",wallTime:1000,monotonicTime:1000)
    precondition(health.connectedBrowsers(at:31000)==["edge"])
    health.receive(browser:"chrome",wallTime:500,monotonicTime:60000)
    precondition(health.connectedBrowsers(at:91000)==["chrome"])
    precondition(health.connectedBrowsers(at:150000).isEmpty)

    var sockets:[Int32]=[0,0]
    guard socketpair(AF_UNIX,SOCK_STREAM,0,&sockets)==0 else{throw LocalError(message:"无法创建浏览器协议测试连接")}
    defer{Darwin.close(sockets[0]);Darwin.close(sockets[1])}
    let payload=Data("{\"host\":\"zhihu.com\",\"text\":\"中文理由\"}".utf8)
    try writeFrame(sockets[0],payload);let decoded=try readFrame(sockets[1]);precondition(decoded==payload)
}
