import type { Palette } from '../types';

export const PALETTES: Palette[] = [
  { id: 'noir', name: 'Noir editorial', bg: '#0E0E0E', surface: '#1B1A18', ink: '#F4F1EA', muted: '#9A958C', accent: '#C8A46B', accent2: '#6B5B45' },
  { id: 'papel', name: 'Papel & tinta', bg: '#F3EFE7', surface: '#E6DFD3', ink: '#141414', muted: '#6E675D', accent: '#B4442E', accent2: '#2D3A3A' },
  { id: 'meia-noite', name: 'Azul meia-noite', bg: '#0B1426', surface: '#14233F', ink: '#F1F3F7', muted: '#8E9BB3', accent: '#D9B26F', accent2: '#3E6FB0' },
  { id: 'salvia', name: 'Sálvia', bg: '#E8EBE3', surface: '#D3D9CB', ink: '#1F2A22', muted: '#5E6B60', accent: '#2F5D46', accent2: '#C9A227' },
  { id: 'terracota', name: 'Terracota', bg: '#F1E6DA', surface: '#E4CFBA', ink: '#2A1A14', muted: '#7D6455', accent: '#B5552F', accent2: '#1F3B4D' },
  { id: 'bordo', name: 'Bordô', bg: '#2A0F14', surface: '#3E1820', ink: '#F6E9E2', muted: '#C2A39A', accent: '#E0B48A', accent2: '#8C2F3C' },
  { id: 'mono', name: 'Monocromático', bg: '#FFFFFF', surface: '#F0F0F0', ink: '#0A0A0A', muted: '#707070', accent: '#0A0A0A', accent2: '#FF3B1F' },
  { id: 'eletrico', name: 'Elétrico', bg: '#0D0D12', surface: '#1B1B26', ink: '#F5F5F7', muted: '#8B8B9A', accent: '#C6FF3D', accent2: '#6E5BFF' },
  { id: 'oceano', name: 'Oceano', bg: '#E9EEF1', surface: '#D2DCE2', ink: '#0F2733', muted: '#587482', accent: '#0F6E8C', accent2: '#E07A5F' },
];

// ---------- utilitários de cor ----------

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('').toUpperCase();

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const isDark = (hex: string) => luminance(hex) < 0.2;

/** Melhor cor de texto (dentre candidatas) sobre um fundo. */
export function bestText(bg: string, candidates: string[] = ['#FFFFFF', '#0A0A0A']): string {
  return candidates.reduce((best, c) => (contrast(c, bg) > contrast(best, bg) ? c : best), candidates[0]);
}

export function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

function saturation([r, g, b]: number[]) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return max === 0 ? 0 : (max - min) / max;
}

/** Extrai cores dominantes de uma imagem (quantização simples por histograma). */
export async function extractColors(src: string, count = 6): Promise<string[]> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0, size, size);
  const data = x.getImageData(0, 0, size, size).data;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const key = `${data[i] >> 4}-${data[i + 1] >> 4}-${data[i + 2] >> 4}`;
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bk.n++;
    bk.r += data[i];
    bk.g += data[i + 1];
    bk.b += data[i + 2];
    buckets.set(key, bk);
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => [b.r / b.n, b.g / b.n, b.b / b.n]);
  const picked: number[][] = [];
  for (const c of sorted) {
    if (picked.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) > 48)) picked.push(c);
    if (picked.length >= count) break;
  }
  return picked.map((c) => rgbToHex(c[0], c[1], c[2]));
}

/** Constrói uma paleta funcional (com contraste garantido) a partir de cores extraídas. */
export function paletteFromColors(colors: string[], id: string, name: string): Palette {
  if (!colors.length) return { ...PALETTES[0], id, name };
  const byLum = [...colors].sort((a, b) => luminance(a) - luminance(b));
  const darkest = byLum[0];
  const lightest = byLum[byLum.length - 1];
  const dominant = colors[0];
  const darkMode = luminance(dominant) < 0.35;
  const bg = darkMode ? mix(darkest, '#000000', 0.35) : mix(lightest, '#FFFFFF', 0.55);
  let ink = darkMode ? mix(lightest, '#FFFFFF', 0.7) : mix(darkest, '#000000', 0.6);
  if (contrast(ink, bg) < 7) ink = darkMode ? '#F5F3EE' : '#121212';
  const accentCandidates = [...colors].sort((a, b) => saturation(hexToRgb(b)) - saturation(hexToRgb(a)));
  let accent = accentCandidates.find((c) => contrast(c, bg) >= 3) ?? accentCandidates[0];
  if (contrast(accent, bg) < 2.5) accent = mix(accent, ink, 0.5);
  const accent2 = accentCandidates.find((c) => c !== accent) ?? mix(accent, bg, 0.5);
  return {
    id,
    name,
    bg,
    surface: mix(bg, ink, 0.08),
    ink,
    muted: mix(ink, bg, 0.45),
    accent,
    accent2,
  };
}
