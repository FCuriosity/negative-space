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
 private int pendingFileRequest=-1;private String pendingFileMethod=null;private String pendingExport=null;
 private View testOverlay;
 private final Runnable dismissTest=()->hideTest();
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable pulse=new Runnable(){public void run(){if(!FocusService.running())EngineHost.get(MainActivity.this).tick(null,false,r->{});handler.postDelayed(this,1000);}};
 @Override public void onCreate(Bundle b){super.onCreate(b);EngineHost.get(this);web=LocalWeb.create(this);web.addJavascriptInterface(new Bridge(),"Android");
  android.widget.FrameLayout frame=new android.widget.FrameLayout(this);
  frame.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));setContentView(frame);
  frame.setOnApplyWindowInsetsListener((v,insets)->{
   if(Build.VERSION.SDK_INT>=30){android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());v.setPadding(safe.left,safe.top,safe.right,safe.bottom);return WindowInsets.CONSUMED;}
   v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();
  });frame.requestApplyInsets();
  web.loadUrl(LocalWeb.ORIGIN+"index.html");
 }
 @Override protected void onResume(){super.onResume();handler.post(pulse);}
 @Override protected void onPause(){handler.removeCallbacks(pulse);super.onPause();}
 @Override protected void onDestroy(){handler.removeCallbacks(dismissTest);hideTest();web.removeJavascriptInterface("Android");web.destroy();super.onDestroy();}
 private void respond(int id,JSONObject result){if(!isFinishing()&&!isDestroyed())web.evaluateJavascript("window.nativeReply("+id+","+result+")",null);}
 android.webkit.WebView uiForTest(){return web;}
 public final class Bridge {
  @JavascriptInterface public void request(int id,String method,String raw){handler.post(()->{
   try {
    JSONObject args=new JSONObject(raw);
    if(method.equals("pick_image")||method.equals("pick_backup")||method.equals("export_backup")){
     if(pendingFileRequest!=-1)throw new Exception("请先完成当前文件选择");
     pendingFileRequest=id;pendingFileMethod=method;
     if(method.equals("export_backup")){EngineHost.get(MainActivity.this).call("load",new JSONObject(),r->{try{if(r.has("error"))throw new Exception(r.getString("error"));pendingExport=r.getJSONObject("state").toString();if(pendingExport.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>10*1024*1024)throw new Exception("备份超过 10 MB，请缩短记录保留时间后重试");Intent choose=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,"liubai-backup.json");startActivityForResult(choose,41);}catch(Exception e){finishFile(EngineHost.error(e.getMessage()));}});}
     else{Intent choose=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(method.equals("pick_image")?"image/*":"*/*");startActivityForResult(choose,41);}return;
    }
    if(method.equals("immersive")){boolean enabled=args.optBoolean("enabled");if(Build.VERSION.SDK_INT>=30){if(enabled)getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());else getWindow().getInsetsController().show(WindowInsets.Type.systemBars());}else getWindow().getDecorView().setSystemUiVisibility(enabled?View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY:View.SYSTEM_UI_FLAG_VISIBLE);respond(id,new JSONObject());return;}
    if(method.equals("leave")){EngineHost.get(MainActivity.this).call(method,args,r->{respond(id,r);if(!r.has("error"))startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME));});return;}
    if(method.equals("restore")){EngineHost.get(MainActivity.this).call(method,args,r->{if(!r.has("error"))FocusService.pause();respond(id,r);});return;}
    if(method.equals("permissions")){JSONObject r=new JSONObject();r.put("usage",FocusService.hasUsage(MainActivity.this));r.put("overlay",Settings.canDrawOverlays(MainActivity.this));r.put("notifications",Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);r.put("running",FocusService.running());r.put("diagnostics",FocusService.diagnostics(MainActivity.this));r.put("device",Build.MANUFACTURER+" "+Build.MODEL+" · Android "+Build.VERSION.RELEASE);android.content.pm.PackageInfo w=WebView.getCurrentWebViewPackage();r.put("webview",w==null?"未知":w.versionName);respond(id,r);return;}
    if(method.equals("overlay_test")){showTest();respond(id,new JSONObject());return;}
    if(method.equals("settings")){
     String page=args.getString("page");Intent intent;
     if(page.equals("usage"))intent=new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
     else if(page.equals("overlay"))intent=new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getPackageName()));
     else if(page.equals("notifications")){if(Build.VERSION.SDK_INT>=33)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},8);respond(id,new JSONObject());return;}
     else if(page.equals("app"))intent=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()));
     else if(page.equals("battery"))intent=new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
     else throw new Exception("不支持的设置");
     startActivity(intent);respond(id,new JSONObject());return;
    }
    if((method.equals("focus_start")||method.equals("space_start"))&&args.optBoolean("manage")){
     if(!FocusService.hasUsage(MainActivity.this)||!Settings.canDrawOverlays(MainActivity.this))throw new Exception("专注提醒尚未开始，请到设置授权使用情况访问和悬浮提醒，再回来开始");
     startManagedFocus(method,args,r->respond(id,r));return;
    }
    if(method.equals("management")){
     boolean enable=args.getBoolean("enabled");
     if(enable&&(!FocusService.hasUsage(MainActivity.this)||!Settings.canDrawOverlays(MainActivity.this)))throw new Exception("请先授权使用情况访问与悬浮提醒");
     EngineHost.get(MainActivity.this).call(method,args,r->{
      try {if(!r.has("error")){if(enable){if(!FocusService.running())startForegroundService(new Intent(MainActivity.this,FocusService.class));}else FocusService.pause();}}catch(Exception e){FocusService.pause();EngineHost.get(MainActivity.this).call("management",jsonEnabled(false),ignored->{});r=EngineHost.error("后台服务未能启动，请重试");}
      respond(id,r);
     });return;
    }
    EngineHost.get(MainActivity.this).call(method,args,r->respond(id,r));
   }catch(Exception e){if(pendingFileRequest==id)finishFile(EngineHost.error(e.getMessage()));else respond(id,EngineHost.error(e.getMessage()));}
  });}
 }
 void startManagedFocus(String method,JSONObject args,EngineHost.Reply reply){
  if(!FocusService.hasUsage(this)||!Settings.canDrawOverlays(this)){reply.done(EngineHost.error("请先授权使用情况访问和悬浮提醒"));return;}
  final boolean wasRunning=FocusService.running();
  EngineHost.get(this).call(method,args,result->{
   if(result.has("error")){reply.done(result);return;}
   try{if(!FocusService.running())startForegroundService(new Intent(this,FocusService.class));reply.done(result);}
   catch(Exception e){
    try{org.json.JSONArray sessions=result.getJSONObject("state").getJSONArray("sessions");for(int j=0;j<sessions.length();j++){JSONObject session=sessions.getJSONObject(j);if("active".equals(session.optString("status")))EngineHost.get(this).call("focus_start_failed",new JSONObject().put("id",session.getString("id")),ignored->{});}}catch(Exception ignored){}
    if(!wasRunning)EngineHost.get(this).call("management",jsonEnabled(false),ignored->{});
    reply.done(EngineHost.error("专注未能启动后台提醒，请检查系统限制后重试"));
   }
  });
 }
 private void finishFile(JSONObject r){int id=pendingFileRequest;pendingFileRequest=-1;pendingFileMethod=null;pendingExport=null;if(id!=-1)respond(id,r);}
 @Override protected void onActivityResult(int code,int result,Intent data){super.onActivityResult(code,result,data);if(code!=41||pendingFileRequest==-1)return;
  if(result!=RESULT_OK||data==null||data.getData()==null){finishFile(EngineHost.error("已取消文件选择"));return;}
  final Uri uri=data.getData();final String method=pendingFileMethod,export=pendingExport;
  new Thread(()->{JSONObject output;
   try{
    if("export_backup".equals(method)){try(java.io.OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new Exception("无法写入文件");out.write(export.getBytes(java.nio.charset.StandardCharsets.UTF_8));}output=new JSONObject().put("saved",true);}
    else{byte[] bytes;try(java.io.InputStream in=getContentResolver().openInputStream(uri);java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){if(in==null)throw new Exception("无法读取文件");byte[] buffer=new byte[8192];int n,total=0;while((n=in.read(buffer))!=-1){total+=n;if(total>10*1024*1024)throw new Exception("文件不能超过 10 MB");out.write(buffer,0,n);}bytes=out.toByteArray();}
     if("pick_image".equals(method)){String mime=getContentResolver().getType(uri);if(!java.util.Arrays.asList("image/jpeg","image/png","image/webp").contains(mime))throw new Exception("请选择 JPG、PNG 或 WebP 图片");String name="我的背景";try(android.database.Cursor c=getContentResolver().query(uri,new String[]{android.provider.OpenableColumns.DISPLAY_NAME},null,null,null)){if(c!=null&&c.moveToFirst())name=c.getString(0);}output=new JSONObject().put("name",name).put("mime",mime).put("dataUrl","data:"+mime+";base64,"+android.util.Base64.encodeToString(bytes,android.util.Base64.NO_WRAP));}
     else output=new JSONObject().put("text",new String(bytes,java.nio.charset.StandardCharsets.UTF_8));
    }
   }catch(Exception e){output=EngineHost.error(e.getMessage());}
   final JSONObject response=output;handler.post(()->finishFile(response));
  },"liubai-file").start();
 }
 private void showTest()throws Exception{
  if(!Settings.canDrawOverlays(this))throw new Exception("请先授权悬浮提醒");
  hideTest();
  android.widget.LinearLayout card=new android.widget.LinearLayout(this);card.setOrientation(android.widget.LinearLayout.VERTICAL);int p=(int)(20*getResources().getDisplayMetrics().density);card.setPadding(p,p,p,p);card.setBackgroundColor(0xfff7f2e7);
  android.widget.TextView title=new android.widget.TextView(this);title.setText("留白 · 系统悬浮提醒测试\n可以切换到桌面查看，15 秒后自动关闭\n不启动管理，不统计次数，也不关闭应用");title.setTextColor(0xff1b5143);title.setTextSize(17);card.addView(title);
  android.widget.Button close=new android.widget.Button(this);close.setText("我看到了 · 关闭测试");close.setOnClickListener(v->hideTest());card.addView(close);
  WindowManager.LayoutParams params=new WindowManager.LayoutParams(-1,-2,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,android.graphics.PixelFormat.TRANSLUCENT);params.gravity=Gravity.BOTTOM;
  try{((WindowManager)getSystemService(WINDOW_SERVICE)).addView(card,params);testOverlay=card;handler.removeCallbacks(dismissTest);handler.postDelayed(dismissTest,15000);}catch(Exception e){throw new Exception("系统未能显示测试提醒，请在应用设置中检查悬浮窗权限");}
 }
 private void hideTest(){if(testOverlay!=null){try{((WindowManager)getSystemService(WINDOW_SERVICE)).removeView(testOverlay);}catch(Exception ignored){}testOverlay=null;}}
 static JSONObject jsonEnabled(boolean value){JSONObject o=new JSONObject();try{o.put("enabled",value);}catch(Exception ignored){}return o;}
}
