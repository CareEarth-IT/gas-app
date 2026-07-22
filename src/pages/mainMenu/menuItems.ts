import {
  Calendar,
  Car,
  Droplet,
  Gauge,
  List
} from "lucide-react";

import { Screen, EtcStep } from "../../types";

type MenuItemContext = {
  setScreen: (screen: Screen) => void;
  setEtcStep: (step: EtcStep) => void;
  startCamera: () => void;
};

export const MAIN_MENU_ITEMS = {
  reserve: {
    icon: Car,
    title: "社用車の利用状況・予約",
    description: "空き状況を確認して社用車を予約します",
    onClick: ({ setScreen }: MenuItemContext) => {
      setScreen(Screen.RESERVE);
    }
  },
  reserveSchedule: {
    icon: Calendar,
    title: "社用車予約一覧",
    description: "全社の社用車予約スケジュールを確認します",
    onClick: ({ setScreen }: MenuItemContext) => {
      setScreen(Screen.RESERVE_SCHEDULE);
    }
  },
  refuel: {
    icon: Droplet,
    title: "ガソリン給油",
    description: "給油後のレシートを撮影・登録します",
    onClick: ({ setScreen, startCamera }: MenuItemContext) => {
      setScreen(Screen.REFUEL_METER);
      startCamera();
    }
  },
  etc: {
    icon: List,
    title: "ETC利用申請",
    description: "高速道路の利用を申請します",
    onClick: ({ setScreen, setEtcStep }: MenuItemContext) => {
      setEtcStep(EtcStep.START);
      setScreen(Screen.ETC_START);
    }
  },
  mileageConfirm: {
    icon: Gauge,
    title: "走行距離の確認",
    description: "運転開始時に撮影した走行距離を確認します",
    onClick: ({ setScreen }: MenuItemContext) => {
      setScreen(Screen.MILEAGE_CONFIRM);
    }
  }
} as const;
