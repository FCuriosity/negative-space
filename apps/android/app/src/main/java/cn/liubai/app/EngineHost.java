package cn.liubai.app;
import android.content.Context;
import android.os.*;
import android.webkit.WebView;
import org.json.*;
import java.util.*;

/** One authoritative engine, shared by the UI and the foreground service. */
final class EngineHost {
 interface Reply {void done(JSONObject result);}
 private static EngineHost instance;
 static EngineHost get(Context c){if(instance==null)instance=new EngineHost(c.getApplicationContext());return instance;}
 private final WebView web;
 private final StateStore store;
 private boolean ready=false,busy=false;
 private String fatal=null;
 private final ArrayDeque<Runnable> queue=new ArrayDeque<>();
 private long lastSave=0;
 JSONObject latest=new JSONObject();
 private EngineHost(Context c){
  store=new StateStore(c); web=LocalWeb.create(c);
  web.setTag((Runnable)()->{
   try {String raw=store.read();ManagementState.migrate(c,raw);evaluate("AndroidEngine.initialize("+(raw==null?"null":JSONObject.quote(raw))+")",true,r->{ready=true;JSONObject args=new JSONObject();try{args.put("timezone",java.util.TimeZone.getDefault().getID());}catch(Exception ignored){}call("timezone",args,ignored->{});drain();});}
   catch(Exception e){fatal="本地记录无法读取，请保留数据并联系开发者";ready=true;drain();}
  });web.loadUrl(LocalWeb.ORIGIN+"runtime.html");
 }
 static JSONObject error(String message){JSONObject o=new JSONObject();try{o.put("error",message);}catch(Exception ignored){}return o;}
 private void drain(){if(ready&&!busy&&!queue.isEmpty()){busy=true;queue.remove().run();}}
 void call(String method,JSONObject args,Reply reply){
  queue.add(()->evaluate("AndroidEngine.call("+JSONObject.quote(method)+","+args+","+System.currentTimeMillis()+","+SystemClock.elapsedRealtime()+")",!method.startsWith("load"),r->{busy=false;reply.done(r);drain();}));drain();
 }
 void tick(String pkg,boolean locked,Reply reply){tickBatch(new JSONArray(),pkg,locked,reply);}
 void tickBatch(JSONArray samples,String pkg,boolean locked,Reply reply){
  // Every service tick must receive its own evaluated result, never a cached UI load.
  queue.add(()->evaluate("(()=>{for(const s of "+samples+")AndroidEngine.tick(s.pkg,s.at,s.mono,s.locked);return AndroidEngine.tick("+(pkg==null?"null":JSONObject.quote(pkg))+","+System.currentTimeMillis()+","+SystemClock.elapsedRealtime()+","+locked+")})()",SystemClock.elapsedRealtime()-lastSave>5000,r->{busy=false;reply.done(r);drain();}));drain();
 }
 private void evaluate(String expression,boolean persist,Reply reply){
  if(fatal!=null){reply.done(error(fatal));return;}
  String js="(()=>{try{const result="+expression+";return JSON.stringify({result,snapshot:"+(persist?"AndroidEngine.snapshot()":"null")+"})}catch(e){return JSON.stringify({result:{error:String(e.message||e)}})}})()";
  web.evaluateJavascript(js,value->{
   try {
    Object decoded=new JSONTokener(value).nextValue();
    if(!(decoded instanceof String))throw new IllegalStateException("WebView runtime unavailable");
    JSONObject envelope=new JSONObject((String)decoded),result=envelope.getJSONObject("result");
    if(result.has("error")){reply.done(result);return;}
    if(persist&&!envelope.isNull("snapshot")){store.write(envelope.getString("snapshot"));lastSave=SystemClock.elapsedRealtime();}
    latest=result;reply.done(result);
   }catch(Exception e){fatal="本地引擎或存储出错，管理已暂停，请保留应用数据";FocusService.suspend(fatal);reply.done(error(fatal));}
  });
 }
}
