import type { TextElement } from '../types';

let ctx: CanvasRenderingContext2D | null = null;
const getCtx = () => {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')!;
  return ctx;
};

export interface FontSpec {
  family: string;
  size: number;
  weight: number;
  italic?: boolean;
  letterSpacing?: number; // em
  uppercase?: boolean;
}

export const cssFont = (f: FontSpec) =>
  `${f.italic ? 'italic ' : ''}${f.weight} ${f.size}px "${f.family}", sans-serif`;

/** Largura de uma linha, seguindo a mesma regra do Konva (letterSpacing por caractere). */
export function lineWidth(text: string, f: FontSpec): number {
  const c = getCtx();
  c.font = cssFont(f);
  const t = f.uppercase ? text.toUpperCase() : text;
  return c.measureText(t).width + (f.letterSpacing ?? 0) * f.size * t.length;
}

/** Quebra de linhas por palavra, respeitando quebras manuais. */
export function wrapLines(text: string, f: FontSpec, maxWidth: number): string[] {
  const out: string[] = [];
  const t = f.uppercase ? text.toUpperCase() : text;
  for (const para of t.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = line + ' ' + words[i];
      if (lineWidth(test, { ...f, uppercase: false }) <= maxWidth) line = test;
      else {
        out.push(line);
        line = words[i];
      }
    }
    out.push(line);
  }
  return out;
}

export function longestWord(text: string, f: FontSpec): number {
  return Math.max(0, ...text.split(/\s+/).filter(Boolean).map((w) => lineWidth(w, f)));
}

/** Encontra o maior corpo que cabe em maxLines linhas na largura disponível. */
export function fitFontSize(
  text: string,
  f: Omit<FontSpec, 'size'>,
  maxWidth: number,
  maxLines: number,
  maxSize: number,
  minSize: number,
): number {
  let size = maxSize;
  while (size > minSize) {
    const spec = { ...f, size };
    if (longestWord(text, spec) <= maxWidth && wrapLines(text, spec, maxWidth).length <= maxLines) return size;
    size = Math.floor(size * 0.96);
  }
  return minSize;
}

export function textHeight(el: Pick<TextElement, 'text' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'italic' | 'letterSpacing' | 'uppercase' | 'lineHeight' | 'width'>) {
  const lines = wrapLines(
    el.text,
    { family: el.fontFamily, size: el.fontSize, weight: el.fontWeight, italic: el.italic, letterSpacing: el.letterSpacing, uppercase: el.uppercase },
    el.width,
  );
  return Math.max(1, lines.length) * el.fontSize * el.lineHeight;
}
