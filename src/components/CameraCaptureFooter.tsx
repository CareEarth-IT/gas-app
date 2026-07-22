import { Camera } from "lucide-react";

type Props = {
  isCameraActive: boolean;
  onStartCamera: () => Promise<boolean> | void;
  onCapture: () => void;
  compact?: boolean;
};

export function CameraCaptureFooter({
  isCameraActive,
  onStartCamera,
  onCapture,
  compact = false
}: Props) {
  return (
    <div className={`bg-white ${compact ? "p-4 space-y-2" : "p-6 space-y-3"}`}>
      {!isCameraActive && (
        <button
          type="button"
          onClick={() => void onStartCamera()}
          className="w-full py-3 bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center gap-2"
        >
          <Camera className="w-5 h-5" />
          カメラを起動
        </button>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onCapture}
          disabled={!isCameraActive}
          className="w-16 h-16 bg-white rounded-full border-4 border-accent-blue-light flex items-center justify-center disabled:opacity-40"
          aria-label="撮影"
        >
          <div className="w-12 h-12 bg-accent-blue-light rounded-full" />
        </button>
      </div>
    </div>
  );
}
