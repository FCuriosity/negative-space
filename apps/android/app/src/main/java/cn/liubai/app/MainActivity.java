package cn.liubai.app;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import org.json.*;

public final class MainActivity extends Activity {
 private WebView web;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable pulse=new Runnable(){public void run(){if(!FocusService.running())EngineHost.get(MainActivity.this).tick(null,false,r->{});handler.postDelayed(this,1000);}};
 @Override public void onCreate(Bundle b){super.onCreate(b);EngineHost.get(this);web=LocalWeb.create(this);web.addJavascriptInterface(new Bridge(),"Android");setContentView(web);
  web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  web.loadUrl(LocalWeb.ORIGIN+"index.html");
 }
 @Override protected void onResume(){super.onResume();handler.post(pulse);}
 @Override protected void onPause(){handler.removeCallbacks(pulse);super.onPause();}
 @Override protected void onDestroy(){web.removeJavascriptInterface("Android");web.destroy();super.onDestroy();}
 private void respond(int id,JSONObject result){if(!isFinishing()&&!isDestroyed())web.evaluateJavascript("window.nativeReply("+id+","+result+")",null);}
 android.webkit.WebView uiForTest(){return web;}
 public final class Bridge {
  @JavascriptInterface public void request(int id,String method,String raw){handler.post(()->{
   try {
    JSONObject args=new JSONObject(raw);
    if(method.equals("permissions")){JSONObject r=new JSONObject();r.put("usage",FocusService.hasUsage(MainActivity.this));r.put("overlay",Settings.canDrawOverlays(MainActivity.this));r.put("notifications",Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);r.put("running",FocusService.running());respond(id,r);return;}
    if(method.equals("settings")){
     String page=args.getString("page");Intent intent;
     if(page.equals("usage"))intent=new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
     else if(page.equals("overlay"))intent=new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getPackageName()));
     else if(page.equals("notifications")){if(Build.VERSION.SDK_INT>=33)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},8);respond(id,new JSONObject());return;}
     else throw new Exception("不支持的设置");
     startActivity(intent);respond(id,new JSONObject());return;
    }
    if(method.equals("management")){
     boolean enable=args.getBoolean("enabled");
     if(enable&&(!FocusService.hasUsage(MainActivity.this)||!Settings.canDrawOverlays(MainActivity.this)))throw new Exception("请先授权使用情况访问与悬浮提醒");
     EngineHost.get(MainActivity.this).call(method,args,r->{
      try {if(!r.has("error")){if(enable)startForegroundService(new Intent(MainActivity.this,FocusService.class));else FocusService.pause();}}catch(Exception e){FocusService.pause();EngineHost.get(MainActivity.this).call("management",jsonEnabled(false),ignored->{});r=EngineHost.error("后台服务未能启动，请重试");}
      respond(id,r);
     });return;
    }
    EngineHost.get(MainActivity.this).call(method,args,r->respond(id,r));
   }catch(Exception e){respond(id,EngineHost.error(e.getMessage()));}
  });}
 }
 static JSONObject jsonEnabled(boolean value){JSONObject o=new JSONObject();try{o.put("enabled",value);}catch(Exception ignored){}return o;}
}
