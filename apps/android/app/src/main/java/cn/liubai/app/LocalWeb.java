package cn.liubai.app;

import android.content.Context;
import android.webkit.*;
import java.io.ByteArrayInputStream;

/** Both WebViews are confined to packaged files and have no network permission. */
final class LocalWeb {
 static final String ORIGIN="https://appassets.androidplatform.net/";
 static WebView create(Context context) {
  WebView view=new WebView(context);
  view.setBackgroundColor(0xfff7f4ed);
  WebSettings s=view.getSettings();
  s.setJavaScriptEnabled(true); s.setDomStorageEnabled(false);
  s.setAllowFileAccess(false); s.setAllowContentAccess(false);
  s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  s.setJavaScriptCanOpenWindowsAutomatically(false); s.setSupportMultipleWindows(false);
  if((context.getApplicationInfo().flags&android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0)view.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onConsoleMessage(ConsoleMessage message){if(message.messageLevel()==ConsoleMessage.MessageLevel.ERROR)android.util.Log.e("LiubaiWeb",message.message()+" at "+message.sourceId()+":"+message.lineNumber());return true;}
  });
  view.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    String url=r.getUrl().toString();
    if(url.startsWith(ORIGIN)&&"GET".equals(r.getMethod())){
     String path=r.getUrl().getPath().substring(1);
     if(!path.contains(".."))try{
      String mime=path.endsWith(".html")?"text/html":path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".png")?"image/png":"application/octet-stream";
      return new WebResourceResponse(mime,"UTF-8",context.getAssets().open(path));
     }catch(Exception ignored){}
    }
    return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
   }
   @Override public void onPageFinished(WebView v,String url){ if(v.getTag() instanceof Runnable)((Runnable)v.getTag()).run(); }
  });
  return view;
 }
}
