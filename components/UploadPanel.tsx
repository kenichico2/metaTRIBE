"use client";

import { useRef, useState } from "react";
import { LANGUAGES, type Language } from "@/lib/types";

type Props = {
  disabled?: boolean;
  busy: boolean;
  onRun: (file: File, language: Language) => void;
  onCancel: () => void;
};

export default function UploadPanel({ disabled, busy, onRun, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<Language>("ja");

  return (
    <div className="panel">
      <h2>動画をアップロード / Upload</h2>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="field">
          動画ファイル
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="input"
            disabled={disabled || busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="field" style={{ flex: "0 0 200px" }}>
          言語
          <select
            className="select"
            value={language}
            disabled={disabled || busy}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {!busy ? (
          <button
            className="btn"
            disabled={disabled || !file}
            onClick={() => file && onRun(file, language)}
          >
            実行
          </button>
        ) : (
          <button className="btn danger" onClick={onCancel}>
            中止
          </button>
        )}
      </div>
      {disabled && (
        <div className="notice warn" style={{ marginTop: 10 }}>
          先に上のバックエンド URL を設定してください。
        </div>
      )}
    </div>
  );
}
