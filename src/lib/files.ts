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

type DownloadsNS = { save: (r: { filename: string; data: Blob | string }) => Promise<{ status: string }> };
type ClaudeRuntime = { use: (name: string) => Promise<unknown> };

let downloadsNS: Promise<DownloadsNS | null> | null = null;

/** Permissão "downloads" do artefato Claude (null quando o app roda fora do artefato). */
function getDownloads(): Promise<DownloadsNS | null> {
  if (!downloadsNS) {
    const c = (window as unknown as { claude?: ClaudeRuntime }).claude;
    downloadsNS = c?.use ? (c.use('downloads') as Promise<DownloadsNS | null>).catch(() => null) : Promise.resolve(null);
  }
  return downloadsNS;
}

export class SaveDeclined extends Error {}

/**
 * Entrega um arquivo ao usuário. Dentro do artefato usa a permissão "downloads"
 * (o usuário confirma o salvamento); fora dele, um download comum do navegador.
 */
export async function saveFile(blob: Blob, filename: string): Promise<void> {
  const dl = await getDownloads();
  if (dl) {
    try {
      await dl.save({ filename, data: blob });
      return;
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'declined') throw new SaveDeclined('Download cancelado.');
      if (code && code !== 'unavailable' && code !== 'not_granted') throw new Error((e as Error).message || code);
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50) || 'design';
