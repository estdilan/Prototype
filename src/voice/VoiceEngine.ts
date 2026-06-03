import type { ColorName } from '../config';

export type VoiceCallbacks = {
  onColor: (color: ColorName) => void;
  onSilence: () => void;
  onError: (message: string) => void;
  onTimeout?: () => void;
};

export interface VoiceEngine {
  readonly name: string;
  start(): Promise<void>;
  stop(): void;
}
