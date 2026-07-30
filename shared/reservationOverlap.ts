/** 分単位に切り捨て（秒未満の差で境界予約が誤検知されないようにする） */
export function floorToMinute(date: Date): Date {
  const ms = date.getTime();
  return new Date(ms - (ms % 60_000));
}

/**
 * 時間帯の重複判定（半開区間 [start, end)）。
 * 終了時刻ちょうどからの次の予約（例: 〜12:00 の次に 12:00〜）は重複しない。
 */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  const a0 = floorToMinute(aStart).getTime();
  const a1 = floorToMinute(aEnd).getTime();
  const b0 = floorToMinute(bStart).getTime();
  const b1 = floorToMinute(bEnd).getTime();
  return a0 < b1 && a1 > b0;
}

type ReservationRangeLike = {
  allDay?: boolean;
  start: Date;
  end: Date;
};

/**
 * 予約同士が車両の占有として衝突するか。
 * 終日予約（allDay）が含まれる場合は重複しない（別時間帯・別車種の予約を妨げない）。
 * 時間指定同士のみ、同一車両で重複を判定する。
 */
export function reservationRangesConflict(
  existing: ReservationRangeLike,
  incoming: ReservationRangeLike
): boolean {
  if (existing.allDay || incoming.allDay) return false;
  return rangesOverlap(existing.start, existing.end, incoming.start, incoming.end);
}
