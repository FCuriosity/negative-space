# 开发指南

## 界面与可用性

- 纸白底色、墨色正文、深青侧栏与朱砂主按钮；标题采用中文衬线字，计时与配额数字保持清晰。
- 首页优先呈现专注、今日要事和每日配额；应用与浏览器接入移至「连接管理」，首页保留连接状态入口。
- 侧栏按日常、回顾、管理分组，图标与中文名称同时显示。配额支持全部、电脑应用、网站筛选。
- 统一表单边界、键盘焦点提示、弹窗焦点限制与关闭后返回；支持系统减少动态效果和增强对比度偏好。
- 已抽查主要文字配色对比度：正文约 12.6:1、辅助文字约 5.2:1；已检查 860×680 最小桌面窗口。这不代表完整无障碍认证或已通过商店审核。

## 品牌图标

- 唯一矢量源为 `apps/desktop/public/brand/liubai-icon.svg`，原样保留用户确定的第三版文件：深绿 `#1B5143`、米白 `#F7F2E7`、右上开口单层框及透明圆角外侧。
- 侧栏、加载页和浏览器页签直接引用 SVG；Mac 应用通过 `CFBundleIconFile` 使用 `Liubai.icns`，浏览器扩展使用对应尺寸 PNG。侧栏文字和布局保持原样。
- `pnpm icons:build` 使用项目自带 Tauri SVG 渲染器直接导出各个尺寸；同时导出 ICNS。没有从小 PNG 放大，也没有重绘路径。生成资源纳入版本管理，正常构建无需重新生成。
- Windows 使用同一份已确定的图标 PNG 封装 ICO，没有重绘图案。Tauri 入口保留，实际 Windows 安装包使用 Electron + .NET 原生适配器。


## 开发与运行

需要 Node.js 24、pnpm 11；Mac 构建额外需要 Xcode Command Line Tools（Swift）。

```sh
pnpm install
pnpm dev           # http://127.0.0.1:1420，网页预览不执行电脑应用限制
pnpm test          # 领域、记录、网页配额与原生执行循环测试
pnpm check         # 类型检查
pnpm build         # 网页与扩展构建
pnpm macos:build   # Swift + JavaScriptCore + WKWebView，生成 dist/留白.app
pnpm macos:package # 生成本机架构 DMG
pnpm windows:build # Windows 上构建，需要 .NET 8 SDK
npm install --prefix apps/windows
# Windows 上打包：apps/windows/node_modules/.bin/electron-builder --projectDir apps/windows --win nsis --x64 --publish never
pnpm macos         # 打开 Mac 应用
pnpm test:macos    # 专用测试程序验证正常退出、拒绝退出及进程身份核对
```

Mac 应用内包含界面与规则引擎，运行时不依赖开发服务器、Node 或浏览器扩展。当前只做本机 ad hoc 签名，DMG 尚未做 Developer ID 签名、公证；Windows 安装包尚未做 Authenticode 签名。

Windows 由 `apps/windows` 运行相同界面和规则引擎，C# 适配器读取前台、空闲与锁屏状态，使用 WM_CLOSE 请求正常关闭，核对 PID、启动时间和路径后才执行明确确认的强制退出。浏览器采用 Native Messaging + 本机命名管道。它不会修改系统防火墙或提升管理员权限；管理员权限运行的应用可能无法管理。自动构建包含真实 Win32 采样与界面启动测试，具体第三方应用版本仍需 Windows 用户验收。`apps/desktop/src-tauri` 是保留的旧入口，不用于发布。

## 浏览器扩展

运行 `pnpm extension:build` 后，在 Chrome / Edge 开发者模式点击留白中的「打开扩展文件夹」，加载该目录（源码开发时是 `dist/extension`），主动开启需要的过滤项。设置仅存本机，暂不与桌面同步。站点选择器尚未逐站实测，网站更新可能使过滤失效。

## 代码入口

- `apps/macos/main.swift`：Mac 窗口、菜单栏、SQLite、受限消息桥、每秒采样与退出执行。
- `apps/macos/System.swift`：应用识别、前台/空闲观测、进程身份核对。
- `apps/macos/runtime.ts`：JavaScriptCore 调用接口。
- `packages/core/src/native-engine.ts`：原生权威状态、采样汇总、次数、休息、提醒与临时放行。
- `apps/desktop/src`：中文界面、规则编辑、原生应用面板与挑战。
- `packages/core/tests`、`tests/macos`：规则边界和真实系统接口测试。
- [架构与边界](ARCHITECTURE.md)。

代码自主编写，未复制前述研究项目源码。第三方依赖由 `pnpm-lock.yaml` 固定；尚未为该产品决定最终发布许可证。
