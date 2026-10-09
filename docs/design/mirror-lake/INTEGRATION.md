# 镜湖人物资产接入记录

## 接入范围

沿用现有 React 19 + SVG 场景（960 × 560）、Vite 前端构建及 Mac WKWebView + esbuild 打包。未新增页面，未使用整张设计图替代背景。保留天空、湖面、两个罐子、统计、原可见文案、原光影演示和业务交互。原无障碍描述中的“金发少年”随新资产改为“围巾少年”。

## 本次文件

- `apps/desktop/src/MirrorLake.tsx`：移除旧路径人物及其专用渐变；引用新组件；立姿和倒影使用同一 SVG 源图层。
- `apps/desktop/src/MirrorLakeCharacter.tsx`：三态透明 PNG 叠合、锚点、输入裁剪、倒影和渐隐遮罩。
- `apps/desktop/src/mirror-lake-character.css`：900–1000 ms 光照过渡及减少动态效果支持。
- `apps/desktop/src/assets/mirror-lake/mirror-character-{dark,mid,bright,mask}.png`：交付原图，未经裁剪、压缩或重绘；mask 保留供后续使用，当前不加载到运行时。
- `scripts/build-macos.mjs`：为 PNG 增加本地文件打包，资源输出到应用包的 `web/assets/`。只改资源加载配置。
- `apps/desktop/tests/mirror-lake-character.test.ts`：状态端点、插值连续性、可逆性、越界输入与脚部锚点检查。
- `vitest.config.ts`：将上述桌面组件测试纳入现有测试命令。
- `docs/design/mirror-lake/asset-manifest.json`：保留原交付清单；其中路径仍按原交付包解释，不是运行时配置。
- 本文档。

## 真实状态与混合映射

上层继续使用 `mirrorLake(state, now, todayOnly).light`，其现有公式为 `clamp((stars - holes) / 5, 0, 1)`。星星与黑洞的来源、去重、保留期和用户确认规则未变。原页面的光影演示仍可临时覆盖画面亮度，既有真实亮度条始终显示真实数据。

`MirrorLakeCharacter` 接收 `illumination`，不读写记录、不计算奖惩。`smoothstep(a,b,x)` 用裁剪后的三次平滑曲线 `t²(3−2t)`：

| 图层 / 效果 | 映射 |
| --- | --- |
| 暗态图 | opacity = 1 |
| 过渡态图 | smoothstep(0.08, 0.55, illumination) |
| 明态图 | smoothstep(0.55, 0.98, illumination) |
| 倒影透明度 | 0.07 + 0.35 × illumination |
| 倒影模糊 | 2.1 − 1.75 × illumination（SVG 场景单位） |
| 水面柔光 | 复用原场景已有亮度响应与配色 |

## 锚点与倒影

完整 PNG 画布 1024 × 1536，显示尺寸 128 × 192，保持 2:3 比例。三层均使用 `x = -128 × 0.4668`、`y = -192 × 0.9310`。图层局部原点即脚部锚点，上层将其置于 `(480, 329)`，对齐场景中心及原水岸。

倒影对同一个 SVG `<g>` 使用 `<use>`，从同一锚点垂直翻转，`scaleY = -0.76`。沿用湖面裁剪及水纹，新增人物专属纵向衰减遮罩，避免亮态脸部在远端被完全抹去。页面缩小时整张 SVG 同比例缩放，人物和倒影不会分别漂移。

## 验证

- 四张 PNG 均为 1024 × 1536 RGBA；四角透明；alpha 逐像素相同。三张人物图的可见区域平均亮度逐级增加。
- `pnpm test`：15 个测试文件、135 项测试通过，包含新增 4 项人物测试。
- `pnpm macos:build`：TypeScript、Vite、扩展及 Mac 原生构建通过，PNG 已打包为本地资源。
- 独立验收页面渲染原 `MirrorLake` 组件，检查 0%、40%、100% 和亮暗往返；仅使用虚构内存数据，未修改本机真实记录。
- 390 px 视口下没有横向溢出，三层边界相同，人物脚部与倒影保持对齐，围巾不覆盖两罐文字。
- `reducedMotion` 显式退化检查的过渡时间为 0s；CSS 同时支持系统 `prefers-reduced-motion`。
- 审阅截图保存在项目外的 `outputs/mirror-lake-review/`，对应 0%、40%、100% 及窄屏。浏览器截图缩放限制使桌面场景导出为 484 × 354，不代表原图分辨率。

## 可微调参数与验证边界

没有新增待定业务权重。可按审美反馈继续微调：人物画布高度 192、倒影压缩 0.76、透明度范围 0.07–0.42、模糊范围 2.1–0.35、两段混合阈值及 900–1000 ms 过渡时长。脚部锚点 0.4668 / 0.9310 属于资产对齐契约，不应随意调整。

Mac 打包过程中，文件提供程序曾向应用目录重新写入 FinderInfo，导致一次签名失败；重新完整构建成功；复制到不受同步管理的临时目录后，`codesign --verify --deep --strict` 校验通过，确认包内代码与资源签名有效。原 dist 目录的同步属性仍可能被系统重新写入。当前运行中的旧应用尚未成功重启，因此原生窗口内新资源显示仍待重启后复核；本次已验证本地网页渲染和资源打包路径。

## 2026-10-09：女性形象与银河增强

### 人物选择

- 「偏好设置 → 镜湖人物 → 人物形象」提供男性 / 女性选项。
- 复用全局 `AppState.settings.mirrorLakeCharacterGender`；允许 `male` / `female`，旧数据及新用户默认 `male`。通过已有 repository 与原生 SQLite 状态序列化保存，备份导入导出也保留选择。
- 两套素材共用原亮度插值、SVG 脚部锚点和镜像倒影；切换不改变星光、黑洞、规则、用时或奖励。
- 女性交付 PNG 的 alpha 不完全一致，脚底约在原画布 y=1480，而声明锚点为 y≈1430。保留原文件，运行时采用交付的 bright mask 统一外轮廓并抑制极低透明度杂点，整套图层上移 6.25 个 SVG 场景单位校准脚部。所有状态与倒影应用同一个校准，未分别裁剪或移动图片。内部像素存在轻微差异，不能宣称女版三态逐像素完全一致。

### 星空

- 参考增强包背景的靛蓝、冷紫及橙粉余晖，调整 SVG 主渐变。
- 2,700 个位置固定的细星点，搭配不规则星云结团、颗粒纹理和暗尘带，替代上一版均匀云带；少量亮星使用小尺寸柔光。
- 银河仍由 SVG 生成，参考图没有作为页面背景。天空和湖面共用同一组星空定义，光照仍来自原来的 `mirrorLake(...).light` 及既有演示覆盖。
- 无持续粒子移动；亮度过渡继续遵守减少动态效果设置。

### 修改文件与检查

`App.tsx`、`MirrorLake.tsx`、`MirrorLakeCharacter.tsx`、`mirror-lake-character.css`、`MirrorLakeSky.tsx`；新增 `assets/mirror-lake/female/` 四张原始 PNG；核心 `model.ts`、`seed.ts`、`state.ts` 和 `personalization.test.ts`；本文档。

138 项测试通过，包括旧备份默认值、无效值拒绝、女性偏好的原生保存 / 重启及业务状态不变。网页实测设置切换后重新打开仍保留女性、男女切换、明暗端点和 390 px 视口。完整 Mac 构建通过。对比截图位于 `outputs/mirror-lake-review/enhanced-female-bright.png` 与 `enhanced-male-bright.png`，使用独立虚构记录。

没有待定业务公式；可按后续审美反馈调整银河密度、云团强度与人物尺寸。
