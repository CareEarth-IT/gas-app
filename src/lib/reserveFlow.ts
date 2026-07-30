import { Screen } from "../types";
import { isSubstituteVehicleName } from "../types/vehicle";
import {
  parseReserveReturnScreen,
  restoreFlowMeta,
  saveFlowMeta
} from "./flowPersistence";
import { replacePathname, RESERVE_FORM_PATH } from "./screenRoutes";

export type ReserveVehicleSelection = {
  vehicleNumber: string;
  vehicleName: string;
  usageArea: string;
  isPersonal?: boolean;
  isSubstitute?: boolean;
  substituteUntil?: string;
  returnScreen?: Screen;
};

export function beginReserveForVehicle(selection: ReserveVehicleSelection): void {
  const meta = restoreFlowMeta();
  const isSubstitute =
    selection.isSubstitute === true ||
    isSubstituteVehicleName(selection.vehicleName);

  saveFlowMeta({
    ...meta,
    screen: Screen.RESERVE,
    reserve: {
      step: "form",
      usageArea: selection.usageArea.trim() || "大阪",
      isPersonalUse: selection.isPersonal === true,
      isSubstituteUse: isSubstitute,
      substituteUntil: selection.substituteUntil ?? "",
      reserveStart: "",
      reserveEnd: "",
      allDayUse: false,
      reserveCategory: "スタッフ送迎",
      reservePurpose: "",
      reserveRouteStart: "",
      reserveRouteEnd: "",
      returnScreen: parseReserveReturnScreen(selection.returnScreen)
    }
  });
  replacePathname(RESERVE_FORM_PATH);
}

export { parseReserveReturnScreen };
