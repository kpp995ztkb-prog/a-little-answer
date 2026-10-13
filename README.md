# 答案之镜 · A Little Answer

一个用实时摄像头和身体动作完成许愿、获得答案并留下纪念卡的互动网页。

[![在线体验 · 答案之镜](https://raw.githubusercontent.com/kpp995ztkb-prog/a-little-answer/main/docs/images/try-now.svg)](https://kpp995ztkb-prog.github.io/a-little-answer/)

![答案之镜横版纪念卡设计预览](https://raw.githubusercontent.com/kpp995ztkb-prog/a-little-answer/main/public/art/wish-collage-landscape.png)

*纪念卡设计预览：实际体验会加入你的许愿截图、名字、时间和答案。*

[联系作者](mailto:elenadai0524@gmail.com)


## 如何体验

1. 用电脑 Chrome 或 Edge 打开[在线体验](https://kpp995ztkb-prog.github.io/a-little-answer/)，允许摄像头访问。
2. 输入名字，按 Enter，实时画面缩小进入白色镜框。
3. 双手合拢或交握放在胸前，闭眼默想一个问题，保持约 1.5 秒。
4. 准备好时睁眼，答案会在镜子里浮现；完整显示 3 秒后出现专属纪念卡。
5. 点击「再问一次」继续，名字会保留，答案不会与上次重复。

首次打开需要加载本地识别模型。脸、肩膀和双手需要进入镜头；手机仅做布局适配，尚未实机验证。

## 功能与隐私

- 白色镜框、粉色拼贴与缓慢浮动的装饰物，闭眼许愿时镜子轻微放大。
- 60 条随机答案，白色发光文字呈现。
- 纪念卡包含闭眼瞬间的截图、名字、许愿时间和答案；电脑横版、竖屏竖版。
- 动作识别在浏览器本地完成，不上传摄像头画面；截图仅保留在当前页面内存中，刷新即清除。

## 技术

原生 JavaScript、Canvas 2D、MediaPipe Tasks Vision 与 Vite。GitHub Actions 自动测试、构建并发布到 GitHub Pages。

## 在线体验与分享

分享地址：https://kpp995ztkb-prog.github.io/a-little-answer/

打开网页后允许摄像头访问，推荐使用电脑 Chrome 或 Edge。截图与动作识别均在浏览器本地处理。首次打开会加载识别模型，请等待加载完成。

仓库已公开并启用 Pages，由 `.github/workflows/deploy.yml` 自动部署：推送到 `main` 后安装依赖、运行单元测试并以 `/a-little-answer/` 为资源路径构建。发布进度和失败日志见仓库 Actions；托管来源为 Settings → Pages → GitHub Actions。

## 本地启动

需要 Node.js 22.12+（或 24 LTS）与 npm。

```sh
git clone https://github.com/kpp995ztkb-prog/a-little-answer.git
cd a-little-answer
npm ci
npm run dev
```

打开终端显示的 localhost 地址（默认 http://127.0.0.1:5173），页面会直接请求摄像头访问，允许后进入昵称页。进入后填写昵称，按 Enter 确认。脸、肩膀、双手需要进入镜头；双手合拢或交握放在胸前，轻轻闭眼停留。点亮后可放下双手，准备好时睁眼。

摄像头需要 localhost 或 HTTPS。远程 HTTP 页面无法使用摄像头。第一版优先验证电脑 Chromium 浏览器；手机仅做布局适配，尚未实机验证。

## 验证与构建

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run build
npm run preview
```

如果机器上已有 Google Chrome，可使用 `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`。

自动验证分两层：Node 测试状态与身体比例判断；浏览器测试用生成的实时视频和注入的识别观测验证页面流程，另外独立运行真实 MediaPipe Worker 加载三份模型并处理空画面，确认没有外部请求。生产构建移除测试注入分支，没有调试按钮或模拟仪式入口。

## 实机验收

以下需要真人使用摄像头验证，目前未宣称通过：

- 明亮、昏暗环境以及佩戴眼镜时的闭眼与睁眼判断。
- 不同距离的胸前双手合拢与交握遮挡。
- 普通眨眼、单手、睁眼合手、双手举过头顶不误触。
- 脸离开镜头后继续等待，回来闭眼不揭晓，正常睁眼才揭晓。
- 多次提问不残留触发记录，昵称保留，镜框内的镜头比例自然，纪念卡截图对应闭眼许愿瞬间。

识别使用置信度和身体比例阈值，无法保证每种光照与遮挡都准确。阈值集中在 `src/observation.js`，仪式时长在 `src/ritual.js`。交握时手模型可能只检测到一只手，通过手模型与两只手腕、手掌的身体关键点共同确认交握；肘部可在镜头范围之外。已开始保持后，允许最多 250ms 的胸前手部识别抖动，持续遮挡或睁眼会重新计时。仪式提示与识别状态保留在程序中，当前画面隐藏提示文字。

## 文件结构

- `src/main.js`：摄像头、输入、页面阶段和控件。
- `src/renderer.js`：实时镜头合成、白色镜框、装饰动画及许愿截图。
- `src/ritual.js`：独立的仪式状态与持续时间。
- `src/observation.js`：眼部状态、身体比例、胸前双手判断。
- `src/tracker.js` 与 `public/vision-worker.js`：约 10fps 本地推理，一帧在途。
- `src/answers.js`：60 条答案，排除上次结果。

## 本地识别资源

页面不上传镜头，也不连接外部识别 API。许愿截图仅保留在当前页面内存中，用于纪念卡展示，刷新页面即清除。模型与 WASM 随静态资源部署，首次打开需要下载约 30MB 资源（public 共约 39MB，包含多个 WASM 变体）。换版本时使用 `npm run prepare:vision` 重新复制包内运行文件。

MediaPipe Tasks Vision 固定为 0.10.32，Apache-2.0。使用官方公开模型版本 1：

- [Face Landmarker 模型](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task)
- [Pose Landmarker Lite 模型](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task)
- [Hand Landmarker 模型](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task)

Worker 使用包内 CommonJS 的浏览器兼容导出，以保留 WASM 加载器依赖的 classic-worker `importScripts`。模型初始化失败或超时会显示重试；识别帧超时、脸部丢失、切换标签页都不会被解释为睁眼。

实现设计见 `docs/crystal-ball-design.md`。

## 反馈与贡献

体验问题或功能建议可提交 [Issue](https://github.com/kpp995ztkb-prog/a-little-answer/issues)。请附上浏览器版本、设备、复现步骤与报错信息。代码修改请通过 Pull Request 提交，并运行上述验证命令。

## 许可与资源

当前尚未为项目代码和视觉素材指定统一开源许可证；仓库公开不代表已授权任意再分发。第三方依赖遵循各自许可证：MediaPipe 使用 Apache-2.0，字体许可文件见 `public/fonts/LICENSES/`。视觉素材包含参考图衍生与生成资源。

## 作者

Bunny 馨子 · [GitHub](https://github.com/kpp995ztkb-prog) · [elenadai0524@gmail.com](mailto:elenadai0524@gmail.com)
