import { CheckCircle, RefreshCw, Camera } from "lucide-react";

type Props = {
  label: string;
  image: string | null;
  setImage: React.Dispatch<React.SetStateAction<string | null>>;
  captureLabel: string;
  onCapture: (setter: React.Dispatch<React.SetStateAction<string | null>>) => void;
  onRetake: (setter: React.Dispatch<React.SetStateAction<string | null>>) => void;
  compact?: boolean;
};

export function PhotoCaptureCard({
  label,
  image,
  setImage,
  captureLabel,
  onCapture,
  onRetake,
  compact = false
}: Props) {
  return (
    <div
      className={
        compact
          ? "mt-2"
          : "bg-white p-4 rounded-lg border border-border-muted"
      }
    >
      {!compact && (
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-sm">{label}</p>
          {image && <CheckCircle className="w-5 h-5 text-green-500" />}
        </div>
      )}

      {compact && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-text-muted">{label}</p>
          {image && <CheckCircle className="w-4 h-4 text-green-500" />}
        </div>
      )}

      {image ? (
        <div className="flex items-center gap-3">
          <img
            src={image}
            className="w-20 h-20 object-cover rounded-md border"
            alt={label}
          />
          <button
            type="button"
            onClick={() => onRetake(setImage)}
            className="flex items-center gap-1 text-sm font-bold text-accent-blue-light"
          >
            <RefreshCw className="w-4 h-4" />
            再撮影
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onCapture(setImage)}
              aria-label={captureLabel}
              className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform ring-4 ring-blue-100"
            >
              <Camera className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
