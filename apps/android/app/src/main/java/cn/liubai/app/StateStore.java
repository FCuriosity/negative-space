package cn.liubai.app;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
final class StateStore extends SQLiteOpenHelper {
 StateStore(Context c){super(c,"liubai.db",null,1);}
 public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)");}
 public void onUpgrade(SQLiteDatabase db,int old,int next){throw new IllegalStateException("不支持的数据版本");}
 String read(){try(Cursor c=getReadableDatabase().rawQuery("SELECT json FROM state WHERE id=1",null)){return c.moveToFirst()?c.getString(0):null;}}
 void write(String json){ContentValues v=new ContentValues();v.put("id",1);v.put("json",json);getWritableDatabase().insertWithOnConflict("state",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
}
