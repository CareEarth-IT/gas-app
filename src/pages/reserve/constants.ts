export const RESERVE_CATEGORIES = [
  "スタッフ送迎",
  "商談",
  "クレーム対応",
  "その他"
] as const;

export type ReserveCategory = (typeof RESERVE_CATEGORIES)[number];
