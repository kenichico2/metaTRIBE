"use client";

import { useMemo, useState } from "react";
import type { ResultPayload } from "@/lib/types";

type Segment = { start: number; end: number };

function buildSegments(
  times: number[],
  excitement: number[],
  thresh: number,
  minDuration: number,
  tr: number
): Segment[] {
  const kept: Segment[] = [];
  let curStart: number | null = null;
  for (let i = 0; i < times.length; i++) {
    const above = excitement[i] >= thresh;
    if (above) {
      if (curStart === null) curStart = times[i];
    } else if (curStart !== null) {
      const end = times[i];
      if (end - curStart >= minDuration) kept.push({ start: curStart, end });
      curStart = null;
    }
  }
  if (curStart !== null) {
    const end = (times[times.length - 1] ?? 0) + tr;
    if (end - curStart >= minDuration) kept.push({ start: curStart, end });
  }
  return kept;
}

function buildFFmpegCmd(input: string, segs: Segment[]): string {
  if (segs.length === 0) return "# (no segments above threshold)";
  const expr = segs
    .map((s) => `between(t,${s.start.toFixed(2)},${s.end.toFixed(2)})`)
    .join("+");
  return `ffmpeg -i "${input}" \\
  -vf "select='${expr}',setpts=N/FRAME_RATE/TB" \\
  -af "aselect='${expr}',asetpts=N/SR/TB" \\
  -y output_highlight.mp4`;
}

export default function CuttingTool({
  result,
}: {
  result: ResultPayload;
}) {
  const [thresh, setThresh] = useState(0.5);
  const [minKeep, setMinKeep] = useState(2);
  const [inputName, setInputName] = useState("input.mp4");

  const segs = useMemo(
    () =>
      buildSegments(
        result.times,
        result.axes.excitement,
        thresh,
        minKeep,
        result.tr
      ),
    [result, thresh, minKeep]
  );
  const totalDur =
    (result.times[result.times.length - 1] ?? 0) + result.tr || 0;
  const totalKept = segs.reduce((a, s) => a + (s.end - s.start), 0);
  const cmd = useMemo(() => buildFFmpegCmd(inputName, segs), [inputName, segs]);

  return (
    <div>
      <div className="small muted" style={{ marginBottom: 8 }}>
        Excitement が閾値を超える区間だけを残す ffmpeg コマンドを生成します。
        手元の動画ファイルに対して実行してください。
      </div>
      <div className="row">
        <label className="field">
          Excitement しきい値: {thresh.toFixed(2)}
          <input
            type="range"
            min={-2}
            max={2}
            step={0.05}
            value={thresh}
            onChange={(e) => setThresh(parseFloat(e.target.value))}
          />
        </label>
        <label className="field">
          最短保持秒数 / Min keep (s)
          <input
            className="input"
            type="number"
            min={0}
            step={0.5}
            value={minKeep}
            onChange={(e) => setMinKeep(parseFloat(e.target.value) || 0)}
          />
        </label>
        <label className="field">
          入力ファイル名
          <input
            className="input"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
          />
        </label>
      </div>
      <div className="kv" style={{ marginTop: 10 }}>
        <span>セグメント数</span>
        <span>{segs.length}</span>
        <span>保持時間</span>
        <span>
          {totalKept.toFixed(1)} s / {totalDur.toFixed(1)} s (
          {totalDur ? Math.round((totalKept / totalDur) * 100) : 0}%)
        </span>
      </div>
      <pre className="code" style={{ marginTop: 10 }}>
        {cmd}
      </pre>
      <div className="row" style={{ marginTop: 6 }}>
        <button
          className="btn secondary"
          onClick={() => navigator.clipboard.writeText(cmd)}
        >
          クリップボードにコピー
        </button>
        <button
          className="btn secondary"
          onClick={() => {
            const blob = new Blob([cmd + "\n"], {
              type: "text/x-shellscript",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "cut_highlights.sh";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          .sh をダウンロード
        </button>
      </div>
    </div>
  );
}
