package cn.liubai.app;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import org.json.*;
import java.util.concurrent.*;

/** Tests the packaged engine, bridge, SQLite and OS usage events with an emulator-only fixture. */
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
  JSONObject state=saved.getJSONObject("state");state.getJSONArray("rules").getJSONObject(0).put("dailyOpens",0);
  call("save",new JSONObject().put("state",state));call("management",MainActivity.jsonEnabled(true));
  runOnMainSync(()->activity.startForegroundService(new Intent(activity,FocusService.class)));
  Thread.sleep(2000);
  Intent fixture=new Intent().setClassName("com.tencent.mm","cn.liubai.fixture.FixtureActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
  runOnMainSync(()->activity.startActivity(fixture));awaitOpens(1);
  Thread.sleep(2000);
  if(!FocusService.hasOverlay())throw new Exception("OS overlay did not appear after restricted foreground activation");
  Intent home=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
  runOnMainSync(()->activity.startActivity(home));Thread.sleep(2000);
  runOnMainSync(()->activity.startActivity(fixture));awaitOpens(2);
  runOnMainSync(FocusService::pause);Thread.sleep(1500);
  if(FocusService.running()||FocusService.hasOverlay())throw new Exception("Pause failed to remove service or overlay");
  report.putString("stream","LIUBAI_ANDROID_SMOKE_OK: packaged engine, first-rule safety, SQLite, OS foreground events, 2 activations, native overlay, pause cleanup\n");finish(0,report);
 }catch(Exception e){runOnMainSync(FocusService::pause);report.putString("stream","LIUBAI_ANDROID_SMOKE_FAILED: "+e+"\n");finish(1,report);}}
 private void awaitOpens(int expected)throws Exception{
  for(int i=0;i<15;i++){int count=call("load",new JSONObject()).getJSONObject("state").getJSONArray("opens").length();if(count==expected)return;if(count>expected)throw new Exception("Duplicate activation "+count);Thread.sleep(1000);}throw new Exception("OS usage activation timeout");
 }
 private JSONObject call(String method,JSONObject args)throws Exception{
  CountDownLatch latch=new CountDownLatch(1);JSONObject[] value=new JSONObject[1];
  runOnMainSync(()->EngineHost.get(getTargetContext()).call(method,args,r->{value[0]=r;latch.countDown();}));
  if(!latch.await(20,TimeUnit.SECONDS))throw new Exception("WebView engine timed out");
  if(value[0].has("error"))throw new Exception(value[0].getString("error"));return value[0];
 }
}
