import AppKit
import CoreGraphics
func milliseconds() -> Double { Date().timeIntervalSince1970*1000 }
func monotonicMilliseconds() -> Double { ProcessInfo.processInfo.systemUptime*1000 }
func spin(_ seconds: Double) { let end=Date().addingTimeInterval(seconds); while Date()<end { RunLoop.current.run(until:Date().addingTimeInterval(0.05)) } }
let fixture=URL(fileURLWithPath:CommandLine.arguments[1])
precondition(Bundle(url:fixture)?.bundleIdentifier == "local.liubai.test-fixture")
for refuse in [false,true] {
    let marker=fixture.deletingLastPathComponent().appendingPathComponent(UUID().uuidString+".txt")
    let config=NSWorkspace.OpenConfiguration(); config.activates=false; config.createsNewApplicationInstance=true
    config.arguments=(refuse ? ["--refuse"] : [])+["--marker",marker.path]
    var launched: NSRunningApplication?
    var failure: Error?
    NSWorkspace.shared.openApplication(at:fixture,configuration:config) { app,error in launched=app; failure=error }
    for _ in 0..<100 { if launched != nil || failure != nil { break }; spin(0.1) }
    guard let running=launched else { fatalError("Fixture registration failed: \(String(describing:failure))") }
    defer { if !running.isTerminated { _ = running.forceTerminate() } }
    spin(0.5)
    guard let identity=processInfo(running) else { fatalError("Fixture identity unavailable: pid=\(running.processIdentifier), bundle=\(String(describing:running.bundleIdentifier)), launch=\(String(describing:running.launchDate)), exe=\(String(describing:running.executableURL))") }
    precondition(matchingProcess(identity) != nil)
    var wrong=identity; wrong["startedAt"]=(identity["startedAt"] as! Double)+1000
    precondition(matchingProcess(wrong) == nil,"PID reuse must be rejected")
    precondition(running.terminate(),"Normal quit request must be sent")
    spin(1)
    if refuse {
        precondition(!running.isTerminated,"App must remain alive after cancelling save/quit")
    } else { precondition(running.isTerminated,"Cooperative app should exit normally") }
    let output=try String(contentsOf:marker,encoding:.utf8)
    precondition(output.contains(refuse ? "SAVE_DIALOG_CANCELLED" : "NORMAL_QUIT_ACCEPTED"))
}
print("PASS: normal application quit, save cancellation respected, PID identity mismatch rejected")
