export function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return (
          "カメラへのアクセスが拒否されています。\n" +
          "アドレスバー左の 🔒 → カメラ →「許可」に変更してから、もう一度お試しください。"
        );
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "カメラが見つかりません。別の端末をお試しください。";
      case "NotReadableError":
      case "TrackStartError":
        return "カメラが他のアプリで使用中です。他のアプリを閉じてからお試しください。";
      case "OverconstrainedError":
        return "この端末のカメラ設定に対応できません。別の端末をお試しください。";
      case "SecurityError":
        return "HTTPS でアクセスしているか確認してください。";
      default:
        break;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "カメラを起動できませんでした。「カメラを起動」を押してから撮影してください。";
}

export async function requestCameraStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: { facingMode: "environment" }, audio: false },
    { video: { facingMode: "user" }, audio: false },
    { video: true, audio: false }
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      console.warn("getUserMedia attempt failed:", constraints, error);
    }
  }

  throw lastError ?? new Error("カメラを起動できませんでした");
}
