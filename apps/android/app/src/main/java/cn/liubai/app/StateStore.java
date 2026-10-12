package cn.liubai.app;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;

/** Chunked snapshots avoid Android CursorWindow's per-row limit when backgrounds are embedded. */
final class StateStore extends SQLiteOpenHelper {
 private static final int CHUNK=128*1024;
 StateStore(Context c){super(c,"liubai.db",null,2);}
 public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)");createChunks(db);}
 private void createChunks(SQLiteDatabase db){db.execSQL("CREATE TABLE IF NOT EXISTS state_chunks (id INTEGER PRIMARY KEY, part TEXT NOT NULL)");}
 public void onUpgrade(SQLiteDatabase db,int old,int next){if(old==1&&next==2)createChunks(db);else throw new IllegalStateException("不支持的数据版本");}
 String read(){SQLiteDatabase db=getReadableDatabase();StringBuilder text=new StringBuilder();try(Cursor c=db.rawQuery("SELECT part FROM state_chunks ORDER BY id",null)){while(c.moveToNext())text.append(c.getString(0));}if(text.length()>0)return text.toString();try(Cursor c=db.rawQuery("SELECT json FROM state WHERE id=1",null)){return c.moveToFirst()?c.getString(0):null;}}
 void write(String json){SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{db.delete("state_chunks",null,null);int index=0;for(int start=0;start<json.length();){int end=Math.min(json.length(),start+CHUNK);if(end<json.length()&&Character.isHighSurrogate(json.charAt(end-1)))end--;ContentValues value=new ContentValues();value.put("id",index++);value.put("part",json.substring(start,end));db.insertOrThrow("state_chunks",null,value);start=end;}db.delete("state",null,null);db.setTransactionSuccessful();}finally{db.endTransaction();}}
}
