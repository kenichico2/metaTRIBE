"use client";

import type { ResultPayload } from "@/lib/types";

const FIELDS: Array<{
  key: keyof ResultPayload["axes"];
  label: string;
  className: string;
}> = [
  { key: "excitement", label: "Excitement / 興奮度", className: "excitement" },
  { key: "valence", label: "Valence / 感情価", className: "valence" },
  {
    key: "cognitive_load",
    label: "Cognitive Load / 認知負荷",
    className: "cogload",
  },
  { key: "novelty", label: "Novelty / 新規性", className: "novelty" },
];

function indexAt(times: number[], t: number): number {
  if (!times.length) return 0;
  let idx = 0;
  for (let i = 0; i < times.length; i++) {
    if (times[i] <= t) idx = i;
    else break;
  }
  return idx;
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

export default function ScoreCards({
  result,
  currentTime,
}: {
  result: ResultPayload;
  currentTime: number;
}) {
  const idx = indexAt(result.times, currentTime);
  return (
    <>
      <div className="score-grid">
        {FIELDS.map((f) => {
          const v = result.axes[f.key]?.[idx] ?? 0;
          return (
            <div key={f.key} className={`score-card ${f.className}`}>
              <div className="label">{f.label}</div>
              <div className="value">{v.toFixed(2)}</div>
              <div className="small muted" style={{ marginTop: 2 }}>
                avg {mean(result.axes[f.key] ?? []).toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>
        現在時刻 {currentTime.toFixed(2)}s · TR {result.tr.toFixed(2)}s ·
        セグメント数 {result.n_segments}
      </div>
    </>
  );
}
