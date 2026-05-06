"use client";

import { useRef, useState } from "react";
import Settings from "@/components/Settings";
import UploadPanel from "@/components/UploadPanel";
import StatusPanel from "@/components/StatusPanel";
import ScoreCards from "@/components/ScoreCards";
import NetworkChart from "@/components/NetworkChart";
import BrainViewer from "@/components/BrainViewer";
import CuttingTool from "@/components/CuttingTool";
import { uploadAndStream } from "@/lib/api";
import type { Language, ResultPayload } from "@/lib/types";
import { resolveBackendAsset } from "@/lib/storage";

export default function Page() {
  const [backendUrl, setBackendUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [percent, setPercent] = useState(0);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const run = async (file: File, language: Language) => {
    if (!backendUrl) return;
    setBusy(true);
    setError(null);
    setLogs([]);
    setResult(null);
    setVideoUrl(null);
    setPhase("uploading");
    setPercent(0);
    setUploadPercent(0);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await uploadAndStream(backendUrl, file, language, {
        signal: ctrl.signal,
        onUploadProgress: (loaded, total) =>
          setUploadPercent(Math.round((loaded / total) * 100)),
        onProgress: (p, pc) => {
          setPhase(p);
          setPercent(pc);
        },
        onLog: (m) =>
          setLogs((prev) => {
            const next = [...prev, m];
            return next.length > 200 ? next.slice(-200) : next;
          }),
        onError: (m) => setError(m),
        onResult: (r) => setResult(r),
      });
      setVideoUrl(resolveBackendAsset(backendUrl, res.videoUrl));
      setPhase("done");
      setPercent(100);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "aborted") setError(msg);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">Auto Excitement</h1>
          <div className="subtitle">
            Meta TRIBEv2 ブレイン予測ビューア — Vercel × Google Cloud Run
          </div>
        </div>
        <a
          className="small muted"
          href="https://github.com/shi3z/auto-excitement"
          target="_blank"
          rel="noreferrer"
        >
          shi3z/auto-excitement ↗
        </a>
      </header>

      <Settings onChange={setBackendUrl} />

      <UploadPanel
        disabled={!backendUrl}
        busy={busy}
        onRun={run}
        onCancel={cancel}
      />

      <StatusPanel
        busy={busy}
        phase={phase}
        percent={percent}
        uploadPercent={uploadPercent}
        logs={logs}
        error={error}
      />

      {videoUrl && (
        <div className="panel">
          <h2>Video</h2>
          <div className="video-wrap">
            <video
              src={videoUrl}
              controls
              crossOrigin="anonymous"
              onTimeUpdate={(e) =>
                setCurrentTime((e.target as HTMLVideoElement).currentTime)
              }
            />
          </div>
        </div>
      )}

      {result && (
        <>
          <div className="panel">
            <h2>Scores</h2>
            <ScoreCards result={result} currentTime={currentTime} />
          </div>
          <div className="panel">
            <h2>Networks &amp; Axes</h2>
            <NetworkChart result={result} />
          </div>
          <div className="panel">
            <h2>Brain Viewer</h2>
            <BrainViewer
              backend={backendUrl}
              result={result}
              currentTime={currentTime}
            />
          </div>
          <div className="panel">
            <h2>Cutting Tool</h2>
            <CuttingTool result={result} />
          </div>
        </>
      )}

      <footer className="small muted" style={{ marginTop: 24, opacity: 0.7 }}>
        TRIBEv2 model © Meta · auto-excitement © shi3z · Frontend deployable on
        Vercel; backend deployable on Google Cloud Run (NVIDIA L4 GPU).
      </footer>
    </div>
  );
}
