import { useEffect, useState } from "react";

import { fetchStaffNameMap } from "../lib/staffNames";

export function useStaffDisplayNames(enabled = true) {
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setNameMap(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchStaffNameMap()
      .then((map) => {
        if (!cancelled) setNameMap(map);
      })
      .catch((error) => {
        console.warn("スタッフ氏名の取得に失敗しました", error);
        if (!cancelled) setNameMap(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { nameMap, loading };
}
