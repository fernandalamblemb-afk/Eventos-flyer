import type { Brand, Brief, Palette } from '../types';
import { PALETTES } from '../engine/palettes';

/** Resolve a paleta efetiva do briefing (pré-definida, da marca, da referência ou da foto). */
export function resolvePalette(brief: Brief, brands: Brand[]): Palette {
  if (brief.paletteId === 'brand') {
    const b = brands.find((x) => x.id === brief.brandId);
    if (b) return b.palette;
  }
  if ((brief.paletteId === 'reference' || brief.paletteId === 'photo') && brief.customPalette) return brief.customPalette;
  return PALETTES.find((p) => p.id === brief.paletteId) ?? PALETTES[0];
}

export const paletteColors = (p: Palette) => [p.bg, p.surface, p.ink, p.muted, p.accent, p.accent2];
