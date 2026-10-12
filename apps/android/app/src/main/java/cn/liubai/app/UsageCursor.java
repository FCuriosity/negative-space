package cn.liubai.app;
import java.util.HashSet;

/** Event watermark, not query-wall-clock: OEM usage events can arrive late. */
final class UsageCursor {
 private long timestamp=0;
 private final HashSet<String> atTimestamp=new HashSet<>();
 boolean accept(long at,String identity){
  if(at<timestamp)return false; // Never rewind the foreground to an older event.
  if(at>timestamp){timestamp=at;atTimestamp.clear();}
  return atTimestamp.add(identity);
 }
 void reset(){timestamp=0;atTimestamp.clear();}
}
