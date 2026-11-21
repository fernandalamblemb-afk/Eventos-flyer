export interface FontDef {
  family: string;
  category: 'serif' | 'sans' | 'display';
  weights: number[];
  italic?: boolean;
}

/** Fontes carregadas via Google Fonts (ver index.html). */
export const FONTS: FontDef[] = [
  { family: 'Fraunces', category: 'serif', weights: [300, 400, 600, 800], italic: true },
  { family: 'Playfair Display', category: 'serif', weights: [400, 500, 600, 700, 800, 900], italic: true },
  { family: 'DM Serif Display', category: 'serif', weights: [400], italic: true },
  { family: 'Cormorant Garamond', category: 'serif', weights: [300, 400, 500, 600, 700], italic: true },
  { family: 'Inter', category: 'sans', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Manrope', category: 'sans', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Space Grotesk', category: 'sans', weights: [300, 400, 500, 600, 700] },
  { family: 'Archivo', category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Syne', category: 'display', weights: [400, 500, 600, 700, 800] },
  { family: 'Oswald', category: 'display', weights: [300, 400, 500, 600, 700] },
  { family: 'Bebas Neue', category: 'display', weights: [400] },
];

export const fontWeights = (family: string): number[] =>
  FONTS.find((f) => f.family === family)?.weights ?? [400, 700];

export const nearestWeight = (family: string, w: number): number => {
  const ws = fontWeights(family);
  return ws.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), ws[0]);
};

let fontsReady: Promise<void> | null = null;

/** Garante que todas as fontes/pesos estejam carregados antes de medir/desenhar. */
export function ensureFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const loads: Promise<unknown>[] = [];
  for (const f of FONTS) {
    for (const w of f.weights) {
      loads.push(document.fonts.load(`${w} 40px "${f.family}"`).catch(() => null));
      if (f.italic) loads.push(document.fonts.load(`italic ${w} 40px "${f.family}"`).catch(() => null));
    }
  }
  // Não bloquear indefinidamente caso o Google Fonts esteja indisponível (offline).
  fontsReady = Promise.race([
    Promise.all(loads).then(() => undefined),
    new Promise<void>((r) => setTimeout(r, 6000)),
  ]);
  return fontsReady;
}
