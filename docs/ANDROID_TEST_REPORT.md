# Android alpha1 验证记录

日期：2026-10-12

## 已完成

- TypeScript 检查通过
- 178 项自动化测试通过（其中 6 项 Android 规则适配测试）
- 桌面生产构建通过
- Android SDK 36 / JDK 17 / Gradle 8.11.1 构建与 lintDebug 通过
- APK v2 签名校验与下载 SHA256 校验通过
- Android 15 模拟器安装启动通过
- 原生 WebView 读取首次引导页面正文通过
- 安装包内的真实规则引擎、首次规则保存不自动开启管理、SQLite 落盘通过
- 在模拟器中授权使用情况与悬浮提醒，通过专用测试应用触发真实系统使用事件：首次进入 1 次，回桌面再进入累计 2 次
- 0 次配额触发原生悬浮提醒，暂停后服务和提醒均撤掉
- 390 × 844 浏览器辅助检查：首次三步引导、今天/专注/规则/回顾/镜湖，无脚本异常或横向溢出

模拟器场景使用专门的 fixture，包名模拟微信，仅为测试系统事件，不代表已测试真实微信的全部行为
fixture 没有网络权限，不随留白 APK 分发，绝不要把 fixture 安装到有真实微信的个人手机

## 仍需真机完成

小米/OPPO/vivo/Android 系华为等目标设备的省电、后台回收、分屏、锁屏、实际微信/B站/小红书/抖音切换和厂商悬浮权限页面

首次使用仍需安排一名未看源码的用户完成安装和引导，并独立说明规则何时生效

正式发行签名的覆盖升级、各商店隐私检测和审核未完成

## 复现

`.github/workflows/android.yml` 保留构建、签名、原生测试和截图产物

Android 原生测试在 `apps/android/app/src/androidTest/java/cn/liubai/app/SmokeInstrumentation.java`
系统事件测试 fixture 在 `apps/android/fixture`，只供独立模拟器使用
