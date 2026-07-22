/** 酒気帯び確認記録表の固定値（出発前・到着後とも同じ） */
export const FIXED_ALCOHOL_CHECK_FIELDS = {
  alcoholBeforeConfirmationMethod: "対面",
  alcoholBeforeDetectorUsed: "あり",
  alcoholBeforePresent: "なし",
  alcoholAfterConfirmationMethod: "対面",
  alcoholAfterDetectorUsed: "あり",
  alcoholAfterPresent: "なし"
} as const;

export type AlcoholCheckFields = {
  alcoholBeforeConfirmationMethod: string;
  alcoholBeforeDetectorUsed: string;
  alcoholBeforePresent: string;
  alcoholAfterConfirmationMethod: string;
  alcoholAfterDetectorUsed: string;
  alcoholAfterPresent: string;
};

export function getFixedAlcoholCheckFields(): AlcoholCheckFields {
  return { ...FIXED_ALCOHOL_CHECK_FIELDS };
}

export function needsAlcoholCheckBackfill(
  row: Partial<AlcoholCheckFields>
): boolean {
  return (
    row.alcoholBeforeConfirmationMethod !==
      FIXED_ALCOHOL_CHECK_FIELDS.alcoholBeforeConfirmationMethod ||
    row.alcoholBeforeDetectorUsed !==
      FIXED_ALCOHOL_CHECK_FIELDS.alcoholBeforeDetectorUsed ||
    row.alcoholBeforePresent !==
      FIXED_ALCOHOL_CHECK_FIELDS.alcoholBeforePresent ||
    row.alcoholAfterConfirmationMethod !==
      FIXED_ALCOHOL_CHECK_FIELDS.alcoholAfterConfirmationMethod ||
    row.alcoholAfterDetectorUsed !==
      FIXED_ALCOHOL_CHECK_FIELDS.alcoholAfterDetectorUsed ||
    row.alcoholAfterPresent !== FIXED_ALCOHOL_CHECK_FIELDS.alcoholAfterPresent
  );
}
