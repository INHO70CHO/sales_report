"use client";
/* 조직별 둘러보기 — 사업부 ▸ 팀 ▸ 사원 ▸ 담당 유통점 */
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/util";
import { IndexEntry } from "@/lib/data";
import { useIndex } from "@/lib/hooks";
import { Skeleton } from "@/components/ui";
import { IconChevron, IconUser, IconPin } from "@/components/icons";

type Tree = Record<string, Record<string, Record<string, IndexEntry[]>>>;

/** 1사업부 < 2사업부 < … < 비숫자(B2C·해외) 순 정렬 */
function natCompare(a: string, b: string): number {
  const aNum = /^\d/.test(a), bNum = /^\d/.test(b);
  if (aNum && bNum) return (parseInt(a) - parseInt(b)) || a.localeCompare(b, "ko");
  if (aNum) return -1;
  if (bNum) return 1;
  return a.localeCompare(b, "ko");
}
const byKey = (e1: [string, any], e2: [string, any]) => natCompare(e1[0], e2[0]);

export default function OrgPage() {
  const router = useRouter();
  const { index, loading } = useIndex();
  const dists = index?.distributors ?? [];

  const tree = useMemo<Tree>(() => {
    const m: Tree = {};
    dists.forEach((d) => {
      const bu = d.사업부 || "기타", team = d.팀 || "기타", rep = d.사원 || "기타";
      m[bu] = m[bu] || {};
      m[bu][team] = m[bu][team] || {};
      (m[bu][team][rep] = m[bu][team][rep] || []).push(d);
    });
    return m;
  }, [dists]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  function onPick(d: IndexEntry) { router.push(`/distributors?code=${d.code}`); }

  return (
    <div className="screen org" data-screen-label="조직">
      <header className="simple-head"><h1>조직별 둘러보기</h1><span>사업부 ▸ 팀 ▸ 사원 · 총 {index?.count ?? 0}개 거래처</span></header>
      <div className="org-body">
        {loading ? (
          [0, 1, 2, 3].map((i) => <div key={i} style={{ padding: "12px 6px" }}><Skeleton w="40%" h={16} /></div>)
        ) : (
          Object.entries(tree).sort(byKey).map(([bu, teams]) => (
            <div className="org-bu" key={bu}>
              <button className="org-row org-l1" onClick={() => toggle(bu)}>
                <IconChevron className={cx("ic-sm chev", open[bu] && "chev-open")} />
                <span>{bu}</span>
                <span className="org-count">{Object.values(teams).reduce((a, t) => a + Object.values(t).reduce((b, l) => b + l.length, 0), 0)}</span>
              </button>
              {open[bu] && Object.entries(teams).sort(byKey).map(([team, reps]) => (
                <div key={team} className="org-team">
                  <button className="org-row org-l2" onClick={() => toggle(bu + team)}>
                    <IconChevron className={cx("ic-sm chev", open[bu + team] && "chev-open")} />
                    <span>{team}</span>
                    <span className="org-count">{Object.values(reps).reduce((b, l) => b + l.length, 0)}</span>
                  </button>
                  {open[bu + team] && Object.entries(reps).sort(byKey).map(([rep, list]) => (
                    <div key={rep} className="org-rep">
                      <div className="org-row org-l3"><IconUser /><span>{rep}</span><span className="org-count">{list.length}</span></div>
                      {list.map((d) => (
                        <button key={d.code} className="org-dist" onClick={() => onPick(d)}>
                          <IconPin /><span className="od-name">{d.name}</span><span className="od-meta">{d.code}</span><IconChevron className="ic-sm" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
