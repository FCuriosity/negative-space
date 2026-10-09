using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.IO.Pipes;
using Microsoft.Win32;

internal static class Program {
  static readonly JsonSerializerOptions Json=new(){PropertyNamingPolicy=JsonNamingPolicy.CamelCase};
  static readonly object OutputLock=new();
  static readonly Dictionary<string,string> Ids=new(StringComparer.OrdinalIgnoreCase){["bilibili"]="com.bilibili.bilibiliPC",["xiaohongshu"]="com.xingin.discover",["rednote"]="com.xingin.discover",["WeChat"]="com.tencent.xinWeChat",["Weixin"]="com.tencent.xinWeChat",["steam"]="com.valvesoftware.steam",["msedge"]="com.microsoft.edgemac",["chrome"]="com.google.Chrome",["Liubai"]="local.liubai.native"};
  static readonly Dictionary<string,string> Names=new(){["com.bilibili.bilibiliPC"]="哔哩哔哩 App",["com.xingin.discover"]="小红书 App",["com.tencent.xinWeChat"]="微信",["com.valvesoftware.steam"]="Steam"};
  record Identity(int Pid,double StartedAt,string Executable,string BundleId,bool Protected);
  [StructLayout(LayoutKind.Sequential)] struct LastInput {public uint Size;public uint Tick;}
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LastInput info);
  [DllImport("user32.dll")] static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern bool GetUserObjectInformation(IntPtr handle,int index,StringBuilder value,uint size,out uint needed);
  [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr h,int cmd);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h,uint msg,IntPtr w,IntPtr l);
  delegate bool WindowCallback(IntPtr h,IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback callback,IntPtr p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  static double Now()=>DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
  static bool Locked(){var h=OpenInputDesktop(0,false,1);if(h==IntPtr.Zero)return true;try{var name=new StringBuilder(256);return !GetUserObjectInformation(h,2,name,512,out _)||name.ToString()!="Default";}finally{CloseDesktop(h);}}
  static Identity? Inspect(Process p){try{if(!Ids.TryGetValue(p.ProcessName,out var id))return null;return new(p.Id,new DateTimeOffset(p.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds(),p.MainModule!.FileName,id,!Names.ContainsKey(id));}catch{return null;}}
  static Process? Match(Identity expected){try{var p=Process.GetProcessById(expected.Pid);var actual=Inspect(p);if(actual==expected&&!actual.Protected)return p;p.Dispose();}catch{}return null;}
  static bool Act(string kind,Identity expected){using var p=Match(expected);if(p==null)return false;
    if(kind=="force"){p.Kill(false);return true;}
    if(kind=="activate"){var h=p.MainWindowHandle;if(h==IntPtr.Zero)return false;ShowWindowAsync(h,9);return SetForegroundWindow(h);}
    if(kind!="quit")throw new Exception("不支持的进程操作");
    // WM_CLOSE lets each application show its own save/cancel dialog. Never kill on a timer.
    var sent=false;EnumWindows((h,_)=>{GetWindowThreadProcessId(h,out var pid);if(pid==p.Id&&IsWindowVisible(h))sent=PostMessage(h,0x0010,IntPtr.Zero,IntPtr.Zero)||sent;return true;},IntPtr.Zero);return sent;
  }
  static object Observe(){GetWindowThreadProcessId(GetForegroundWindow(),out var front);var processes=new List<Identity>();string? frontId=null;var visible=new HashSet<int>();EnumWindows((h,_)=>{if(IsWindowVisible(h)){GetWindowThreadProcessId(h,out var pid);visible.Add((int)pid);}return true;},IntPtr.Zero);
    foreach(var p in Process.GetProcesses()){using(p){var i=Inspect(p);if(i==null)continue;if(i.Pid==front)frontId=i.BundleId;if(!i.Protected&&(visible.Contains(i.Pid)||i.Pid==front))processes.Add(i);}}
    // Prefer foreground process when an application has helper processes with the same name.
    processes=processes.OrderByDescending(p=>p.Pid==front).ToList();
    var input=new LastInput{Size=(uint)Marshal.SizeOf<LastInput>()};var idle=GetLastInputInfo(ref input)?unchecked((uint)Environment.TickCount-input.Tick)/1000.0:double.MaxValue;
    return new {at=Now(),monotonicMs=(double)Environment.TickCount64,idleSeconds=idle,locked=Locked(),frontBundleId=frontId,processes};
  }
  static object Installed(){var found=new Dictionary<string,string>();foreach(var p in Process.GetProcesses()){using(p){var i=Inspect(p);if(i is {Protected:false})found[i.BundleId]=i.Executable;}}
    foreach(var hive in new[]{Registry.CurrentUser,Registry.LocalMachine})foreach(var view in new[]{RegistryView.Registry64,RegistryView.Registry32})try{
      using var root=RegistryKey.OpenBaseKey(hive==Registry.CurrentUser?RegistryHive.CurrentUser:RegistryHive.LocalMachine,view);
      using var uninstall=root.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall");if(uninstall==null)continue;
      foreach(var name in uninstall.GetSubKeyNames()){using var key=uninstall.OpenSubKey(name);var label=Convert.ToString(key?.GetValue("DisplayName"))??"";var id=label.Contains("哔哩")||label.Contains("bilibili",StringComparison.OrdinalIgnoreCase)?"com.bilibili.bilibiliPC":label.Contains("小红书")||label.Contains("rednote",StringComparison.OrdinalIgnoreCase)?"com.xingin.discover":label.Contains("微信")||label.Contains("WeChat",StringComparison.OrdinalIgnoreCase)||label.Contains("Weixin",StringComparison.OrdinalIgnoreCase)?"com.tencent.xinWeChat":label=="Steam"?"com.valvesoftware.steam":null;if(id!=null)found.TryAdd(id,Convert.ToString(key?.GetValue("InstallLocation"))??"");}
    }catch{}
    return Names.Select(pair=>new{name=pair.Value,bundleId=pair.Key,installed=found.ContainsKey(pair.Key),path=found.GetValueOrDefault(pair.Key)}).ToArray();
  }
  static void Print(object value){lock(OutputLock){Console.WriteLine(JsonSerializer.Serialize(value,Json));}}
  static byte[] ReadFrame(Stream input){var h=new byte[4];input.ReadExactly(h);var n=System.Buffers.Binary.BinaryPrimitives.ReadInt32LittleEndian(h);if(n<1||n>65536)throw new Exception("消息过大");var b=new byte[n];input.ReadExactly(b);return b;}
  static void WriteFrame(Stream output,byte[] b){var h=new byte[4];System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(h,b.Length);output.Write(h);output.Write(b);output.Flush();}
  static void BrowserHost(){var input=Console.OpenStandardInput();var output=Console.OpenStandardOutput();while(true){byte[] request;try{request=ReadFrame(input);}catch{return;}try{
      var endpointPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"Liubai","browser-endpoint.json");
      using var endpoint=JsonDocument.Parse(File.ReadAllText(endpointPath));var root=endpoint.RootElement;
      using var pipe=new NamedPipeClientStream(".",root.GetProperty("pipe").GetString()!,PipeDirection.InOut,PipeOptions.Asynchronous);pipe.Connect(3000);
      var packet=JsonSerializer.SerializeToUtf8Bytes(new{token=root.GetProperty("token").GetString(),request=JsonSerializer.Deserialize<JsonElement>(request)});WriteFrame(pipe,packet);
      using var timeout=new CancellationTokenSource(5000);var header=new byte[4];pipe.ReadExactlyAsync(header,timeout.Token).AsTask().GetAwaiter().GetResult();var size=System.Buffers.Binary.BinaryPrimitives.ReadInt32LittleEndian(header);if(size<1||size>65536)throw new Exception();var reply=new byte[size];pipe.ReadExactlyAsync(reply,timeout.Token).AsTask().GetAwaiter().GetResult();WriteFrame(output,reply);
    }catch{WriteFrame(output,JsonSerializer.SerializeToUtf8Bytes(new{error="请先打开留白，并在连接管理中重新准备本地连接"}));}}}
  static int Main(string[] args){
    if(args.Contains("--browser-host") || args.Any(a=>a.StartsWith("chrome-extension://",StringComparison.Ordinal))){BrowserHost();return 0;}
    if(args.Contains("--self-test")){var payload=Encoding.UTF8.GetBytes("中文心跳");using var stream=new MemoryStream();WriteFrame(stream,payload);stream.Position=0;if(!ReadFrame(stream).SequenceEqual(payload))return 1;if(Act("quit",new Identity(Environment.ProcessId,0,"invalid","com.tencent.xinWeChat",false)))return 2;Print(new{passed=true,observation=Observe()});return 0;}
    Console.OutputEncoding=new UTF8Encoding(false);
    using var stop=new CancellationTokenSource();
    var sampling=Task.Run(async()=>{while(!stop.IsCancellationRequested){try{Print(new{type="observation",data=Observe()});}catch(Exception e){Print(new{type="error",error=e.Message});}await Task.Delay(1000,stop.Token).ContinueWith(_=>{});}});
    string? line;while((line=Console.ReadLine())!=null){string? id=null;try{using var doc=JsonDocument.Parse(line);var r=doc.RootElement;id=r.GetProperty("id").GetString();var kind=r.GetProperty("kind").GetString();object result;
      if(kind=="installed")result=Installed();else if(kind=="register"){var browser=r.GetProperty("browser").GetString();var key=browser=="edge"?@"Software\Microsoft\Edge\NativeMessagingHosts\local.liubai.browser":browser=="chrome"?@"Software\Google\Chrome\NativeMessagingHosts\local.liubai.browser":throw new Exception("不支持的浏览器");using var registry=Registry.CurrentUser.CreateSubKey(key);registry.SetValue("",r.GetProperty("path").GetString()!);result=true;}
      else result=Act(kind!,r.GetProperty("process").Deserialize<Identity>(new JsonSerializerOptions(Json){PropertyNameCaseInsensitive=true})!);
      Print(new{type="response",id,result});
    }catch(Exception e){Print(new{type="response",id,error=e.Message});}}
    stop.Cancel();return 0;
  }
}
