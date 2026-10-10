/* MediaPipe Tasks Vision 0.10.32. Input frames stay in this browser. */
let face, pose, hand;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      importScripts(new URL('vision/vision_bundle.js', data.base).href);
      const files = await vision.FilesetResolver.forVisionTasks(new URL('vision/wasm', data.base).href);
      const options = name => ({
        baseOptions: { modelAssetPath: new URL(`models/${name}`, data.base).href, delegate: 'CPU' },
        runningMode: 'VIDEO', minTrackingConfidence: 0.55,
        canvas: new OffscreenCanvas(1, 1),
      });
      face = await vision.FaceLandmarker.createFromOptions(files, {
        ...options('face_landmarker.task'), numFaces: 1, outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.6, minFacePresenceConfidence: 0.6,
      });
      pose = await vision.PoseLandmarker.createFromOptions(files, {
        ...options('pose_landmarker_lite.task'), numPoses: 1,
        minPoseDetectionConfidence: 0.6, minPosePresenceConfidence: 0.6,
      });
      hand = await vision.HandLandmarker.createFromOptions(files, {
        ...options('hand_landmarker.task'), numHands: 2,
        minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message });
    }
    return;
  }
  if (data.type === 'frame') {
    const bitmap = data.bitmap;
    try {
      const result = face.detectForVideo(bitmap, data.at);
      const expressions = result.faceBlendshapes[0]?.categories ?? [];
      const blink = name => expressions.find(c => c.categoryName === name)?.score;
      const body = data.handsRequired ? pose.detectForVideo(bitmap, data.at).landmarks[0] ?? [] : [];
      const hands = data.handsRequired ? hand.detectForVideo(bitmap, data.at).landmarks : [];
      self.postMessage({
        type: 'sample', at: data.at, generation: data.generation,
        frame: { faceValid: result.faceLandmarks.length === 1, leftBlink: blink('eyeBlinkLeft'), rightBlink: blink('eyeBlinkRight'), pose: body, hands, width: bitmap.width, height: bitmap.height },
      });
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message });
    } finally { bitmap.close(); }
  }
};
