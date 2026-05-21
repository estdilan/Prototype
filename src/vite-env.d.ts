/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEEPGRAM_TOKEN?: string;
  readonly VITE_VOICE_ENGINE?: 'deepgram' | 'vosk';
  readonly VITE_VOSK_MODEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
