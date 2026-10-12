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
  UsageCursor cursor=new UsageCursor();
  if(!cursor.accept(100,"wechat")||cursor.accept(100,"wechat")||!cursor.accept(100,"home")||!cursor.accept(105,"late")||cursor.accept(104,"older"))throw new Exception("Usage cursor duplicate/delayed event handling failed");
  MainActivity activity=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
  String text="";
  for(int i=0;i<15;i++){text=uiText(activity);if(text.contains("选一个容易分心的应用"))break;Thread.sleep(1000);}
  if(!text.contains("选一个容易分心的应用"))throw new Exception("Native WebView first-run UI failed: "+text);
  int[] location=new int[2];runOnMainSync(()->activity.uiForTest().getLocationOnScreen(location));
  if(location[1]<=0)throw new Exception("Web content overlaps the status bar");
  JSONObject loaded=call("load",new JSONObject());
  if(loaded.optBoolean("enabled"))throw new Exception("Fresh install unexpectedly enabled management");
  if(loaded.getJSONObject("state").getJSONArray("rules").length()!=0)throw new Exception("Fresh install contains preset rules");
  JSONObject args=new JSONObject();args.put("targetId","wechat");args.put("minutes",30);
  JSONObject saved=call("first_rule",args);
  if(saved.optBoolean("enabled"))throw new Exception("Saving first rule started enforcement");
  if(saved.getJSONObject("state").getJSONArray("rules").length()!=1)throw new Exception("Rule not persisted");
  String raw=new StateStore(getTargetContext()).read();if(raw==null||!raw.contains("first-gentle-rule"))throw new Exception("SQLite snapshot missing");
  // Exercise the actual JavaScript -> Android bridge used by the focus button.
  JSONObject focus=new JSONObject().put("minutes",25).put("manage",true).put("targetIds",new JSONArray().put("wechat"));
  shell("appops set "+getTargetContext().getPackageName()+" GET_USAGE_STATS ignore");
  JSONObject denied=bridge(activity,"focus_start",focus);
  if(!denied.has("error")||FocusService.running()||call("load",new JSONObject()).getJSONObject("state").getJSONArray("sessions").length()!=0)throw new Exception("Missing permission did not prevent managed focus");
  shell("appops set "+getTargetContext().getPackageName()+" GET_USAGE_STATS allow");
  JSONObject focused=bridge(activity,"focus_start",focus);
  if(focused.has("error")||!focused.optBoolean("enabled"))throw new Exception("Managed focus bridge failed: "+focused);
  Thread.sleep(2000);
  Intent fixture=new Intent().setClassName("com.tencent.mm","cn.liubai.fixture.FixtureActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
  runOnMainSync(()->activity.startActivity(fixture));awaitOpens(1);
  Thread.sleep(2000);
  if(!FocusService.hasOverlay())throw new Exception("OS overlay did not appear after restricted foreground activation");
  if(!"focus".equals(call("load",new JSONObject()).getJSONObject("notice").getJSONObject("decision").getString("reason")))throw new Exception("WeChat must be reminded during focus before its 30-minute quota");
  Intent home=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
  runOnMainSync(()->activity.startActivity(home));Thread.sleep(2000);
  runOnMainSync(()->activity.startActivity(fixture));awaitOpens(2);
  runOnMainSync(FocusService::pause);Thread.sleep(1500);
  if(FocusService.running()||FocusService.hasOverlay())throw new Exception("Pause failed to remove service or overlay");
  runOnMainSync(()->activity.startActivity(new Intent(activity,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP)));Thread.sleep(1000);
  JSONObject current=call("load",new JSONObject());String focusId=current.getJSONObject("state").getJSONArray("sessions").getJSONObject(0).getString("id");
  call("focus_cancel",new JSONObject().put("id",focusId));
  JSONObject state=call("load",new JSONObject()).getJSONObject("state");state.getJSONArray("rules").getJSONObject(0).put("dailyOpens",0);
  call("save",new JSONObject().put("state",state));
  JSONObject manage=bridge(activity,"management",MainActivity.jsonEnabled(true));if(manage.has("error"))throw new Exception("Could not start daily rules: "+manage);
  Thread.sleep(2000);runOnMainSync(()->activity.startActivity(fixture));awaitOpens(3);Thread.sleep(1500);
  if(!FocusService.hasOverlay())throw new Exception("Daily quota overlay missing after focus ended");
  runOnMainSync(FocusService::pause);Thread.sleep(1000);
  report.putString("stream","LIUBAI_ANDROID_SMOKE_OK: permission denial, real focus bridge starts service, WeChat focus below quota, delayed-event cursor, daily quota after focus,  packaged engine, first-rule safety, SQLite, OS foreground events, 2 activations, native overlay, pause cleanup\n");finish(0,report);
 }catch(Exception e){runOnMainSync(FocusService::pause);report.putString("stream","LIUBAI_ANDROID_SMOKE_FAILED: "+e+"\n");finish(1,report);}}
 private void shell(String command)throws Exception{
  try(android.os.ParcelFileDescriptor fd=getUiAutomation().executeShellCommand(command);java.io.InputStream in=new android.os.ParcelFileDescriptor.AutoCloseInputStream(fd)){while(in.read()!=-1){}}
 }
 private JSONObject bridge(MainActivity activity,String method,JSONObject args)throws Exception{
  runOnMainSync(()->activity.uiForTest().evaluateJavascript("window.smokeReply=null;{const original=window.nativeReply;window.nativeReply=(id,r)=>{if(id===987654){window.smokeReply=r;window.nativeReply=original;}else original(id,r);};window.Android.request(987654,"+JSONObject.quote(method)+","+JSONObject.quote(args.toString())+");}",null));
  for(int i=0;i<40;i++){
   CountDownLatch latch=new CountDownLatch(1);String[] value=new String[1];runOnMainSync(()->activity.uiForTest().evaluateJavascript("JSON.stringify(window.smokeReply)",r->{value[0]=r;latch.countDown();}));
   if(!latch.await(5,TimeUnit.SECONDS))throw new Exception("Bridge response evaluation timed out");
   Object decoded=new JSONTokener(value[0]).nextValue();if(decoded instanceof String&&!"null".equals(decoded))return new JSONObject((String)decoded);
   Thread.sleep(250);
  }throw new Exception("Android bridge timed out");
 }
 private String uiText(MainActivity activity)throws Exception{
  CountDownLatch latch=new CountDownLatch(1);String[] text=new String[1];runOnMainSync(()->activity.uiForTest().evaluateJavascript("document.body.innerText",r->{text[0]=r;latch.countDown();}));
  if(!latch.await(5,TimeUnit.SECONDS))throw new Exception("UI evaluation timeout");return text[0];
 }
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
