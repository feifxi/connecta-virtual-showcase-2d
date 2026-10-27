import { AVATAR_COUNT } from '@connecta/shared';
import { withBase } from './utils';

// 14 TestUI characters · walk sheets are 4×4 (80px frames, rows: down, up, left, right)
const NAMES = ['Mika', 'Haru', 'Nami', 'Ren', 'Sora', 'Yuki', 'Mali', 'Nont', 'Phum', 'Prae', 'Arun', 'Pim', 'Fah', 'May'];

export const CHARACTERS = Array.from({ length: AVATAR_COUNT }, (_, i) => {
  const id = `character-${String(i + 1).padStart(2, '0')}`;
  return { index: i, name: NAMES[i]!, walk: withBase(`/assets/characters/${id}-walk.png`), portrait: withBase(`/assets/characters/${id}-portrait.png`) };
});

export const character = (i: number | null | undefined) => CHARACTERS[(((i ?? 0) % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT]!;
export const FACE_TONES = ['#ffe6d8', '#e5f5ed', '#fff4cf', '#e6dcfb', '#e8efff'];
