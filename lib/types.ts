export type ProgressEvent = {
  type: "progress";
  phase: string;
  percent: number;
};

export type LogEvent = {
  type: "log";
  message: string;
};

export type ErrorEvent = {
  type: "error";
  message: string;
};

export type SSEMessage = ProgressEvent | LogEvent | ErrorEvent;

export type Networks = {
  Visual: number[];
  Somatomotor: number[];
  DorsalAttn: number[];
  VentralAttn: number[];
  Limbic: number[];
  FrontoParietal: number[];
  Default: number[];
};

export type Axes = {
  excitement: number[];
  valence: number[];
  cognitive_load: number[];
  novelty: number[];
};

export type Word = { t: number; d: number; text: string };
export type Thumb = { t: number; url: string };

export type ResultPayload = {
  n_segments: number;
  tr: number;
  times: number[];
  networks: Networks;
  axes: Axes;
  pca: [number[], number[], number[]];
  pca_var: [number, number, number];
  waveform: number[];
  words: Word[];
  thumbs: Thumb[];
  brain_urls: string[];
  preds_url: string;
  preds_shape: [number, number];
  mesh_url: string;
};

export type PredictResponse = {
  job_id: string;
  video_url: string;
};

export type Language =
  | "en"
  | "ja"
  | "ja-translate"
  | "fr"
  | "es"
  | "nl"
  | "zh";

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ja-translate", label: "日本語(英訳)" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "nl", label: "Nederlands" },
  { value: "zh", label: "中文" },
];
