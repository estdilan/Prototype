import type { ColorName } from '../config';

const COLOR_DICTIONARY: Record<ColorName, string[]> = {
  rojo: ['rojo', 'roja', 'red', 'roj', 'roho', 'loco', 'ojo'],
  azul: ['azul', 'blue', 'asul', 'azu', 'sub'],
  verde: ['verde', 'green', 'berde', 'ver', 'vende'],
  amarillo: ['amarillo', 'amarilla', 'yellow', 'ama', 'amarilo', 'yelo', 'mario'],
};

const WORD_MAP = new Map<string, ColorName>();
for (const [color, words] of Object.entries(COLOR_DICTIONARY)) {
  for (const word of words) {
    WORD_MAP.set(word, color as ColorName);
  }
}

const DIACRITICS = /[\u0300-\u036f]/g;

export function extractAllColors(text: string): ColorName[] {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^\w\s]/gi, '');

  const found: ColorName[] = [];
  for (const w of normalized.split(/\s+/)) {
    const c = WORD_MAP.get(w);
    if (c) found.push(c);
  }
  return found;
}

export const VOSK_GRAMMAR: string[] = ['rojo', 'azul', 'verde', 'amarillo', '[unk]'];
