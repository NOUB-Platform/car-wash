// Pure TypeScript Code 39 SVG barcode bar generator (works offline & prints vector-crisp)
const CODE39_MAP: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

export function sanitizeBarcodeText(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const filtered = upper
    .split('')
    .filter((ch) => Boolean(CODE39_MAP[ch]) && ch !== '*')
    .join('');
  return filtered || 'PERFECT001';
}

export interface BarcodeBar {
  x: number;
  width: number;
}

export function generateCode39Bars(rawCode: string): {
  text: string;
  bars: BarcodeBar[];
  totalWidth: number;
} {
  const clean = sanitizeBarcodeText(rawCode);
  const full = `*${clean}*`;
  const narrow = 2;
  const wide = 5;
  const interCharGap = 2;

  const bars: BarcodeBar[] = [];
  let cursor = 4;

  for (let c = 0; c < full.length; c++) {
    const pattern = CODE39_MAP[full[c]] || CODE39_MAP['0'];
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i] === 'w' ? wide : narrow;
      if (i % 2 === 0) {
        bars.push({ x: cursor, width: w });
      }
      cursor += w;
    }
    cursor += interCharGap;
  }

  return {
    text: clean,
    bars,
    totalWidth: cursor + 4,
  };
}
