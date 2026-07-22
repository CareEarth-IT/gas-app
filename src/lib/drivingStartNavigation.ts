import { Screen } from "../types";

/** alcohol = 1枚目、fuel = 2枚目（燃料ゲージ＋走行距離を1枚で） */
export type DrivingStartStep = "alcohol" | "fuel";

export function drivingStartStepFromScreen(screen: Screen): DrivingStartStep {
  switch (screen) {
    case Screen.DRIVING_START_FUEL:
    case Screen.DRIVING_START_MILEAGE:
      return "fuel";
    default:
      return "alcohol";
  }
}

export function screenFromDrivingStartStep(step: DrivingStartStep): Screen {
  switch (step) {
    case "fuel":
      return Screen.DRIVING_START_FUEL;
    default:
      return Screen.DRIVING_START_ALCOHOL;
  }
}
