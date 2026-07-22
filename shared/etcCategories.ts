export const ETC_CATEGORIES = [
  "スタッフ送迎",
  "商談",
  "クレーム対応",
  "その他"
] as const;

export const ETC_CATEGORY_OTHER = "その他";

export function isEtcCategoryOther(category: string): boolean {
  return category.trim() === ETC_CATEGORY_OTHER;
}
