# Auto Excitement — Vercel × Google Cloud Run

[shi3z/auto-excitement](https://github.com/shi3z/auto-excitement) (Meta TRIBEv2 を使った動画→脳活動予測ビューア) を、エンドユーザーが「URL を開くだけ」で利用できるようにしたウェブアプリ実装。

- **フロントエンド**: Next.js (App Router / TypeScript) → **Vercel** にデプロイ
- **バックエンド**: FastAPI + TRIBEv2 + WhisperX + CUDA → **Google Cloud Run (NVIDIA L4 GPU)** にデプロイ

```
┌──────────────────────┐   HTTPS / SSE     ┌─────────────────────────────────┐
│ Vercel (Next.js)     │ ───────────────▶  │ Cloud Run (Docker, L4 GPU)      │
│  - upload UI         │ ◀───────────────  │  - /predict, /events/{id}       │
│  - score / chart /   │   /events SSE     │  - TRIBEv2 inference            │
│    Three.js brain    │                   │  - WhisperX transcription       │
│  - ffmpeg cutting    │                   │  - mesh / preds binary blobs    │
└──────────────────────┘                   └─────────────────────────────────┘
```

---

## 1. Cloud Run バックエンドをデプロイ

### 1-a. 前提

- Google Cloud プロジェクト + 課金有効
- `gcloud` CLI ログイン済み
- Cloud Run GPU クォータ申請済み (`run.googleapis.com/nvidia_l4_gpu` を使用するリージョン分。初回はクォータ申請が必要 — 通常 24h 以内に承認)
- 対応リージョン例: `us-central1`, `asia-southeast1`, `europe-west1` など

### 1-b. デプロイ

```bash
export PROJECT_ID=your-gcp-project
export REGION=us-central1                      # GPU 対応リージョン
export ALLOWED_ORIGINS="https://your-app.vercel.app"   # 本番では限定推奨

bash backend/deploy.sh
```

スクリプトの内容:

1. 必要 API (`run`, `cloudbuild`, `artifactregistry`) を有効化
2. Artifact Registry リポジトリ作成
3. `backend/Dockerfile` をビルド（30〜60 分、初回）
4. `gcloud beta run deploy --gpu=1 --gpu-type=nvidia-l4 --no-cpu-throttling --execution-environment=gen2 ...` で起動
5. 公開 URL を出力

#### コンテナの中身

| ファイル | 役割 |
|---|---|
| `backend/Dockerfile` | CUDA 12.1 ベース、Python 3.11、TRIBEv2 / auto-excitement / WhisperX を導入 |
| `backend/cors_wrapper.py` | upstream の `server.app` をインポートして `CORSMiddleware` を付与 |
| `backend/entrypoint.sh` | 必要なら `build_atlas.py` を実行し `cors_wrapper.py` を起動 |
| `backend/cloudbuild.yaml` | Cloud Build 用ビルド設定 |
| `backend/deploy.sh` | ビルド + Cloud Run デプロイの一括スクリプト |

### 1-c. コスト目安

NVIDIA L4 (24GB) on Cloud Run はアクティブ時 **$0.30〜0.70/h** 程度。`min-instances=0 / concurrency=1` のため使われていない時間は課金されません(コールドスタート時にモデル読み込みで 30 秒〜数分かかります)。

### 1-d. 手動でも可

```bash
# build
gcloud builds submit backend/ \
  --config backend/cloudbuild.yaml \
  --substitutions=_REGION=us-central1

# deploy
gcloud beta run deploy auto-excitement-server \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/auto-excitement/server:latest \
  --region us-central1 \
  --gpu=1 --gpu-type=nvidia-l4 \
  --no-cpu-throttling --execution-environment=gen2 \
  --memory 16Gi --cpu 4 --timeout 3600 --concurrency 1 \
  --max-instances 3 --min-instances 0 \
  --allow-unauthenticated \
  --set-env-vars="ALLOWED_ORIGINS=*"
```

---

## 2. Vercel にフロントエンドをデプロイ

### 2-a. ボタン式

このリポジトリを fork → [Vercel](https://vercel.com/new) で **Import Project** → デフォルトの Next.js 設定でそのままデプロイ。

### 2-b. 環境変数

| 変数名 | 値 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Cloud Run の URL (`https://auto-excitement-server-xxx.a.run.app`) | フロントの初期接続先 |

設定すると、ユーザーが UI で URL を入力しなくても自動で接続されます。設定しない場合は UI 上で URL を入れる(`localStorage` に保存)。

### 2-c. ローカル開発

```bash
npm install
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev
```

---

## 3. 機能 / Features

- 動画アップロード (進捗バー付き、XHR upload progress)
- SSE で進捗・ログをライブ表示
- 4 軸スコア（Excitement / Valence / Cognitive Load / Novelty）の現在値カード
- 7 ネットワーク + 4 軸の時系列チャート (Chart.js)
- 3D 脳表示 (Three.js, fsaverage5 メッシュ + 動画同期しきい値表示)
- ffmpeg ハイライト切り出しコマンド生成 (.sh ダウンロード可)

---

## 4. ディレクトリ構成

```
.
├── app/                    Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx            画面全体の組み立て
│   └── globals.css
├── components/
│   ├── Settings.tsx        バックエンド URL 設定
│   ├── UploadPanel.tsx
│   ├── StatusPanel.tsx
│   ├── ScoreCards.tsx
│   ├── NetworkChart.tsx
│   ├── BrainViewer.tsx     Three.js + 独自 mesh/float16 パーサ
│   └── CuttingTool.tsx
├── lib/
│   ├── api.ts              /predict + EventSource ラッパ
│   ├── storage.ts          localStorage / NEXT_PUBLIC_BACKEND_URL
│   └── types.ts
├── backend/                ★ Cloud Run バックエンド一式
│   ├── Dockerfile
│   ├── cors_wrapper.py
│   ├── entrypoint.sh
│   ├── cloudbuild.yaml
│   ├── deploy.sh
│   └── .dockerignore
├── package.json
├── tsconfig.json
├── next.config.mjs
└── vercel.json
```

---

## 5. 注意 / Caveats

- **動画サイズ**: ブラウザ→Cloud Run へ直接アップロードします (Vercel の関数経由ではなく)。Cloud Run のリクエストボディ上限は 32MB(HTTP/1)/無制限 (HTTP/2、ストリーム時) — 大きい動画は HTTP/2 を使うか、事前に GCS にアップロードする実装に拡張してください。
- **CORS**: `cors_wrapper.py` が `ALLOWED_ORIGINS` 環境変数で制御。本番では Vercel の URL に絞ることを推奨。
- **モデル重み**: TRIBEv2 / WhisperX のチェックポイントはイメージビルド時に依存解決されます。サイズが Cloud Run のイメージ上限に近づく場合は、起動時に GCS から fetch する形に切り替えるのが堅実です。
- **GPU クォータ**: Cloud Run GPU は当面リージョン制限あり。`gcloud beta run deploy` がクォータ不足で失敗する場合は GCP コンソールでクォータ増加申請を。

---

## 6. 既知の TODO

- 大容量動画用に Vercel フロント → GCS 直接アップロード (signed URL) → Cloud Run へジョブ通知、の経路を追加
- 認証(IAP / Firebase Auth)を入れて公開エンドポイントを保護
- WhisperX 単語タイムラインの可視化を追加(現状は score / network のみ表示)

---

## ライセンス

- 本リポジトリのコード: MIT 推奨(明示的に LICENSE を追加してください)
- TRIBEv2 © Meta — 元プロジェクトのライセンスに従う
- shi3z/auto-excitement — 元プロジェクトのライセンスに従う
