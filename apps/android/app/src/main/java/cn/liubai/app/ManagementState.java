package cn.liubai.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

/** User intent survives service/process death; it is not the service's health signal. */
final class ManagementState {
 private static SharedPreferences prefs(Context c){return c.getSharedPreferences("management",Context.MODE_PRIVATE);}
 static boolean requested(Context c){return prefs(c).getBoolean("requested",false);}
 static void setRequested(Context c,boolean value){
  if(!prefs(c).edit().putBoolean("requested",value).commit())throw new IllegalStateException("管理选择未能保存，请重试");
 }
 static void migrate(Context c,String snapshot)throws Exception{
  if(!prefs(c).contains("requested"))setRequested(c,snapshot!=null&&new JSONObject(snapshot).optBoolean("enabled",false));
 }
}
