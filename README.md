# 一颗答案

电脑浏览器里的实时摄像头水晶球体验。默想问题，不输入问题；昵称固定球心，胸前双手靠近与闭眼保持 1.5 秒后点亮，稳定睁眼 0.4 秒后揭晓。内置 60 条答案，再次提问保留昵称并排除上一条答案。

## 本地启动

```sh
npm install
npm run dev
```

打开终端显示的 localhost 地址（默认 http://127.0.0.1:5173），点击「开启镜头」并允许摄像头访问。进入后填写昵称，按 Enter 确认。脸、肩膀、双手需要进入镜头；双手合拢或交握放在胸前，轻轻闭眼停留。点亮后可放下双手，准备好时睁眼。

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
- 多次提问不残留触发记录，昵称不移动，球内与球外镜头比例自然。

识别使用置信度和身体比例阈值，无法保证每种光照与遮挡都准确。阈值集中在 `src/observation.js`，仪式时长在 `src/ritual.js`。交握时手模型可能只检测到一只手，仅在身体模型对双臂、手腕和手掌都有较高置信度时接受双手判断。

## 文件结构

- `src/main.js`：摄像头、输入、页面阶段和控件。
- `src/renderer.js`：实时镜头合成、球体、曲面、镂空及光效。
- `src/ritual.js`：独立的仪式状态与持续时间。
- `src/observation.js`：眼部状态、身体比例、胸前双手判断。
- `src/tracker.js` 与 `public/vision-worker.js`：约 10fps 本地推理，一帧在途。
- `src/answers.js`：60 条答案，排除上次结果。

## 本地识别资源

页面不上传或保存镜头，也不连接外部识别 API。模型与 WASM 随静态资源部署，首次打开需要下载约 30MB 资源（public 共约 39MB，包含多个 WASM 变体）。换版本时使用 `npm run prepare:vision` 重新复制包内运行文件。

MediaPipe Tasks Vision 固定为 0.10.32，Apache-2.0。使用官方公开模型版本 1：

- [Face Landmarker 模型](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task)
- [Pose Landmarker Lite 模型](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task)
- [Hand Landmarker 模型](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task)

Worker 使用包内 CommonJS 的浏览器兼容导出，以保留 WASM 加载器依赖的 classic-worker `importScripts`。模型初始化失败或超时会显示重试；识别帧超时、脸部丢失、切换标签页都不会被解释为睁眼。

实现设计见 `docs/crystal-ball-design.md`。
