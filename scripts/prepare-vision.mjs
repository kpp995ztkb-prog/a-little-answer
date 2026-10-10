import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('public/vision', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/vision/wasm', { recursive: true });
// The pinned package ships ESM and CommonJS. Adapt its exports for a classic
// worker, which MediaPipe's WASM loader needs for importScripts().
const bundle = await readFile('node_modules/@mediapipe/tasks-vision/vision_bundle.cjs', 'utf8');
await writeFile('public/vision/vision_bundle.js', `var exports = {};\n${bundle}\nself.vision = exports;\n`);
console.log('Local MediaPipe runtime copied.');
