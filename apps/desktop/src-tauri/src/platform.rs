use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    platform: &'static str,
    foreground: bool,
    idle: bool,
    safe_quit: bool,
    force_quit: bool,
    background: bool,
}

// Return explicit unavailability until a platform implementation is wired and verified.
// Never substitute simulated observations for real application activity.
pub fn capabilities() -> Capabilities {
    Capabilities { platform: std::env::consts::OS, foreground: false, idle: false, safe_quit: false, force_quit: false, background: false }
}
