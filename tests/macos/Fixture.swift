import AppKit
final class Fixture: NSObject, NSApplicationDelegate {
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        let refused=CommandLine.arguments.contains("--refuse")
        if let i=CommandLine.arguments.firstIndex(of:"--marker"),CommandLine.arguments.count>i+1 {
            try? (refused ? "SAVE_DIALOG_CANCELLED" : "NORMAL_QUIT_ACCEPTED").write(toFile:CommandLine.arguments[i+1],atomically:true,encoding:.utf8)
        }
        return refused ? .terminateCancel : .terminateNow
    }
}
let app=NSApplication.shared
let delegate=Fixture()
app.delegate=delegate
app.setActivationPolicy(.accessory)
app.run()
