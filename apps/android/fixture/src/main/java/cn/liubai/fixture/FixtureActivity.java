package cn.liubai.fixture;
public final class FixtureActivity extends android.app.Activity {
 @Override public void onCreate(android.os.Bundle b){super.onCreate(b);android.widget.TextView label=new android.widget.TextView(this);label.setText("留白自动化测试用应用\n不是真实微信，没有网络权限或消息功能");label.setTextSize(24);label.setPadding(30,80,30,30);setContentView(label);}
}
