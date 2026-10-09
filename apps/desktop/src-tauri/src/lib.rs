mod storage;
mod platform;
use tauri::Manager;
use storage::Database;

#[tauri::command]
fn load_state(db: tauri::State<'_, Database>) -> Result<Option<String>, String> { db.load() }

#[tauri::command]
fn save_state(db: tauri::State<'_, Database>, json: String) -> Result<(), String> { db.save(&json) }

#[tauri::command]
fn platform_status() -> platform::Capabilities { platform::capabilities() }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(Database::open(&dir.join("liubai.sqlite3"))?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_state, save_state, platform_status])
        .run(tauri::generate_context!())
        .expect("留白桌面启动失败");
}
