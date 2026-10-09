use rusqlite::{Connection, OptionalExtension, params};
use std::{path::Path, sync::Mutex};

pub struct Database(Mutex<Connection>);
impl Database {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let db = Connection::open(path)?;
        db.busy_timeout(std::time::Duration::from_secs(5))?;
        db.execute_batch(include_str!("../../../../packages/storage/migrations/001_snapshot.sql"))?;
        Ok(Self(Mutex::new(db)))
    }
    pub fn load(&self) -> Result<Option<String>, String> {
        self.0.lock().map_err(|e| e.to_string())?
            .query_row("SELECT json FROM app_state WHERE id = 1", [], |row| row.get(0))
            .optional().map_err(|e| e.to_string())
    }
    pub fn save(&self, json: &str) -> Result<(), String> {
        if json.len() > 10_000_000 { return Err("状态文件超过 10 MB".into()); }
        let value: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
        if value.get("version").and_then(|v| v.as_u64()) != Some(1) { return Err("不支持的数据版本".into()); }
        for key in ["rules", "sessions", "usage", "opens", "rewards", "tasks", "habits", "projects", "targets", "lists", "schedules", "audit"] {
            if !value.get(key).is_some_and(|v| v.is_array()) { return Err(format!("缺少字段：{key}")); }
        }
        self.0.lock().map_err(|e| e.to_string())?
            .execute("INSERT INTO app_state(id, json, updated_at) VALUES(1, ?1, unixepoch()) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at", params![json])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_payload_does_not_overwrite_state() {
        let db = Database::open(Path::new(":memory:")).unwrap();
        let good = r#"{"version":1,"rules":[],"sessions":[],"usage":[],"opens":[],"rewards":[],"tasks":[],"habits":[],"projects":[],"targets":[],"lists":[],"schedules":[],"audit":[]}"#;
        db.save(good).unwrap();
        assert!(db.save("{bad").is_err());
        assert!(db.save(r#"{"version":2}"#).is_err());
        assert_eq!(db.load().unwrap().unwrap(), good);
    }
}
