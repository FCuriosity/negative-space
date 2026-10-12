# Alpha2 修复内测说明

当前修复包为 `liubai-0.1.0-alpha2.apk`，独立包名 `cn.liubai.app.preview2`，可与 alpha1 共存；不要为安装新版而卸载旧版，旧版的本地记录不会自动迁移。测试新版前请暂停旧版的管理

专注页选中应用后点击「开始专注并开启提醒」，授权不足时会引导到设置。OPPO 可在设置页测试系统悬浮提醒、查看运行诊断，并进入系统应用/电池优化设置。ColorOS 后台存活需要真机复测

以下发行准备说明仍适用，alpha1 文件名仅作为初始构建记录

# 留白安卓内测与国内商店发行

当前版本：0.1.0-alpha1，面向 Android 9+，需 Android System WebView / Chrome 100+；原生鸿蒙不在这个 APK 的兼容范围内

## 安装内测包

GitHub → Actions → Android installable preview → 成功的运行 → 下载 `liubai-android-alpha1`，解压后将 APK 发送到手机安装

系统提示时，只为你用来打开 APK 的文件管理器/浏览器允许本次安装来源；后续可关闭此权限

1. 选择微信、B站、小红书或抖音中的一个
2. 设置每日时长，完成安全提醒演示，保存第一条规则
3. 到设置分别授权「使用情况访问」「悬浮提醒」，建议允许通知
4. 回到留白，点击「正式开启管理」；状态和常驻通知应显示管理中
5. 每次切回所选 App 记一次，达到时长/次数/允许时段限制后显示温和提醒
6. 填写理由并确认意图可临时继续 5 分钟，超额或时段外的无意识打开记入镜湖
7. 通知、悬浮提醒、应用设置均可暂停；重启或后台服务被系统停止后需手动重新开启

这是 debug 签名的内部测试包，包名 `cn.liubai.app.preview`，不能直接提交正式商店
CI 每次可能生成不同测试签名，同包名不同签名不能覆盖安装；卸载会删除数据，不能以卸载作为正式升级方案

## 已实现与边界

- Java 原生 Android 宿主、前台服务、UsageStats 使用事件、系统悬浮提醒、本地 SQLite
- 四款标准版 App：`com.tencent.mm`、`tv.danmaku.bili`、`com.xingin.xhs`、`com.ss.android.ugc.aweme`
- 每日时长、次数、星期配额、允许时段、连续使用休息规则；本版统一温和提醒
- 自定义倒计时与正向计时、专注心得、每日事项和历史、打开理由、镜湖
- 不杀进程、不修改网络或系统设置；没有无障碍、联网、联系人、相册、麦克风权限
- 用户授权并主动开启之后才读取使用事件，筛选后只落盘所选应用的数据
- 锁屏/熄屏不统计；不能区分「亮屏静看」与真正操作，系统事件延迟可能导致秒级误差
- 小窗口、分屏、应用分身、地区变种包名、厂商后台省电策略需要单独真机验证
- 不提供 App 内部推荐流隐藏、严格防绕过、朋友审批、桌面浏览器管理、桌面时间表拖拽或跨设备同步
- 服务使用 START_NOT_STICKY，不尝试隐藏运行、开机自启或阻止用户停止
- 进程突然终止最多丢失最近约 5 秒尚未提交的统计；主动保存操作同步落盘
- 专注按真实时间结算，服务暂停后再次打开仍可完成结算；首版没有熄屏准点闹铃通知

## 国内发行顺序

### 1. 确认发行主体和标识

用你实际拥有的个人或企业开发者账号申请目标商店，按类目核对准入
正式包名暂定 `cn.liubai.app`，提交前确认唯一性和长期使用意愿；包名、签名、备案、版权材料、开发者名称须一致或提供合规授权

不要假设每家商店都接受同样的主体、材料或线下工具豁免

### 2. 准备版权和备案材料

小米公开政策要求版权证明，并按相关规定履行 APP 备案；不同渠道按实时后台要求提交
法规中的 APP 备案针对提供互联网信息服务的应用，留白当前是离线工具，具体适用范围与商店证明要求应向目标商店及主管部门确认，不能因为没有网络权限就保证无需备案

- 小米政策：https://dev.mi.com/distribute/doc/details?pId=1321
- 小米资质 FAQ：https://dev.mi.com/xiaomihyperos/documentation/detail?pId=2251
- 工信部 APP 备案通知：https://www.gov.cn/zhengce/zhengceku/202308/content_6897341.htm
- OPPO 上传流程与材料：https://open.oppomobile.com/bbs/forum.php?mod=viewthread&tid=6304
- 华为审核政策入口：https://developer.huawei.com/consumer/cn/doc/doccenter-submission/50000

原生 HarmonyOS 使用独立工程与发行包，不能把这个 Android APK 当作已适配原生鸿蒙

### 3. 固定正式签名

正式发行前，由发行人生成并离线备份 release keystore、别名和密码，两份加密备份由本人控制
不要提交到 Git，不要用内测 debug key，不要在日志输出密码
在有 JDK 17 的电脑上交互运行，避免命令行明文密码：

```sh
keytool -genkeypair -v -keystore liubai-release.jks -alias liubai -keyalg RSA -keysize 3072 -validity 10000
```

工程支持通过环境变量提供 `LIUBAI_KEYSTORE`、`LIUBAI_KEYSTORE_PASSWORD`、`LIUBAI_KEY_ALIAS`、`LIUBAI_KEY_PASSWORD`，由本机安全环境或 CI Secrets 注入

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm android:assets
gradle -p apps/android assembleRelease lintRelease
```

签名齐全才会输出可供商店的 release APK；没有签名时输出 unsigned 文件，不能提交或直接安装
每次正式更新增加 `versionCode`，保持包名和签名一致，并验证「旧版有数据 → 覆盖安装 → 数据保留」

签名官方说明：https://developer.android.com/studio/publish/app-signing

### 4. 补齐上架材料

仓库的 `ANDROID_PRIVACY_DRAFT.md` 是待发行人填写的隐私政策草稿，不是已可公开发布的最终政策

- 开发者实名认证、联系方式、按渠道要求提供版权/备案等材料
- 应用名称「留白」、分类「效率/工具」、一句话简介、详细介绍、版本更新说明
- 原始 SVG 导出的图标与真实手机截图，不使用虚构功能截图
- 公开可访问的隐私政策 HTTPS 链接，内容与 App 内完全一致
- 逐项权限用途、关闭权限后的影响、收集信息清单、开源组件与系统 WebView 说明
- 向审核说明首次三步引导、安全演示、两项特殊权限的用途、常驻通知暂停入口
- 说明不读取聊天内容、不扫描全部安装软件、不申请无障碍、不自动结束其他应用
- 生产包关闭调试，完成隐私与兼容性检测后提交审核

OPPO 要求政策链接可正常读取且与 App 内一致：https://open.oppomobile.com/bbs/forum.php?mod=viewthread&tid=6304

### 5. 真机验收再提审

至少在目标渠道的 Android 系手机验证，具体系统版本和机型写入测试报告

- 不看源码的新用户，能独立安装、完成一条温和规则，并说明何时生效
- 不授权时不会管理；拒绝通知时 UI 正确反映状态；撤销使用或悬浮权限及时暂停
- 切到微信再回桌面，重复 10 次；每次回到微信只增 1，同一 App 页面跳转不增
- 从真实提醒去留白写理由再回原 App 不重复计数；从普通留白页面回原 App 正常计数
- 1 分钟配额、0 次配额、工作日/周末配额、跨午夜时段、连续使用休息都触发正确
- 熄屏、解锁、分屏、来电、系统省电、强行停止、重启、撤权后状态没有虚假「管理中」
- 不干预微信正在编辑的内容；暂停按钮始终可用
- 记录理由、无意识分类、镜湖星星黑洞、昨日事项、周/月折叠重启后仍在
- 正式签名覆盖升级数据不丢失；清除数据与卸载后记录被删除

GitHub 构建和模拟器测试不能替代这些真机验收，也不代表商店审核已通过

## 构建环境与产物

- Node 24、pnpm（按 packageManager）、JDK 17、Gradle 8.11.1、Android SDK 36
- `pnpm android:assets` 生成仅包含本地资源的 UI 与共享规则引擎
- `gradle -p apps/android assembleDebug lintDebug` 生成测试 APK
- GitHub Actions 自动构建、校验签名与 SHA256，并在 Android 15 模拟器安装启动和测试本地引擎/SQLite
- CI 不上传签名私钥，也不自动向任何商店提交应用
