import { useCallback, useRef, useState } from "react";

import {
  cameraErrorMessage,
  requestCameraStream
} from "../lib/cameraUtils";
import { isValidImageDataUrl } from "../lib/imageUtils";

async function waitForVideoElement(
  getVideo: () => HTMLVideoElement | null,
  maxAttempts = 40
): Promise<HTMLVideoElement | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const video = getVideo();
    if (video) return video;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

async function waitForVideoFrame(video: HTMLVideoElement): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    if (video.videoWidth > 0 && video.readyState >= 2) return true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return video.videoWidth > 0;
}

async function attachStreamToVideo(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<void> {
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.muted = true;
  video.srcObject = stream;

  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      video.removeEventListener("loadedmetadata", onReady);
      resolve();
    };
    video.addEventListener("loadedmetadata", onReady);
    video.onerror = () => reject(new Error("video error"));
  });

  await video.play();
}

export function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert(
        "このブラウザではカメラが使えません。HTTPSでアクセスしているか確認してください。"
      );
      return false;
    }

    stopCamera();

    let stream: MediaStream | null = null;
    try {
      stream = await requestCameraStream();

      const video = await waitForVideoElement(() => videoRef.current);
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        alert(
          "カメラ画面の準備に失敗しました。少し待ってからもう一度お試しください。"
        );
        return false;
      }

      await attachStreamToVideo(video, stream);
      const ready = await waitForVideoFrame(video);
      if (!ready) {
        stopCamera();
        alert(
          "カメラの映像を取得できませんでした。ブラウザのカメラ許可を確認してください。"
        );
        return false;
      }

      setIsCameraActive(true);
      return true;
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      console.error("Camera start failed:", error);
      alert(cameraErrorMessage(error));
      setIsCameraActive(false);
      return false;
    }
  }, [stopCamera]);

  const capturePhoto = useCallback(
    async (
      setter: (value: string) => void,
      options?: { keepCameraOpen?: boolean }
    ): Promise<void> => {
      let video = videoRef.current;

      if (!video || video.videoWidth === 0 || !isCameraActive) {
        const started = await startCamera();
        if (!started) {
          return;
        }
        video = videoRef.current;
      }

      if (!video || !(await waitForVideoFrame(video))) {
        alert(
          "カメラの準備ができていません。「カメラを起動」を押してから撮影してください。"
        );
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      if (isValidImageDataUrl(dataUrl)) {
        setter(dataUrl);
        if (!options?.keepCameraOpen) {
          stopCamera();
        }
      }
    },
    [isCameraActive, startCamera, stopCamera]
  );

  return {
    videoRef,
    canvasRef,
    isCameraActive,
    startCamera,
    stopCamera,
    capturePhoto
  };
}
