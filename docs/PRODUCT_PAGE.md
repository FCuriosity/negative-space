# 产品展示页与真实录屏

页面位于 `docs/product/index.html`，是独立静态 HTML / CSS，不依赖应用运行时，不加载第三方字体、统计脚本或外部图片。

## 本地预览

在仓库根目录执行：

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory docs/product
```

打开 `http://127.0.0.1:4173`。也可直接在浏览器打开 `docs/product/index.html`。

当前视频素材由产品作者提供，收到前展示清楚标识的待补充状态，没有虚构视频或不可播放的按钮。公开入口为 https://fcuriosity.github.io/negative-space/product/ 。

## 录制一条完整路径

建议录制 1—3 分钟原片，成片剪到 30—60 秒。使用真实桌面应用，提前隐藏个人聊天、账号资料、通知与私人记录；不要在网页模拟器中假装应用已经被系统拦截。

| 成片节奏 | 真实操作 |
| --- | --- |
| 0—7 秒 | 输入一个具体任务，开始专注 |
| 7—14 秒 | 顺手点开一个受管理应用，出现提醒 |
| 14—28 秒 | 选「无意识，但改邪归正」，点击「记录理由，关闭应用」 |
| 28—36 秒 | 回到刚才的任务，继续操作 |
| 36—48 秒 | 专注完成，写一句心得 |
| 48—55 秒 | 打开镜湖，看到刚刚增加的星光 |

时间是剪辑参考，以实际操作为准。可剪掉等待，不更改计时器、星光数字或拦截结果；如压缩了等待，字幕注明「等待片段已剪短」。不要使用镜湖的演示亮度冒充真实专注结果。

## 接入成片

1. 输出 `docs/product/assets/walkthrough.mp4`，H.264、无私人内容、30—60 秒，建议 1080p，尽量控制在 20 MB 内。
2. 从真实视频提取 `walkthrough-poster.jpg`，不额外伪造应用界面；添加与实际剪辑同步的中文字幕 `walkthrough.zh-CN.vtt`。
3. 将 `index.html` 中的 `.video-pending` 区块替换为：

```html
<video controls playsinline preload="metadata"
  poster="assets/walkthrough-poster.jpg"
  aria-label="留白真实使用录屏：开始专注、收到提醒、主动关闭应用、回到任务与镜湖变化">
  <source src="assets/walkthrough.mp4" type="video/mp4">
  <track kind="captions" src="assets/walkthrough.zh-CN.vtt"
    srclang="zh-CN" label="中文" default>
  你的浏览器不支持视频播放，请<a href="assets/walkthrough.mp4">下载观看</a>。
</video>
```

4. README 将待补充段落替换为真实视频封面与视频链接。GitHub README 不保证内嵌 HTML 视频可播放，可用封面链接到视频文件；有公共展示页后再链接到页面。
5. 检查桌面与手机播放、字幕、时长、声音、所有下载链接和素材隐私。视频不会自动播放。

## 托管

GitHub Pages 使用 `main` 分支的 `/docs` 目录发布；`docs/.nojekyll` 使文件按静态资源原样发布。`docs/index.html` 将网站根入口跳转到 `product/`，页面自身继续使用相对资源路径。

公开地址：https://fcuriosity.github.io/negative-space/product/

提交到主分支后，GitHub 的 `pages build and deployment` 自动发布更新。页面中下载按钮指向 Releases 列表，包含预发布安装包；不使用排除预发布版本的 `/releases/latest` 入口。
