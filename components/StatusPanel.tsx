"use client";

type Props = {
  busy: boolean;
  phase: string;
  percent: number;
  uploadPercent: number;
  logs: string[];
  error: string | null;
};

export default function StatusPanel({
  busy,
  phase,
  percent,
  uploadPercent,
  logs,
  error,
}: Props) {
  if (!busy && logs.length === 0 && !error) return null;
  const isUploading = busy && phase === "uploading";
  return (
    <div className="panel">
      <h2>ステータス / Status</h2>
      {isUploading && (
        <>
          <div className="small">アップロード中: {uploadPercent}%</div>
          <div className="progress-bar">
            <div style={{ width: `${uploadPercent}%` }} />
          </div>
        </>
      )}
      {busy && !isUploading && (
        <>
          <div className="small">
            {phase || "処理中"} ({percent}%)
          </div>
          <div className="progress-bar">
            <div style={{ width: `${percent}%` }} />
          </div>
        </>
      )}
      {error && (
        <div className="notice error" style={{ marginTop: 10 }}>
          エラー: {error}
        </div>
      )}
      {logs.length > 0 && (
        <details open style={{ marginTop: 10 }}>
          <summary className="small muted">ログ ({logs.length})</summary>
          <div className="log">{logs.join("\n")}</div>
        </details>
      )}
    </div>
  );
}
