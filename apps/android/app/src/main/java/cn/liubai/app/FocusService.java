package cn.liubai.app;
import android.app.*;
import android.app.usage.*;
import android.content.*;
import android.graphics.PixelFormat;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import org.json.*;

public final class FocusService extends Service {
 private static FocusService active;
 static boolean running(){return active!=null;}
 static boolean hasOverlay(){return active!=null&&active.overlay!=null;}
 static void pause(){if(active!=null)active.stop("你已暂停管理");}
 static JSONObject diagnostics(Context c){
  JSONObject o=new JSONObject();try{
   o.put("lastStop",c.getSharedPreferences("diagnostics",0).getString("lastStop","尚未开启管理"));
   o.put("heartbeat",active==null?0:active.heartbeat);
   o.put("lastEvent",active==null?0:active.lastEvent);
   o.put("recognizedApp",active==null?"":active.lastRecognized);
   o.put("overlayVisible",hasOverlay());
  }catch(Exception ignored){}return o;
 }
 private static String managedName(String pkg){if("com.tencent.mm".equals(pkg))return "微信";if("tv.danmaku.bili".equals(pkg))return "哔哩哔哩";if("com.xingin.xhs".equals(pkg))return "小红书";if("com.ss.android.ugc.aweme".equals(pkg))return "抖音";return "";}
 private void stop(String reason){getSharedPreferences("diagnostics",0).edit().putString("lastStop",reason).apply();stopSelf();}
 static boolean hasUsage(Context c){AppOpsManager ops=(AppOpsManager)c.getSystemService(APP_OPS_SERVICE);return ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,android.os.Process.myUid(),c.getPackageName())==AppOpsManager.MODE_ALLOWED;}
 private final Handler handler=new Handler(Looper.getMainLooper());
 private long queriedAt=0,heartbeat=0,lastEvent=0;private final UsageCursor cursor=new UsageCursor();private String foreground=null,noticeId=null,lastRecognized="";
 private android.webkit.WebView overlayWeb;
 private String suppressedPackage=null;
 private View overlay;private WindowManager windows;
 @Override public void onCreate(){super.onCreate();active=this;windows=(WindowManager)getSystemService(WINDOW_SERVICE);}
 @Override public int onStartCommand(Intent i,int flags,int id){
  if(i!=null&&"pause".equals(i.getAction())){stop("你已暂停管理");return START_NOT_STICKY;}
  NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
  nm.createNotificationChannel(new NotificationChannel("focus","留白管理状态",NotificationManager.IMPORTANCE_LOW));
  PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,FocusService.class).setAction("pause"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  Notification n=new Notification.Builder(this,"focus").setSmallIcon(cn.liubai.app.R.drawable.brand).setContentTitle("留白正在记录前台使用").setContentText("仅记录所选应用 · 点此查看 · 可随时暂停").setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"暂停管理",stop).build()).build();
  startForeground(1,n);getSharedPreferences("diagnostics",0).edit().putString("lastStop","服务曾运行，若已停止，可能被系统回收，请重新开启").apply();handler.removeCallbacks(pulse);handler.post(pulse);return START_NOT_STICKY;
 }
 private final Runnable pulse=new Runnable(){public void run(){
  if(!hasUsage(FocusService.this)||!Settings.canDrawOverlays(FocusService.this)){stop("使用情况访问或悬浮提醒权限已关闭");return;}
  try {
  boolean locked=!((PowerManager)getSystemService(POWER_SERVICE)).isInteractive()||((KeyguardManager)getSystemService(KEYGUARD_SERVICE)).isKeyguardLocked();
  long now=System.currentTimeMillis();
  if(queriedAt>now){cursor.reset();foreground=null;queriedAt=0;}
  UsageEvents events=((UsageStatsManager)getSystemService(USAGE_STATS_SERVICE)).queryEvents(queriedAt==0?now-24*60*60*1000:Math.max(0,queriedAt-30000),now);
  JSONArray samples=new JSONArray();
  long sampleFloor=queriedAt;
  if(events!=null){UsageEvents.Event e=new UsageEvents.Event();while(events.hasNextEvent()){events.getNextEvent(e);if(e.getEventType()!=UsageEvents.Event.ACTIVITY_RESUMED&&e.getEventType()!=UsageEvents.Event.SCREEN_NON_INTERACTIVE&&e.getEventType()!=UsageEvents.Event.KEYGUARD_SHOWN)continue;
   String identity=e.getEventType()+":"+e.getPackageName()+":"+e.getClassName();
   if(!cursor.accept(e.getTimeStamp(),identity))continue;
   if(e.getEventType()==UsageEvents.Event.ACTIVITY_RESUMED){foreground=e.getPackageName();if(!managedName(foreground).isEmpty())lastRecognized=managedName(foreground);lastEvent=e.getTimeStamp();if(queriedAt!=0&&!locked){try{JSONObject sample=new JSONObject();sample.put("pkg",foreground);long observedAt=Math.max(sampleFloor,e.getTimeStamp());sample.put("at",observedAt);sample.put("mono",SystemClock.elapsedRealtime()-(now-observedAt));sample.put("locked",false);samples.put(sample);}catch(Exception ignored){}}}
   else if(e.getEventType()==UsageEvents.Event.SCREEN_NON_INTERACTIVE||e.getEventType()==UsageEvents.Event.KEYGUARD_SHOWN)foreground=null;
  }}queriedAt=now;
  if(locked)foreground=null;
  final String front=foreground;
  EngineHost.get(FocusService.this).tickBatch(samples,front,locked,result->{
   if(active!=FocusService.this)return;
   if(result.has("error")){stop(result.optString("error"));return;}
   if(!result.optBoolean("enabled")){stop("管理已暂停");return;}heartbeat=System.currentTimeMillis();
   if(suppressedPackage!=null&&!suppressedPackage.equals(front))suppressedPackage=null;
   JSONObject notice=result.optJSONObject("overlayNotice");if(notice==null||locked||front==null||front.equals(suppressedPackage))hideOverlay();else showOverlay(notice);
  handler.postDelayed(this,1000);
  });
  }catch(Exception e){stop("系统未能提供应用切换或提醒服务，请检查权限后重试");}
 }};
 private void showOverlay(JSONObject n){
  if(n.optString("id").equals(noticeId))return;hideOverlay();noticeId=n.optString("id");
  LinearLayout frame=new LinearLayout(this);frame.setOrientation(LinearLayout.VERTICAL);frame.setBackgroundColor(0xfff7f2e7);
  android.graphics.drawable.GradientDrawable background=new android.graphics.drawable.GradientDrawable();background.setColor(0xfff7f2e7);background.setCornerRadius(20*getResources().getDisplayMetrics().density);frame.setBackground(background);frame.setClipToOutline(true);
  overlayWeb=LocalWeb.create(this);overlayWeb.addJavascriptInterface(new OverlayBridge(),"Android");frame.addView(overlayWeb,new LinearLayout.LayoutParams(-1,0,1));
  Button back=new Button(this);back.setText("回到留白");back.setTextColor(0xff1b5143);back.setBackgroundColor(0xfff7f2e7);back.setOnClickListener(v->openApp());frame.addView(back,new LinearLayout.LayoutParams(-1,-2));
  android.util.DisplayMetrics screen=getResources().getDisplayMetrics();int width=Math.min(screen.widthPixels-(int)(24*screen.density),(int)(540*screen.density));int height=Math.min((int)(screen.heightPixels*.82),(int)(720*screen.density));
  WindowManager.LayoutParams params=new WindowManager.LayoutParams(width,height,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,PixelFormat.TRANSLUCENT);params.gravity=Gravity.CENTER;params.softInputMode=WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
  try{windows.addView(frame,params);overlay=frame;overlayWeb.loadUrl(LocalWeb.ORIGIN+"overlay.html");}catch(Exception e){hideOverlay();stop("系统未能显示悬浮提醒，请重新检查悬浮窗权限");}
 }
 private void openApp(){hideOverlay();startActivity(new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP));}
 android.webkit.WebView overlayForTest(){return overlayWeb;}
 static android.webkit.WebView currentOverlayForTest(){return active==null?null:active.overlayWeb;}
 public final class OverlayBridge {
  @android.webkit.JavascriptInterface public void request(int id,String method,String raw){handler.post(()->{
   final android.webkit.WebView source=overlayWeb;if(source==null)return;
   try{
    JSONObject args=new JSONObject(raw);args.put("id",noticeId);
    if("open_app".equals(method)){openApp();return;}
    if(!java.util.Arrays.asList("load","allow","leave","save_tags").contains(method))throw new Exception("不支持的提醒操作");
    EngineHost.get(FocusService.this).call("load".equals(method)?"load_notice":method,args,result->{
     if(source!=overlayWeb)return;source.evaluateJavascript("window.nativeReply("+id+","+result+")",null);
     if(!result.has("error")&&("allow".equals(method)||"leave".equals(method))){
      if("leave".equals(method)){suppressedPackage=foreground;startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}
      hideOverlay();
     }
    });
   }catch(Exception e){source.evaluateJavascript("window.nativeReply("+id+","+EngineHost.error(e.getMessage())+")",null);}
  });}
 }
 private void hideOverlay(){if(overlay!=null){try{windows.removeView(overlay);}catch(Exception ignored){}overlay=null;}if(overlayWeb!=null){overlayWeb.removeJavascriptInterface("Android");overlayWeb.destroy();overlayWeb=null;}noticeId=null;}
 @Override public void onDestroy(){handler.removeCallbacks(pulse);hideOverlay();active=null;EngineHost.get(this).call("management",MainActivity.jsonEnabled(false),r->{});super.onDestroy();}
 @Override public IBinder onBind(Intent i){return null;}
}
