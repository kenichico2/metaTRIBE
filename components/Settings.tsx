"use client";

import { useEffect, useState } from "react";
import {
  loadBackendUrl,
  normalizeBackendUrl,
  saveBackendUrl,
} from "@/lib/storage";
import { pingBackend } from "@/lib/api";

type Props = {
  onChange: (url: string) => void;
};

export default function Settings({ onChange }: Props) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<
    "unknown" | "checking" | "ok" | "fail"
  >("unknown");

  useEffect(() => {
    const initial = loadBackendUrl();
    if (initial) {
      setUrl(initial);
      onChange(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = async () => {
    const norm = normalizeBackendUrl(url);
    setUrl(norm);
    saveBackendUrl(norm);
    onChange(norm);
    if (!norm) return;
    setStatus("checking");
    const ok = await pingBackend(norm);
    setStatus(ok ? "ok" : "fail");
  };

  return (
    <div className="panel">
      <h2>バックエンド接続設定 / Backend</h2>
      <div className="row">
        <input
          className="input"
          value={url}
          placeholder="例: http://localhost:8000  または  https://xxx.trycloudflare.com"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
        />
        <button className="btn" onClick={apply} disabled={!url.trim()}>
          保存して接続テスト
        </button>
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>
        {status === "ok" && (
          <span style={{ color: "var(--good)" }}>● 接続OK</span>
        )}
        {status === "fail" && (
          <span style={{ color: "var(--bad)" }}>
            ● 接続失敗 — URL と CORS 設定を確認してください
          </span>
        )}
        {status === "checking" && <span>● 確認中...</span>}
        {status === "unknown" && (
          <span>
            自分の GPU マシンで <code>python server.py</code> を起動した URL を入力してください。
          </span>
        )}
      </div>
      <details style={{ marginTop: 10 }}>
        <summary className="small muted">セットアップ手順 / Setup guide</summary>
        <div className="small muted" style={{ marginTop: 8 }}>
          <ol style={{ paddingLeft: 18, marginTop: 0 }}>
            <li>
              GPU マシンで{" "}
              <a
                href="https://github.com/shi3z/auto-excitement"
                target="_blank"
                rel="noreferrer"
              >
                shi3z/auto-excitement
              </a>{" "}
              をセットアップ。
            </li>
            <li>
              <code>server.py</code> に CORS ミドルウェアを追加（README 参照）。
            </li>
            <li>
              <code>python server.py</code> を起動。外部公開する場合は
              <code> cloudflared tunnel </code>や <code>ngrok http 8000</code> を使用。
            </li>
            <li>上記欄にその URL を貼り付け。</li>
          </ol>
        </div>
      </details>
    </div>
  );
}
