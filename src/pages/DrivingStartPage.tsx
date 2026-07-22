import { motion } from "motion/react";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";

import {
  drivingStartStepFromScreen,
  screenFromDrivingStartStep,
  type DrivingStartStep
} from "../lib/drivingStartNavigation";
import { Screen } from "../types";

type StepConfig = {
  step: DrivingStartStep;
  stepNumber: number;
  title: string;
  description: string;
  exampleImages?: { src: string; caption: string }[];
  exampleCaption?: string;
};

const STEP_CONFIG: StepConfig[] = [
  {
    step: "alcohol",
    stepNumber: 1,
    title: "アルコールチェック",
    description: "アルコールチェッカーの結果画面を撮影してください。",
    exampleCaption:
      "チェッカーの結果がはっきり写るように、画面全体を撮影してください。"
  },
  {
    step: "fuel",
    stepNumber: 2,
    title: "燃料・走行距離",
    description:
      "燃料メーター（F〜E）とオドメーター（ODO）の両方が1枚に写るように撮影してください。",
    exampleImages: [
      {
        src: "/examples/driving-fuel-meter.png",
        caption: "燃料ゲージ（F〜E）"
      },
      {
        src: "/examples/driving-mileage.png",
        caption: "走行距離（ODO）"
      }
    ],
    exampleCaption:
      "上記のように、燃料ゲージとODOの数値が読み取れる1枚の写真にまとめて撮影してください。"
  }
];

type Props = {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  isCameraActive: boolean;
  alcoholCheckImage: string | null;
  setAlcoholCheckImage: React.Dispatch<React.SetStateAction<string | null>>;
  startMeterImage: string | null;
  setStartMeterImage: React.Dispatch<React.SetStateAction<string | null>>;
  startMileageImage: string | null;
  setStartMileageImage: React.Dispatch<React.SetStateAction<string | null>>;
  startCamera: () => Promise<boolean>;
  stopCamera: () => void;
  capturePhoto: (setter: (val: string) => void) => void;
  isSubmitting: boolean;
  handleDrivingLogSubmit: () => void;
  onBackToMenu: () => void;
};

function getImageForStep(
  step: DrivingStartStep,
  alcoholCheckImage: string | null,
  startMeterImage: string | null
): string | null {
  if (step === "alcohol") return alcoholCheckImage;
  return startMeterImage;
}

export default function DrivingStartPage({
  screen,
  setScreen,
  videoRef,
  isCameraActive,
  alcoholCheckImage,
  setAlcoholCheckImage,
  startMeterImage,
  setStartMeterImage,
  setStartMileageImage,
  startCamera,
  stopCamera,
  capturePhoto,
  isSubmitting,
  handleDrivingLogSubmit,
  onBackToMenu
}: Props) {
  const currentStep = drivingStartStepFromScreen(screen);
  const config = STEP_CONFIG.find((item) => item.step === currentStep)!;
  const capturedImage = getImageForStep(
    currentStep,
    alcoholCheckImage,
    startMeterImage
  );

  const saveCapturedImage = (value: string) => {
    if (currentStep === "alcohol") {
      setAlcoholCheckImage(value);
      return;
    }
    setStartMeterImage(value);
    setStartMileageImage(value);
  };

  const clearCapturedImage = () => {
    if (currentStep === "alcohol") {
      setAlcoholCheckImage(null);
      return;
    }
    setStartMeterImage(null);
    setStartMileageImage(null);
  };

  const goBack = () => {
    stopCamera();
    if (currentStep === "alcohol") {
      onBackToMenu();
      return;
    }
    setScreen(screenFromDrivingStartStep("alcohol"));
  };

  const goNext = () => {
    stopCamera();
    setScreen(screenFromDrivingStartStep("fuel"));
  };

  const handleSubmit = () => {
    stopCamera();
    handleDrivingLogSubmit();
  };

  return (
    <div className="relative flex flex-col h-full bg-bg-app">
      <div className="p-4 bg-white border-b flex items-center gap-3">
        <button onClick={goBack} className="p-2" type="button">
          <ArrowLeft />
        </button>
        <div>
          <p className="text-xs text-text-muted">
            {config.stepNumber} / {STEP_CONFIG.length}
          </p>
          <h2 className="font-bold">{config.title}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 bg-white border-b">
          <p className="text-sm text-text-muted mb-3">{config.description}</p>
          {config.exampleImages ? (
            <div>
              <p className="text-xs font-bold text-text-muted mb-2">撮影例</p>
              <div className="grid grid-cols-2 gap-2">
                {config.exampleImages.map((example) => (
                  <div key={example.src}>
                    <img
                      src={example.src}
                      alt={example.caption}
                      className="w-full h-24 object-contain rounded-lg border bg-slate-50"
                    />
                    <p className="text-[10px] text-text-muted mt-1 text-center">
                      {example.caption}
                    </p>
                  </div>
                ))}
              </div>
              {config.exampleCaption && (
                <p className="text-xs text-text-muted mt-2">
                  {config.exampleCaption}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs font-bold text-text-muted mb-1">
                撮影のポイント
              </p>
              <p className="text-sm">{config.exampleCaption}</p>
            </div>
          )}
        </div>

        <div className="relative bg-black min-h-[16rem]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-64 object-cover ${isCameraActive ? "block" : "hidden"}`}
          />

          {!isCameraActive && !capturedImage && (
            <div className="h-64 flex flex-col items-center justify-center gap-4 px-6 bg-slate-900 text-white">
              <Camera className="w-10 h-10 opacity-80" />
              <button
                type="button"
                onClick={() => void startCamera()}
                className="px-6 py-3 bg-accent-blue text-white font-bold rounded-lg"
              >
                カメラを起動
              </button>
            </div>
          )}
        </div>

        {isCameraActive && !capturedImage && (
          <div className="p-6 bg-white flex flex-col items-center gap-3 border-b">
            <button
              type="button"
              onClick={() => void capturePhoto(saveCapturedImage)}
              className="w-16 h-16 bg-white rounded-full border-4 border-accent-blue-light flex items-center justify-center shadow-md"
              aria-label="撮影"
            >
              <div className="w-12 h-12 bg-accent-blue-light rounded-full" />
            </button>
          </div>
        )}
      </div>

      {capturedImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 z-20"
        >
          <img
            src={capturedImage}
            alt={config.title}
            className="max-h-[55%] rounded-lg shadow-lg mb-6 object-contain"
          />

          <div className="flex gap-4 w-full max-w-xs">
            <button
              type="button"
              onClick={() => {
                clearCapturedImage();
                void startCamera();
              }}
              className="flex-1 py-3 bg-white/90 border rounded-lg font-bold"
            >
              再撮影
            </button>

            {currentStep === "fuel" ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-accent-blue text-white rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                運転開始
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="flex-1 py-3 bg-accent-blue text-white rounded-lg font-bold"
              >
                次へ
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
