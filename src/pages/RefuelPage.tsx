import { motion } from "motion/react";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";

import { CameraCaptureFooter } from "../components/CameraCaptureFooter";

type Props = {
  step:
    | "meter"
    | "receipt"
    | "confirm"
    | "complete";

  videoRef: React.RefObject<HTMLVideoElement>;
  isCameraActive: boolean;

  meterImage: string | null;
  setMeterImage: React.Dispatch<
    React.SetStateAction<string | null>
  >;

  receiptImage: string | null;
  setReceiptImage: React.Dispatch<
    React.SetStateAction<string | null>
  >;

  isSubmitting: boolean;

  startCamera: () => Promise<boolean>;
  stopCamera: () => void;

  capturePhoto: (
    setter: (value: string) => void
  ) => Promise<void>;

  handleRefuelSubmit: () => Promise<void>;

  onBackToMenu: () => void;
  onChangeStep: (
    step:
      | "meter"
      | "receipt"
      | "confirm"
      | "complete"
  ) => void;
};

export default function RefuelPage({
  step,
  videoRef,
  isCameraActive,

  meterImage,
  setMeterImage,

  receiptImage,
  setReceiptImage,

  isSubmitting,

  startCamera,
  stopCamera,

  capturePhoto,
  handleRefuelSubmit,

  onBackToMenu,
  onChangeStep
}: Props) {
  switch (step) {
    case "meter":
      return (
        <div className="flex flex-col h-full bg-black">
          <div className="p-4 bg-white border-b flex items-center gap-3">
            <button
              onClick={() => {
                stopCamera();
                onBackToMenu();
              }}
              className="p-2"
            >
              <ArrowLeft />
            </button>

            <h2 className="font-bold">
              1. メーター撮影
            </h2>
          </div>

          <div className="flex-1 relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
            />
            {!isCameraActive && !meterImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white text-sm px-6 text-center">
                「カメラを起動」から撮影してください
              </div>
            )}
          </div>

          <CameraCaptureFooter
            isCameraActive={isCameraActive}
            onStartCamera={startCamera}
            onCapture={() => void capturePhoto(setMeterImage)}
          />

          {meterImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 z-10"
            >
              <img
                src={meterImage}
                className="max-h-[60%] rounded shadow-lg mb-6"
                alt="メーター"
              />

              <div className="flex gap-4 w-full max-w-xs">
                <button
                  onClick={() => {
                    setMeterImage(null);
                    void startCamera();
                  }}
                  className="flex-1 py-3 bg-white/80 border rounded-lg font-bold"
                >
                  再撮影
                </button>

                <button
                  onClick={() => {
                    stopCamera();
                    onChangeStep("receipt");
                  }}
                  className="flex-1 py-3 bg-accent-blue-light text-white rounded-lg font-bold"
                >
                  OK
                </button>
              </div>
            </motion.div>
          )}
        </div>
      );

    case "receipt":
      return (
        <div className="flex flex-col h-full bg-black">
          <div className="p-4 bg-white border-b flex items-center gap-3">
            <button
              onClick={() => {
                stopCamera();
                onChangeStep("meter");
              }}
              className="p-2"
            >
              <ArrowLeft />
            </button>

            <h2 className="font-bold">
              2. レシート撮影
            </h2>
          </div>

          <div className="flex-1 relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
            />
            {!isCameraActive && !receiptImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white text-sm px-6 text-center">
                「カメラを起動」から撮影してください
              </div>
            )}
          </div>

          <CameraCaptureFooter
            isCameraActive={isCameraActive}
            onStartCamera={startCamera}
            onCapture={() => void capturePhoto(setReceiptImage)}
          />

          {receiptImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 z-10"
            >
              <img
                src={receiptImage}
                className="w-full max-w-xs aspect-[3/4] object-contain mb-4"
                alt="レシート"
              />

              <div className="flex gap-4 w-full max-w-xs">
                <button
                  onClick={() => {
                    setReceiptImage(null);
                    void startCamera();
                  }}
                  className="flex-1 py-3 border rounded-lg font-bold"
                >
                  再撮影
                </button>

                <button
                  onClick={() => onChangeStep("confirm")}
                  className="flex-1 py-3 bg-accent-blue-light text-white rounded-lg font-bold"
                >
                  OK
                </button>
              </div>
            </motion.div>
          )}
        </div>
      );

    case "confirm":
      return (
        <div className="flex flex-col h-full bg-bg-app">
          <div className="p-4 bg-white border-b flex items-center gap-3">
            <button
              onClick={() =>
                onChangeStep("receipt")
              }
              className="p-2"
            >
              <ArrowLeft />
            </button>

            <h2 className="font-bold">
              3. 内容確認
            </h2>
          </div>

          <div className="flex-1 p-6 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-center mb-1">
                  メーター
                </p>

                <img
                  src={meterImage!}
                  className="aspect-square w-full object-cover rounded-lg border"
                  alt="メーター"
                />
              </div>

              <div>
                <p className="text-xs font-bold text-center mb-1">
                  レシート
                </p>

                <img
                  src={receiptImage!}
                  className="aspect-square w-full object-cover rounded-lg border"
                  alt="レシート"
                />
              </div>
            </div>
          </div>

          <div className="p-4 border-t bg-white">
            <button
              onClick={handleRefuelSubmit}
              disabled={isSubmitting}
              className="w-full py-3 bg-accent-blue text-white font-bold text-lg rounded-lg disabled:opacity-40 flex justify-center items-center gap-2"
            >
              {isSubmitting && (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}

              送信する
            </button>
          </div>
        </div>
      );

    case "complete":
      return (
        <div className="m-auto text-center p-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />

          <h2 className="text-xl font-bold mb-2">
            送信完了
          </h2>

          <p className="text-text-muted mb-6">
            給油記録の送信が完了しました。
          </p>

          <button
            onClick={() => {
              setMeterImage(null);
              setReceiptImage(null);
              onBackToMenu();
            }}
            className="px-6 py-3 bg-accent-blue-light text-white rounded-lg font-bold"
          >
            メニューに戻る
          </button>
        </div>
      );

    default:
      return null;
  }
}
