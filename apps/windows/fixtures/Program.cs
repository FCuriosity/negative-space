using System.Windows.Forms;
internal static class Fixture {
  [STAThread] static void Main(string[] args){
    ApplicationConfiguration.Initialize();
    using var form=new Form{Text="留白中文进程测试",Width=300,Height=160};
    form.FormClosing+=(_,e)=>{if(args[0]=="refuse"){File.WriteAllText(args[1],"close rejected");e.Cancel=true;}};
    Application.Run(form);
  }
}
