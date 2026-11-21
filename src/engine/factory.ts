import { nanoid } from 'nanoid';
import type { Fill, ImageElement, ShapeElement, ShapeKind, TextElement, Asset } from '../types';
import { defaultShadow } from '../types';
import { fitFontSize, textHeight } from './text';

export const uid = () => nanoid(10);

export const solid = (color: string): Fill => ({ type: 'solid', color, color2: color, angle: 90 });
export const linear = (color: string, color2: string, angle = 90, alpha1 = 1, alpha2 = 1): Fill => ({
  type: 'linear',
  color,
  color2,
  angle,
  alpha1,
  alpha2,
});

export interface TextOpts {
  x: number;
  y: number;
  w: number;
  family: string;
  size: number;
  weight?: number;
  italic?: boolean;
  ls?: number;
  lh?: number;
  align?: TextElement['align'];
  fill: string;
  upper?: boolean;
  role?: string;
  name?: string;
  /** Ajuste automático: encolhe o corpo até caber em maxLines. */
  fit?: { maxLines: number; minSize: number };
  opacity?: number;
}

export function text(content: string, o: TextOpts): TextElement {
  const base = {
    fontFamily: o.family,
    fontWeight: o.weight ?? 400,
    italic: o.italic ?? false,
    letterSpacing: o.ls ?? 0,
    uppercase: o.upper ?? false,
  };
  const size = o.fit
    ? fitFontSize(content, { family: base.fontFamily, weight: base.fontWeight, italic: base.italic, letterSpacing: base.letterSpacing, uppercase: base.uppercase }, o.w, o.fit.maxLines, o.size, o.fit.minSize)
    : o.size;
  const el: TextElement = {
    id: uid(),
    type: 'text',
    name: o.name ?? content.slice(0, 28),
    role: o.role,
    x: o.x,
    y: o.y,
    width: o.w,
    height: 0,
    rotation: 0,
    opacity: o.opacity ?? 1,
    locked: false,
    visible: true,
    text: content,
    fontSize: Math.round(size),
    lineHeight: o.lh ?? 1.2,
    align: o.align ?? 'left',
    fill: o.fill,
    ...base,
  };
  el.height = Math.round(textHeight(el));
  return el;
}

export interface ShapeOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: Fill;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  rotation?: number;
  opacity?: number;
  name?: string;
  role?: string;
  locked?: boolean;
}

export function shape(kind: ShapeKind, o: ShapeOpts): ShapeElement {
  return {
    id: uid(),
    type: 'shape',
    shape: kind,
    name: o.name ?? labelForShape(kind),
    role: o.role,
    x: o.x,
    y: o.y,
    width: o.w,
    height: o.h,
    rotation: o.rotation ?? 0,
    opacity: o.opacity ?? 1,
    locked: o.locked ?? false,
    visible: true,
    fill: o.fill ?? solid('transparent'),
    stroke: o.stroke ?? '',
    strokeWidth: o.strokeWidth ?? 0,
    cornerRadius: o.radius ?? 0,
  };
}

const labelForShape = (k: ShapeKind) =>
  ({ rect: 'Retângulo', ellipse: 'Elipse', triangle: 'Triângulo', line: 'Linha', arch: 'Arco' })[k];

export interface ImageOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  fit?: ImageElement['fit'];
  mask?: ImageElement['mask'];
  radius?: number;
  focusX?: number;
  focusY?: number;
  name?: string;
  role?: string;
  grayscale?: boolean;
  shadow?: boolean;
}

export function image(asset: Asset, o: ImageOpts): ImageElement {
  return {
    id: uid(),
    type: 'image',
    assetId: asset.id,
    name: o.name ?? asset.name,
    role: o.role,
    x: o.x,
    y: o.y,
    width: o.w,
    height: o.h,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fit: o.fit ?? 'cover',
    cropZoom: 1,
    focusX: o.focusX ?? 0.5,
    focusY: o.focusY ?? 0.4,
    mask: o.mask ?? 'none',
    cornerRadius: o.radius ?? 0,
    grayscale: o.grayscale ?? false,
    shadow: o.shadow ? { ...defaultShadow(), enabled: true } : undefined,
  };
}

/** Dimensões de um logotipo encaixado numa altura alvo, sem distorcer. */
export function logoBox(asset: Asset, targetH: number, maxW: number) {
  const ratio = asset.width / asset.height;
  let h = targetH;
  let w = h * ratio;
  if (w > maxW) {
    w = maxW;
    h = w / ratio;
  }
  return { w: Math.round(w), h: Math.round(h) };
}
