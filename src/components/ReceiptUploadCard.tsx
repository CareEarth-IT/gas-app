import { useRef } from "react";
import { CheckCircle, RefreshCw, Upload } from "lucide-react";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

const MAX_FILE_SIZE_MB = 10;

type Props = {
  label: string;
  image: string | null;
  setImage: React.Dispatch<React.SetStateAction<string | null>>;
  compact?: boolean;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("ファイルの読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

export function ReceiptUploadCard({
  label,
  image,
  setImage,
  compact = false
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.has(file.type)) {
      alert("JPEG、PNG、WebP 形式の画像を選択してください。");
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`ファイルサイズは ${MAX_FILE_SIZE_MB}MB 以下にしてください。`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImage(dataUrl);
    } catch {
      alert("ファイルの読み込みに失敗しました。");
    }
  };

  return (
    <div className={compact ? "mt-2" : "bg-white p-4 rounded-lg border border-border-muted"}>
      <div className="flex items-center justify-between mb-2">
        <p
          className={
            compact
              ? "text-xs font-bold text-text-muted"
              : "font-bold text-sm"
          }
        >
          {label}
        </p>
        {image && (
          <CheckCircle
            className={compact ? "w-4 h-4 text-green-500" : "w-5 h-5 text-green-500"}
          />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />

      {image ? (
        <div className="flex items-center gap-3">
          <img
            src={image}
            className="w-20 h-20 object-cover rounded-md border"
            alt={label}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 text-sm font-bold text-accent-blue-light"
          >
            <RefreshCw className="w-4 h-4" />
            再選択
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-3 border-2 border-dashed border-accent-blue-light/40 rounded-md text-sm font-bold text-accent-blue-light flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          領収書をアップロード
        </button>
      )}
    </div>
  );
}
