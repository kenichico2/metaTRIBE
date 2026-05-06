"use client";

import type { PredictResponse, ResultPayload, SSEMessage } from "./types";

export type UploadHandlers = {
  onUploadProgress?: (loaded: number, total: number) => void;
  onProgress?: (phase: string, percent: number) => void;
  onLog?: (message: string) => void;
  onError?: (message: string) => void;
  onResult?: (result: ResultPayload) => void;
  signal?: AbortSignal;
};

export async function uploadAndStream(
  backendUrl: string,
  file: File,
  language: string,
  handlers: UploadHandlers
): Promise<{ jobId: string; videoUrl: string }> {
  const predictResponse = await new Promise<PredictResponse>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", backendUrl + "/predict");
      xhr.responseType = "json";
      if (xhr.upload && handlers.onUploadProgress) {
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            handlers.onUploadProgress!(ev.loaded, ev.total);
          }
        };
      }
      xhr.onerror = () =>
        reject(
          new Error(
            "バックエンドに接続できません。URL と CORS 設定を確認してください。"
          )
        );
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
          resolve(xhr.response as PredictResponse);
        } else {
          reject(
            new Error(
              `アップロード失敗 (HTTP ${xhr.status}): ${
                xhr.responseText?.slice(0, 200) ?? ""
              }`
            )
          );
        }
      };
      if (handlers.signal) {
        handlers.signal.addEventListener("abort", () => xhr.abort());
      }
      const fd = new FormData();
      fd.append("video", file);
      fd.append("language", language);
      xhr.send(fd);
    }
  );

  const { job_id, video_url } = predictResponse;

  await new Promise<void>((resolve, reject) => {
    const es = new EventSource(`${backendUrl}/events/${job_id}`);

    const cleanup = () => es.close();
    if (handlers.signal) {
      handlers.signal.addEventListener("abort", () => {
        cleanup();
        reject(new Error("aborted"));
      });
    }

    es.onmessage = (ev) => {
      let msg: SSEMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "progress") {
        handlers.onProgress?.(msg.phase, msg.percent);
      } else if (msg.type === "log") {
        handlers.onLog?.(msg.message);
      } else if (msg.type === "error") {
        handlers.onError?.(msg.message);
        cleanup();
        reject(new Error(msg.message));
      }
    };

    es.addEventListener("result", (ev) => {
      try {
        const result = JSON.parse((ev as MessageEvent).data) as ResultPayload;
        handlers.onResult?.(result);
        cleanup();
        resolve();
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });

    es.onerror = () => {
      // EventSource sometimes fires error after the stream completes normally;
      // distinguish by checking whether result was already delivered (caller resolves).
      if (es.readyState === EventSource.CLOSED) {
        cleanup();
        reject(
          new Error(
            "イベントストリームが切断されました。CORS やネットワークを確認してください。"
          )
        );
      }
    };
  });

  return { jobId: job_id, videoUrl: video_url };
}

export async function pingBackend(backendUrl: string): Promise<boolean> {
  if (!backendUrl) return false;
  try {
    const res = await fetch(backendUrl + "/", {
      method: "GET",
      mode: "cors",
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
