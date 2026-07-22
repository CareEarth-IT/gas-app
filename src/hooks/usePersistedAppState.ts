import { useEffect } from "react";

import type { DrivingStatus } from "../types";

type PersistedAppState = {
  drivingStatus: DrivingStatus;
  hasReservation: boolean;
  vehicleNumber: string;
  vehicleModel: string;
  etcStartTime: Date | null;
  startMileageImageUrl: string | null;
};

export function usePersistedAppState({
  drivingStatus,
  hasReservation,
  vehicleNumber,
  vehicleModel,
  etcStartTime,
  startMileageImageUrl
}: PersistedAppState) {
  useEffect(() => {
    localStorage.setItem("drivingStatus", drivingStatus);
  }, [drivingStatus]);

  useEffect(() => {
    localStorage.setItem("hasReservation", String(hasReservation));
  }, [hasReservation]);

  useEffect(() => {
    if (vehicleNumber) localStorage.setItem("vehicleNumber", vehicleNumber);
    else localStorage.removeItem("vehicleNumber");
  }, [vehicleNumber]);

  useEffect(() => {
    if (vehicleModel) localStorage.setItem("vehicleModel", vehicleModel);
    else localStorage.removeItem("vehicleModel");
  }, [vehicleModel]);

  useEffect(() => {
    if (etcStartTime) {
      localStorage.setItem("etcStartTime", etcStartTime.toISOString());
    } else {
      localStorage.removeItem("etcStartTime");
    }
  }, [etcStartTime]);

  useEffect(() => {
    if (startMileageImageUrl) {
      localStorage.setItem("startMileageImageUrl", startMileageImageUrl);
    } else {
      localStorage.removeItem("startMileageImageUrl");
    }
  }, [startMileageImageUrl]);
}

export function restorePersistedAppState() {
  const drivingStatus = localStorage.getItem("drivingStatus");
  const hasReservation = localStorage.getItem("hasReservation") === "true";
  const vehicleNumber = localStorage.getItem("vehicleNumber") ?? "";
  const vehicleModel = localStorage.getItem("vehicleModel") ?? "";
  const savedEtc = localStorage.getItem("etcStartTime");
  const startMileageImageUrl = localStorage.getItem("startMileageImageUrl");

  return {
    drivingStatus: drivingStatus as DrivingStatus | null,
    hasReservation,
    vehicleNumber,
    vehicleModel,
    etcStartTime: savedEtc ? new Date(savedEtc) : null,
    startMileageImageUrl
  };
}
