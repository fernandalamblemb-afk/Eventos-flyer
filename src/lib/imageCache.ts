import { useEffect, useState } from 'react';

const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(src);
  if (p) return p;
  const pr = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cache.set(src, img);
      pending.delete(src);
      resolve(img);
    };
    img.onerror = (e) => {
      pending.delete(src);
      reject(e);
    };
    img.src = src;
  });
  pending.set(src, pr);
  return pr;
}

export const getCachedImage = (src: string) => cache.get(src);

export function preloadImages(srcs: string[]) {
  return Promise.all(srcs.map((s) => loadImage(s).catch(() => null)));
}

export function useImage(src: string | undefined): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(() => (src ? cache.get(src) : undefined));
  useEffect(() => {
    if (!src) return setImg(undefined);
    const c = cache.get(src);
    if (c) return setImg(c);
    let alive = true;
    loadImage(src).then((i) => alive && setImg(i)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [src]);
  return img;
}
