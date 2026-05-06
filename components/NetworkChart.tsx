"use client";

import { useEffect, useRef } from "react";
import type { ResultPayload } from "@/lib/types";

const NETWORK_COLORS: Record<string, string> = {
  Visual: "#5fa3ff",
  Somatomotor: "#7dd3fc",
  DorsalAttn: "#a78bfa",
  VentralAttn: "#f472b6",
  Limbic: "#fbbf24",
  FrontoParietal: "#34d399",
  Default: "#94a3b8",
};

const AXIS_COLORS: Record<string, string> = {
  excitement: "#ff7a59",
  valence: "#f4c95d",
  cognitive_load: "#6cb6ff",
  novelty: "#b78bff",
};

export default function NetworkChart({ result }: { result: ResultPayload }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ChartJSModule = await import("chart.js/auto");
      if (cancelled || !canvasRef.current) return;
      const Chart = ChartJSModule.default;

      chartRef.current?.destroy();

      const datasets: unknown[] = [];
      for (const [name, data] of Object.entries(result.networks)) {
        datasets.push({
          label: name,
          data: result.times.map((t, i) => ({ x: t, y: data[i] })),
          borderColor: NETWORK_COLORS[name] ?? "#888",
          backgroundColor: NETWORK_COLORS[name] ?? "#888",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.2,
        });
      }
      for (const [name, data] of Object.entries(result.axes)) {
        datasets.push({
          label: name,
          data: result.times.map((t, i) => ({ x: t, y: data[i] })),
          borderColor: AXIS_COLORS[name] ?? "#fff",
          backgroundColor: AXIS_COLORS[name] ?? "#fff",
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0.2,
        });
      }

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: { datasets: datasets as never },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { labels: { color: "#cbd5e1", boxWidth: 12 } },
            tooltip: { mode: "index", intersect: false },
          },
          scales: {
            x: {
              type: "linear",
              ticks: { color: "#94a3b8" },
              title: { display: true, text: "time (s)", color: "#94a3b8" },
              grid: { color: "rgba(255,255,255,0.04)" },
            },
            y: {
              ticks: { color: "#94a3b8" },
              title: {
                display: true,
                text: "z-score / activity",
                color: "#94a3b8",
              },
              grid: { color: "rgba(255,255,255,0.04)" },
            },
          },
        },
      }) as unknown as { destroy: () => void };
    })();
    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [result]);

  return (
    <div className="chart-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
