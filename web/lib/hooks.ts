"use client";
/* 데이터 fetch 훅 — 인덱스(검색/홈/조직) · 거래처 상세 */
import { useEffect, useState } from "react";
import { fetchIndex, fetchDist, IndexFile, DistData } from "./data";

export function useIndex() {
  const [state, setState] = useState<{ index?: IndexFile; loading: boolean; error?: boolean }>({ loading: true });
  useEffect(() => {
    let on = true;
    fetchIndex()
      .then((i) => on && setState({ index: i, loading: false }))
      .catch(() => on && setState({ loading: false, error: true }));
    return () => { on = false; };
  }, []);
  return state;
}

export function useDist(code: number) {
  const [state, setState] = useState<{ dist?: DistData; loading: boolean; error?: boolean }>({ loading: true });
  useEffect(() => {
    let on = true;
    setState({ loading: true });
    fetchDist(code)
      .then((d) => on && setState({ dist: d, loading: false }))
      .catch(() => on && setState({ loading: false, error: true }));
    return () => { on = false; };
  }, [code]);
  return state;
}
