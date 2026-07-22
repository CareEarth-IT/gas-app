import { Screen } from "../types";

export type RefuelStep = "meter" | "receipt" | "confirm" | "complete";

export function refuelStepFromScreen(screen: Screen): RefuelStep {
  switch (screen) {
    case Screen.REFUEL_RECEIPT:
      return "receipt";
    case Screen.REFUEL_CONFIRM:
      return "confirm";
    case Screen.REFUEL_COMPLETE:
      return "complete";
    default:
      return "meter";
  }
}

export function screenFromRefuelStep(step: RefuelStep): Screen {
  switch (step) {
    case "receipt":
      return Screen.REFUEL_RECEIPT;
    case "confirm":
      return Screen.REFUEL_CONFIRM;
    case "complete":
      return Screen.REFUEL_COMPLETE;
    default:
      return Screen.REFUEL_METER;
  }
}
