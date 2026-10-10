# Crystal Ball Implementation Plan

**Goal:** 实现已确认的实时镜头水晶球仪式，昵称固定球心，姿势与睁眼驱动答案。

**Architecture:** Vite 单页面应用，Canvas 负责镜头和球体，HTML 负责键盘及可读文本。纯状态机消费本地识别观测；MediaPipe 在独立 Worker 中运行，静态模型和 WASM 随页面部署。

**Tech Stack:** JavaScript、Canvas 2D、Vite、MediaPipe Tasks Vision、Node test runner、Playwright。

## 1. 状态转换与观测

- [x] `tests/ritual.test.js`：连续姿势 1500ms 触发，点亮 1500ms，睁眼 400ms；中断/丢失重置保持；提前睁眼缓存；阅读只锁定一条；重置清理；观测间隔大于 350ms 不算连续。
- [x] 执行 `node --test tests/ritual.test.js`，确认缺少实现导致失败。
- [x] `src/ritual.js`：实现 `Ritual.start(now)`、`observe(sample, now)`、`tick(now)` 和 `reset(now)`；时间全部使用单调毫秒时钟。
- [x] `tests/observation.test.js` 与 `src/observation.js`：像素宽高比修正、肩宽归一化，验证单手/头顶/远近缩放、闭眼阈值和不确定眼部状态。
- [x] 执行 `npm test`，所有边界场景通过。

## 2. 镜头与视觉

- [x] 创建 `index.html`、`src/main.js`、`src/style.css`：授权入口，错误重试，真实昵称输入与 IME，提交和重置。空白不可提交，Unicode 12 字限制。
- [x] 创建 `src/renderer.js`：镜像背景；单一球体连续拉远；球内缩小曲面画面；分层深色底座；颗粒薄膜与镂空字形；昵称固定；暖金光、克制粒子和薄雾。
- [x] 创建 `src/answers.js`，60 条答案，抽取排除上一条。
- [x] 创建 `tests/content.test.js`，验证昵称和答案边界；执行 `npm test`。

## 3. 本地识别

- [x] 安装固定版本依赖；`scripts/prepare-vision.mjs` 将包内 WASM/JS 复制到 public/vision。
- [x] 下载官方脸、手、轻量身体模型到 public/models，记录来源。
- [x] `public/vision-worker.js` 依次加载模型，收到 ImageBitmap 后输出眼部系数、双手与躯干坐标；关闭每个帧，单帧在途。
- [x] `src/tracker.js` 限制推理到约 10fps，仅等待与点亮阶段使用；失败显示重试，失去人脸不产生睁眼。

## 4. 交付验证

- [x] `npm run build`，静态构建通过。
- [x] `tests/browser.spec.js` 用摄像头替身确认真实授权流程、昵称限制、镂空更新、拉远与重置；注入观测验证提前睁眼及答案隐藏，调试入口只出现在测试注入环境。
- [x] 浏览器截图检查开场、透明球和答案阶段，检查 console 与 worker 运行。
- [x] `README.md` 写明启动方式与实机验收项，明确未实测的眼镜/明暗/交握条件。
