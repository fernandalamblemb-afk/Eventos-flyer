import { createRoot } from 'react-dom/client';
import { Layer, Stage } from 'react-konva';
import type Konva from 'konva';
import type { Artboard, Asset, DesignElement, Fill, ImageElement, Project, TextElement } from '../types';
import { StaticArtboard, containBox, coverCrop, gradientPoints } from '../components/ArtboardRenderer';
import { getCachedImage, preloadImages } from './imageCache';
import { ensureFonts } from '../engine/fonts';
import { wrapLines, lineWidth } from '../engine/text';
import { dataUrlToBlob, saveFile, slug } from './files';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

/**
 * Renderiza a prancheta fora da tela, em resolução real (1080 px de largura × pixelRatio),
 * usando o mesmo renderizador do editor.
 */
export async function renderArtboardPNG(ab: Artboard, assets: Record<string, Asset>, pixelRatio = 1): Promise<string> {
  await ensureFonts();
  await preloadImages(Object.values(assets).map((a) => a.src));
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  let stage: Konva.Stage | null = null;
  try {
    await new Promise<void>((resolve) => {
      root.render(
        <Stage
          width={ab.width}
          height={ab.height}
          ref={(s) => {
            if (s && !stage) {
              stage = s;
              resolve();
            }
          }}
        >
          <Layer>
            <StaticArtboard ab={ab} assets={assets} />
          </Layer>
        </Stage>,
      );
    });
    await nextFrame();
    await nextFrame();
    await new Promise((r) => setTimeout(r, 60));
    const s = stage as unknown as Konva.Stage;
    s.draw();
    return s.toDataURL({ pixelRatio, mimeType: 'image/png' });
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function exportPNG(project: Project, format: 'feed' | 'story', pixelRatio = 1) {
  const url = await renderArtboardPNG(project[format], project.assets, pixelRatio);
  const ab = project[format];
  await saveFile(await dataUrlToBlob(url), `${slug(project.name)}-${format}-${ab.width * pixelRatio}x${ab.height * pixelRatio}.png`);
}

// ------------------------------------------------------------------ SVG

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fillAttr(fill: Fill, w: number, h: number, defs: string[], id: string): string {
  if (fill.type === 'linear') {
    const { start, end } = gradientPoints(fill.angle, w, h);
    defs.push(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}">` +
        `<stop offset="0" stop-color="${fill.color}" stop-opacity="${fill.alpha1 ?? 1}"/>` +
        `<stop offset="1" stop-color="${fill.color2}" stop-opacity="${fill.alpha2 ?? 1}"/></linearGradient>`,
    );
    return `fill="url(#${id})"`;
  }
  return fill.color && fill.color !== 'transparent' ? `fill="${fill.color}"` : 'fill="none"';
}

function maskD(mask: string, w: number, h: number, r: number) {
  if (mask === 'circle') return `M0,${h / 2} a${w / 2},${h / 2} 0 1,0 ${w},0 a${w / 2},${h / 2} 0 1,0 ${-w},0 Z`;
  if (mask === 'arch') {
    const ry = Math.min(w / 2, h);
    return `M0,${h} L0,${ry} A${w / 2},${ry} 0 0,1 ${w},${ry} L${w},${h} Z`;
  }
  if (mask === 'rounded' && r > 0) {
    const rr = Math.min(r, w / 2, h / 2);
    return `M${rr},0 H${w - rr} A${rr},${rr} 0 0 1 ${w},${rr} V${h - rr} A${rr},${rr} 0 0 1 ${w - rr},${h} H${rr} A${rr},${rr} 0 0 1 0,${h - rr} V${rr} A${rr},${rr} 0 0 1 ${rr},0 Z`;
  }
  return `M0,0 H${w} V${h} H0 Z`;
}

function shadowFilter(el: DesignElement, defs: string[]) {
  if (!el.shadow?.enabled) return '';
  const id = `sh-${el.id}`;
  const s = el.shadow;
  defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${s.offsetX}" dy="${s.offsetY}" stdDeviation="${s.blur / 2}" flood-color="${s.color}" flood-opacity="${s.opacity}"/></filter>`);
  return ` filter="url(#${id})"`;
}

function textSVG(el: TextElement): string {
  const spec = { family: el.fontFamily, size: el.fontSize, weight: el.fontWeight, italic: el.italic, letterSpacing: el.letterSpacing, uppercase: el.uppercase };
  const lines = wrapLines(el.text, spec, el.width);
  const lh = el.fontSize * el.lineHeight;
  const tspans = lines
    .map((ln, i) => {
      const w = lineWidth(ln, { ...spec, uppercase: false });
      const x = el.align === 'center' ? (el.width - w) / 2 : el.align === 'right' ? el.width - w : 0;
      // baseline aproximada: centro da linha + ~0.35em (mesma lógica do Konva "middle")
      const y = i * lh + lh / 2;
      return `<tspan x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(ln)}</tspan>`;
    })
    .join('');
  return `<text font-family="'${el.fontFamily}', sans-serif" font-size="${el.fontSize}" font-weight="${el.fontWeight}"${el.italic ? ' font-style="italic"' : ''} letter-spacing="${el.letterSpacing * el.fontSize}" fill="${el.fill}" dominant-baseline="middle" xml:space="preserve">${tspans}</text>`;
}

function imageSVG(el: ImageElement, asset: Asset | undefined, defs: string[]): string {
  if (!asset) return '';
  const img = getCachedImage(asset.src) ?? { width: asset.width, height: asset.height };
  const filter = el.grayscale ? ' filter="url(#grayscale)"' : '';
  if (el.fit === 'contain') {
    const b = containBox(img, el.width, el.height);
    return `<image href="${asset.src}" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" preserveAspectRatio="none"${filter}/>`;
  }
  const c = coverCrop(img, el);
  const sx = el.width / c.width;
  const sy = el.height / c.height;
  const clipId = `clip-${el.id}`;
  defs.push(`<clipPath id="${clipId}"><path d="${maskD(el.mask, el.width, el.height, el.cornerRadius)}"/></clipPath>`);
  return `<g clip-path="url(#${clipId})"><image href="${asset.src}" x="${-c.x * sx}" y="${-c.y * sy}" width="${img.width * sx}" height="${img.height * sy}" preserveAspectRatio="none"${filter}/></g>`;
}

export async function artboardToSVG(ab: Artboard, assets: Record<string, Asset>): Promise<string> {
  await preloadImages(Object.values(assets).map((a) => a.src));
  const defs: string[] = [
    `<filter id="grayscale"><feColorMatrix type="saturate" values="0"/></filter>`,
  ];
  const families = new Set<string>();
  const body: string[] = [];
  body.push(`<rect width="${ab.width}" height="${ab.height}" ${fillAttr(ab.background, ab.width, ab.height, defs, 'bg-grad')}/>`);
  for (const el of ab.elements) {
    if (!el.visible) continue;
    const tr = `transform="translate(${el.x} ${el.y}) rotate(${el.rotation})" opacity="${el.opacity}"`;
    let inner = '';
    if (el.type === 'text') {
      families.add(el.fontFamily);
      inner = textSVG(el);
    } else if (el.type === 'image') inner = imageSVG(el, assets[el.assetId], defs);
    else {
      const fa = fillAttr(el.fill, el.width, el.height, defs, `g-${el.id}`);
      const st = el.strokeWidth > 0 && el.stroke ? ` stroke="${el.stroke}" stroke-width="${el.strokeWidth}"` : '';
      if (el.shape === 'ellipse') inner = `<ellipse cx="${el.width / 2}" cy="${el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" ${fa}${st}/>`;
      else if (el.shape === 'triangle') inner = `<polygon points="${el.width / 2},0 ${el.width},${el.height} 0,${el.height}" ${fa}${st}/>`;
      else if (el.shape === 'line') inner = `<line x1="0" y1="${el.height / 2}" x2="${el.width}" y2="${el.height / 2}" stroke="${el.stroke || el.fill.color}" stroke-width="${Math.max(1, el.strokeWidth || 2)}"/>`;
      else if (el.shape === 'arch') inner = `<path d="${maskD('arch', el.width, el.height, 0)}" ${fa}${st}/>`;
      else inner = `<rect width="${el.width}" height="${el.height}" rx="${el.cornerRadius}" ${fa}${st}/>`;
    }
    body.push(`<g ${tr}${shadowFilter(el, defs)}>${inner}</g>`);
  }
  const fontQuery = [...families].map((f) => `family=${f.replace(/ /g, '+')}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400`).join('&');
  const style = families.size ? `<style>@import url('${esc(`https://fonts.googleapis.com/css2?${fontQuery}&display=swap`)}');</style>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${ab.width}" height="${ab.height}" viewBox="0 0 ${ab.width} ${ab.height}">
${style}<defs>${defs.join('')}</defs>
${body.join('\n')}
</svg>`;
}

export async function exportSVG(project: Project, format: 'feed' | 'story') {
  const svg = await artboardToSVG(project[format], project.assets);
  await saveFile(new Blob([svg], { type: 'image/svg+xml' }), `${slug(project.name)}-${format}.svg`);
}

// ------------------------------------------------------------------ arquivo de projeto

export async function exportProjectFile(project: Project) {
  const data = JSON.stringify({ app: 'studio-design-ai', version: 1, project }, null, 0);
  await saveFile(new Blob([data], { type: 'application/json' }), `${slug(project.name)}.studio.json`);
}

export async function readProjectFile(file: File): Promise<Project> {
  const txt = await file.text();
  const data = JSON.parse(txt);
  const p = data.project ?? data;
  if (!p?.feed?.elements || !p?.story?.elements || !p?.assets) throw new Error('Arquivo de projeto inválido.');
  return p as Project;
}
