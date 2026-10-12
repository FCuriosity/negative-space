package cn.liubai.app;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import org.json.JSONObject;
import java.util.concurrent.*;

/** Runs the real packaged WebView engine and SQLite bridge, without touching other apps. */
public final class SmokeInstrumentation extends Instrumentation {
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 @Override public void onStart(){Bundle report=new Bundle();try{
  MainActivity activity=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  JSONObject loaded=call("load",new JSONObject());
  if(loaded.optBoolean("enabled"))throw new Exception("Fresh install unexpectedly enabled management");
  if(loaded.getJSONObject("state").getJSONArray("rules").length()!=0)throw new Exception("Fresh install contains preset rules");
  JSONObject args=new JSONObject();args.put("targetId","wechat");args.put("minutes",30);
  JSONObject saved=call("first_rule",args);
  if(saved.optBoolean("enabled"))throw new Exception("Saving first rule started enforcement");
  if(saved.getJSONObject("state").getJSONArray("rules").length()!=1)throw new Exception("Rule not persisted");
  String raw=new StateStore(getTargetContext()).read();if(raw==null||!raw.contains("first-gentle-rule"))throw new Exception("SQLite snapshot missing");
  report.putString("stream","LIUBAI_ANDROID_SMOKE_OK: packaged engine, first-rule safety, SQLite persistence\n");finish(0,report);
 }catch(Exception e){report.putString("stream","LIUBAI_ANDROID_SMOKE_FAILED: "+e+"\n");finish(1,report);}}
 private JSONObject call(String method,JSONObject args)throws Exception{
  CountDownLatch latch=new CountDownLatch(1);JSONObject[] value=new JSONObject[1];
  runOnMainSync(()->EngineHost.get(getTargetContext()).call(method,args,r->{value[0]=r;latch.countDown();}));
  if(!latch.await(20,TimeUnit.SECONDS))throw new Exception("WebView engine timed out");
  if(value[0].has("error"))throw new Exception(value[0].getString("error"));return value[0];
 }
}
