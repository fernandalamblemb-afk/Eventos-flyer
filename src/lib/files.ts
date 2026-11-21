import type { Asset } from '../types';
import { uid } from '../engine/factory';

const MAX_SIDE = 3000; // preserva a fotografia com folga para exportar em 1080px

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function imageSize(src: string): Promise<{ width: number; height: number; img: HTMLImageElement }> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight, img });
    img.onerror = rej;
    img.src = src;
  });
}

/**
 * Converte um arquivo em Asset. Fotografias muito grandes são reduzidas apenas em
 * resolução (sem recorte nem alteração de conteúdo) para caber no armazenamento local.
 * Logotipos (PNG/SVG) são mantidos integralmente, preservando transparência.
 */
export async function fileToAsset(file: File, kind: Asset['kind']): Promise<Asset> {
  let src = await readFileAsDataURL(file);
  let { width, height, img } = await imageSize(src);
  const isVectorOrAlpha = /svg|png|webp|gif/.test(file.type);
  if (kind !== 'logo' && !isVectorOrAlpha && Math.max(width, height) > MAX_SIDE) {
    const s = MAX_SIDE / Math.max(width, height);
    const c = document.createElement('canvas');
    c.width = Math.round(width * s);
    c.height = Math.round(height * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    src = c.toDataURL('image/jpeg', 0.92);
    width = c.width;
    height = c.height;
  }
  if (file.type.includes('svg') && (!width || !height)) {
    width = 600;
    height = 300;
  }
  return { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), kind, src, width, height };
}

export async function dataUrlToAsset(src: string, name: string, kind: Asset['kind']): Promise<Asset> {
  const { width, height } = await imageSize(src);
  return { id: uid(), name, kind, src, width, height };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50) || 'design';
