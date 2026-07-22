import { useEffect, useState } from "react";

import {
  getOilChangeAlert,
  type OilChangeAlert
} from "../lib/oilChangeAlert";
import { fetchRecentDrivingLogs } from "../lib/drivingLogs";
import { fetchMaintenanceRecords } from "../lib/vehicleMaintenance";
import type { DrivingLogMileage } from "../lib/vehicleMileage";

export function useOilChangeAlert(vehicleNumber: string) {
  const [alert, setAlert] = useState<OilChangeAlert | null>(null);

  useEffect(() => {
    const normalized = vehicleNumber.trim();
    if (!normalized) {
      setAlert(null);
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        const [logs, maintenanceRecords] = await Promise.all([
          fetchRecentDrivingLogs(300),
          fetchMaintenanceRecords()
        ]);

        if (!isMounted) return;

        setAlert(
          getOilChangeAlert(
            normalized,
            logs as DrivingLogMileage[],
            maintenanceRecords
          )
        );
      } catch (error) {
        console.warn("オイル交換アラートの取得に失敗しました", error);
        if (isMounted) setAlert(null);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [vehicleNumber]);

  return alert;
}
