import { useEffect, useRef } from "react";

import {
  isRestorableFlowScreen,
  restoreFlowMeta,
  saveFlowImages,
  saveFlowMeta
} from "../lib/flowPersistence";
import { EtcStep, Screen } from "../types";

type UseFlowPersistenceOptions = {
  screen: Screen;
  etcStep: EtcStep;
  meterImage: string | null;
  receiptImage: string | null;
  etcPhotos: string[];
  etcCategory: string;
  etcOtherReason: string;
  etcDestination: string;
  etcRouteStart: string;
  etcRouteEnd: string;
};

export function buildInitialFlowMeta() {
  return restoreFlowMeta();
}

export function useFlowPersistence(options: UseFlowPersistenceOptions) {
  const {
    screen,
    etcStep,
    meterImage,
    receiptImage,
    etcPhotos,
    etcCategory,
    etcOtherReason,
    etcDestination,
    etcRouteStart,
    etcRouteEnd
  } = options;

  const imageSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const current = restoreFlowMeta();
    const nextScreen = isRestorableFlowScreen(screen) ? screen : null;
    saveFlowMeta({
      ...current,
      screen: nextScreen,
      etcStep,
      etcCategory,
      etcOtherReason,
      etcDestination,
      etcRouteStart,
      etcRouteEnd
    });
  }, [
    screen,
    etcStep,
    etcCategory,
    etcOtherReason,
    etcDestination,
    etcRouteStart,
    etcRouteEnd
  ]);

  useEffect(() => {
    if (imageSaveTimerRef.current) {
      clearTimeout(imageSaveTimerRef.current);
    }

    imageSaveTimerRef.current = setTimeout(() => {
      void saveFlowImages({
        meterImage,
        receiptImage,
        etcPhotos
      });
    }, 400);

    return () => {
      if (imageSaveTimerRef.current) {
        clearTimeout(imageSaveTimerRef.current);
      }
    };
  }, [meterImage, receiptImage, etcPhotos]);
}
