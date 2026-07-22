import { motion } from "motion/react";
import {
  Camera,
  RefreshCw,
  CheckCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ArrowDown
} from "lucide-react";

import { ETC_CATEGORIES, ETC_CATEGORY_OTHER, isEtcCategoryOther } from "../../shared/etcCategories";
import { Screen, EtcStep } from "../types";

type Props = {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  setEtcStep: (step: EtcStep) => void;

  handleEtcStart: () => void;
  handleEtcSubmit: () => void;

  currentTime: Date;
  gpsTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;

  videoRef: React.RefObject<HTMLVideoElement>;
  isCameraActive: boolean;
  startCamera: () => Promise<boolean> | void;
  stopCamera: () => void;
  capturePhoto: (
    setter: (val: string) => void,
    options?: { keepCameraOpen?: boolean }
  ) => Promise<void>;

  etcCategory: string;
  setEtcCategory: (value: string) => void;

  etcOtherReason: string;
  setEtcOtherReason: (value: string) => void;

  etcRouteStart: string;
  setEtcRouteStart: (value: string) => void;

  etcRouteEnd: string;
  setEtcRouteEnd: (value: string) => void;

  etcPhotos: string[];
  setEtcPhotos: React.Dispatch<React.SetStateAction<string[]>>;

  isSubmitting: boolean;
};

function formatTimestamp(value: any): string {
  if (!value) return "";

  let date: Date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    date = new Date(value);
  } else {
    console.error("Unknown timestamp format:", value);
    return "";
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${y}/${m}/${d} ${h}:${min}`;
}

export default function EtcPage({
  screen,
  setScreen,
  setEtcStep,
  handleEtcStart,
  handleEtcSubmit,
  currentTime,
  gpsTimerRef,
  videoRef,
  isCameraActive,
  startCamera,
  stopCamera,
  capturePhoto,
  etcCategory,
  setEtcCategory,
  etcOtherReason,
  setEtcOtherReason,
  etcRouteStart,
  setEtcRouteStart,
  etcRouteEnd,
  setEtcRouteEnd,
  etcPhotos,
  setEtcPhotos,
  isSubmitting
}: Props) {
  return (
    <motion.div className="flex-1 flex flex-col bg-[#f8fafc] min-h-[420px]">
      {screen === Screen.ETC_START && (
        <motion.div className="flex flex-col flex-1 min-h-0">
          <div className="p-4 bg-white border-b flex items-center gap-3">
            <button onClick={() => setScreen(Screen.MAIN_MENU)} className="p-2">
              <ArrowLeft />
            </button>
            <h2 className="font-bold">ETC利用申請</h2>
          </div>
          <div className="px-6 flex-1 flex flex-col items-center pt-6">
            <div className="w-full border-b border-slate-300 pb-1 mb-8">
              <h3 className="text-slate-700 font-bold text-lg">
                ETC カード利用申請
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-12">
              必ず車を停止し開始ボタンを押してください。
            </p>
            <div className="w-full max-w-[320px] flex flex-col items-center gap-8">
              <button
                type="button"
                onClick={handleEtcStart}
                className="w-full py-5 bg-[#4a72b2] text-white rounded-xl font-bold shadow-xl active:scale-95 transition-all text-xl tracking-[0.1em]"
              >
                <span className="text-2xl font-bold tracking-[0.2em]">
                  ETC 利用開始
                </span>
                <span className="text-[10px] opacity-80 font-normal">
                  Activation of ETC card
                </span>
              </button>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full flex flex-col items-center gap-3"
              >
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  現在時刻
                </p>
                <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-lg shadow-sm border border-slate-200 w-full justify-center">
                  <span className="text-lg font-mono text-slate-800 tracking-wide">
                    {formatTimestamp(currentTime as any)}
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
      {screen === Screen.ETC_IN_USE && (
        <div className="flex flex-col h-full bg-[#f8fafc] items-center justify-center p-8">
          <div className="w-full max-w-[320px] flex flex-col items-center">
            <div className="w-12 h-12 bg-[#eef2f5] rounded-full flex items-center justify-center mb-8 shadow-sm">
              <ArrowDown className="w-6 h-6 text-[#4a72b2]/40" />
            </div>
            <div className="w-full bg-[#eef2f5] py-4 text-center rounded-md shadow-sm mb-6 border border-slate-100 px-10">
              <span className="text-[#4a72b2] font-semibold tracking-[0.5em] text-xl whitespace-nowrap">
                ETC 利用中
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (gpsTimerRef.current) {
                  clearInterval(gpsTimerRef.current);
                  gpsTimerRef.current = null;
                  console.log("GPSトラッキングを停止しました。");
                }
                setEtcStep(EtcStep.ARRIVED);
                setScreen(Screen.ETC_ARRIVED);
              }}
              className="w-full py-5 bg-[#4a72b2] text-white rounded-xl font-bold shadow-xl active:scale-95 transition-all text-xl tracking-[0.1em]"
            >
              到着報告へ進む
            </button>
          </div>
        </div>
      )}
      {screen === Screen.ETC_ARRIVED && (
        <div className="flex flex-col h-full bg-[#dce7eb] overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto overflow-x-hidden pb-24 w-full max-w-full box-border">
            <div className="border-b-2 border-slate-400 pb-1 mb-4 inline-block">
              <h2 className="text-xl font-bold text-slate-700">到着後</h2>
            </div>
            <div className="space-y-4 bg-white/40 p-4 rounded-xl border border-white/60">
              {ETC_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-3 cursor-pointer group w-full"
                >
                  <div
                    className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                      etcCategory === cat
                        ? "border-[#4a72b2] bg-white"
                        : "border-slate-400 bg-white"
                    }`}
                  >
                    {etcCategory === cat && (
                      <div className="w-3 h-3 rounded-full bg-[#4a72b2]" />
                    )}
                  </div>
                  <span className="text-base text-slate-800 font-medium flex-1">
                    {cat}
                  </span>
                  <input
                    type="radio"
                    className="sr-only"
                    name="category"
                    value={cat}
                    checked={etcCategory === cat}
                    onChange={() => {
                      setEtcCategory(cat);
                      if (cat !== ETC_CATEGORY_OTHER) {
                        setEtcOtherReason("");
                      }
                    }}
                  />
                </label>
              ))}
            </div>
            {isEtcCategoryOther(etcCategory) && (
              <div className="space-y-2 bg-white/40 p-4 rounded-xl border border-white/60">
                <label className="text-sm text-slate-700 font-bold block mb-1">
                  その他の理由
                </label>
                <input
                  type="text"
                  value={etcOtherReason}
                  onChange={(e) => setEtcOtherReason(e.target.value)}
                  className="w-full bg-[#cbd5db] border-none p-4 rounded-md text-base outline-none h-14 shadow-inner"
                  placeholder="例： 研修会場への移動"
                />
              </div>
            )}
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-700 font-bold block mb-1">
                  ①ICの乗り口、降り口
                </label>
                <div className="flex w-full min-w-0 items-center gap-2">
                  <input
                    type="text"
                    value={etcRouteStart}
                    onChange={(e) => setEtcRouteStart(e.target.value)}
                    className="min-w-0 flex-1 bg-[#cbd5db] border-none p-3 rounded-md text-base outline-none h-12 shadow-inner"
                    placeholder="ICの乗り口"
                  />
                  <ArrowRight className="w-5 h-5 shrink-0 text-slate-500" />
                  <input
                    type="text"
                    value={etcRouteEnd}
                    onChange={(e) => setEtcRouteEnd(e.target.value)}
                    className="min-w-0 flex-1 bg-[#cbd5db] border-none p-3 rounded-md text-base outline-none h-12 shadow-inner"
                    placeholder="ICの降り口"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-sm text-slate-700 font-bold leading-tight block">
                  ②利用目的、到着地がわかる写真を撮影
                  <br />
                  <span className="font-normal text-[11px] text-slate-500 mt-1 block">
                    場所がわかるように撮影してください
                  </span>
                </label>
                <div className="flex items-center justify-between px-1">
                  {etcPhotos.length > 0 ? (
                    <div className="flex items-center gap-2 text-[#78a878]">
                      <CheckCircle className="w-6 h-6" />
                      <span className="text-xs font-bold">撮影済</span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    1枚必須 (最大3枚)
                  </span>
                </div>
                <div className="relative w-full h-52 overflow-hidden rounded-xl border-2 border-white shadow-lg">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
                  />
                  {!isCameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800/80 text-white text-xs px-4 text-center">
                      <p>カメラを起動して撮影してください</p>
                      <button
                        type="button"
                        onClick={() => void startCamera()}
                        className="text-[11px] font-bold text-white underline"
                      >
                        カメラを起動
                      </button>
                    </div>
                  )}
                  {isCameraActive && (
                    <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-1">
                      <button
                        type="button"
                        disabled={etcPhotos.length >= 3}
                        onClick={() => {
                          if (etcPhotos.length < 3) {
                            void capturePhoto(
                              (p) => setEtcPhotos((prev) => [...prev, p]),
                              { keepCameraOpen: true }
                            );
                          }
                        }}
                        className="w-16 h-16 bg-white rounded-full border-4 border-[#4a72b2]/40 flex items-center justify-center shadow-md active:scale-95 disabled:opacity-40"
                        aria-label="撮影"
                      >
                        <div className="w-12 h-12 bg-[#4a72b2]/30 rounded-full flex items-center justify-center">
                          <Camera className="w-6 h-6 text-slate-700" />
                        </div>
                      </button>
                      <span className="text-[10px] text-white font-bold drop-shadow">
                        撮影
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {etcPhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square border-4 border-white overflow-hidden shadow-md rounded-md"
                    >
                      <img
                        src={photo}
                        alt={`Arrival ${idx}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() =>
                          setEtcPhotos((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="absolute top-0 right-0 p-1.5 bg-black/60 text-white"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {[...Array(3 - etcPhotos.length)].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square border-4 border-white bg-[#cbd5db] rounded-md flex items-center justify-center"
                    >
                      <span className="text-slate-400 text-sm font-bold opacity-30">
                        {etcPhotos.length + i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-10 pb-4">
                <button
                  disabled={isSubmitting}
                  onClick={() => {
                    if (
                      etcPhotos.length > 0 &&
                      etcRouteStart &&
                      etcRouteEnd &&
                      (!isEtcCategoryOther(etcCategory) || etcOtherReason.trim())
                    ) {
                      handleEtcSubmit();
                    } else {
                      alert(
                        isEtcCategoryOther(etcCategory) && !etcOtherReason.trim()
                          ? "「その他の理由」を入力してください。"
                          : "未入力の項目があります。"
                      );
                    }
                  }}
                  className="w-full py-5 bg-[#c85a73] text-white text-3xl font-display font-light tracking-[0.3em] rounded-xl shadow-2xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isSubmitting && <Loader2 className="w-6 h-6 animate-spin" />}
                  {isSubmitting ? "申請中..." : "ETC 利用許可 申請"}
                </button>
                <button
                  onClick={() => {
                    setEtcStep(EtcStep.IN_USE);
                    setScreen(Screen.ETC_IN_USE);
                  }}
                  className="w-full mt-6 text-[12px] text-slate-500 uppercase tracking-[0.2em] font-medium"
                >
                  戻る
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
