import { useState } from 'react';
import { useArtboard, useStore } from '../../store';
import type { ShapeKind } from '../../types';
import { image, shape, solid, text } from '../../engine/factory';
import { fileToAsset } from '../../lib/files';
import { resolvePalette } from '../../lib/palette';
import { FilePick, Icon } from '../ui';

/** Barra de ferramentas lateral: inserção de textos, formas e imagens. */
export function Toolbar({ onOpenAI }: { onOpenAI: () => void }) {
  const ab = useArtboard();
  const project = useStore((s) => s.project);
  const brands = useStore((s) => s.brands);
  const add = useStore((s) => s.add);
  const notify = useStore((s) => s.notify);
  const [assetsOpen, setAssetsOpen] = useState(false);
  if (!ab || !project) return null;
  const p = resolvePalette(project.brief, brands);
  const cx = ab.width / 2;
  const cy = ab.height / 2;

  const addText = (kind: 'title' | 'sub' | 'body') => {
    const cfg = {
      title: { s: 'Título', size: 96, weight: 700, family: 'Fraunces' },
      sub: { s: 'Subtítulo', size: 44, weight: 500, family: 'Inter' },
      body: { s: 'Texto de apoio', size: 28, weight: 400, family: 'Inter' },
    }[kind];
    const w = 720;
    const el = text(cfg.s, { x: cx - w / 2, y: cy - cfg.size / 2, w, family: cfg.family, size: cfg.size, weight: cfg.weight, fill: p.ink, align: 'center', name: cfg.s });
    add(el);
  };

  const addShape = (k: ShapeKind) => {
    const size = 320;
    const el = shape(k, {
      x: cx - size / 2,
      y: cy - (k === 'line' ? 2 : size / 2),
      w: size,
      h: k === 'line' ? 4 : k === 'arch' ? size * 1.3 : size,
      fill: k === 'line' ? solid('transparent') : solid(p.accent),
      stroke: k === 'line' ? p.ink : '',
      strokeWidth: k === 'line' ? 3 : 0,
    });
    add(el);
  };

  const addImage = (assetId: string) => {
    const a = project.assets[assetId];
    if (!a) return;
    const w = Math.min(600, a.width);
    const h = (w * a.height) / a.width;
    add(image(a, { x: cx - w / 2, y: cy - h / 2, w, h, fit: a.kind === 'logo' ? 'contain' : 'cover', focusY: 0.5 }));
    setAssetsOpen(false);
  };

  const tools: [string, string, () => void][] = [
    ['text', 'Título', () => addText('title')],
    ['square', 'Retângulo', () => addShape('rect')],
    ['circle', 'Elipse', () => addShape('ellipse')],
    ['triangle', 'Triângulo', () => addShape('triangle')],
    ['line', 'Linha', () => addShape('line')],
    ['arch', 'Arco', () => addShape('arch')],
  ];

  return (
    <div className="relative flex w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-800 bg-zinc-950 py-3">
      <button className="icon-btn h-10 w-10" title="Adicionar subtítulo" onClick={() => addText('sub')}>
        <span className="text-sm font-semibold">T</span>
      </button>
      <button className="icon-btn h-10 w-10" title="Adicionar texto de apoio" onClick={() => addText('body')}>
        <span className="text-[11px]">Tt</span>
      </button>
      {tools.map(([ic, label, fn]) => (
        <button key={label} className="icon-btn h-10 w-10" title={`Adicionar ${label.toLowerCase()}`} onClick={fn}>
          <Icon name={ic} size={18} />
        </button>
      ))}
      <div className="my-1 h-px w-8 bg-zinc-800" />
      <FilePick
        className="icon-btn h-10 w-10"
        multiple
        onFiles={async (files) => {
          for (const f of files) {
            try {
              const a = await fileToAsset(f, 'upload');
              const w = Math.min(600, a.width);
              const h = (w * a.height) / a.width;
              add(image(a, { x: cx - w / 2, y: cy - h / 2, w, h, fit: 'cover', focusY: 0.5 }), a);
            } catch {
              notify(`Não foi possível ler ${f.name}`, 'err');
            }
          }
        }}
      >
        <Icon name="upload" size={18} />
      </FilePick>
      <button className={`icon-btn h-10 w-10 ${assetsOpen ? 'bg-zinc-800 text-white' : ''}`} title="Imagens do projeto" onClick={() => setAssetsOpen(!assetsOpen)}>
        <Icon name="image" size={18} />
      </button>
      <button className="icon-btn h-10 w-10" title="Fundo com IA" onClick={onOpenAI}>
        <Icon name="sparkles" size={18} />
      </button>

      {assetsOpen && (
        <div className="absolute left-14 top-2 z-30 w-64 rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="panel-title">Imagens do projeto</span>
            <button className="icon-btn h-6 w-6" onClick={() => setAssetsOpen(false)}>
              <Icon name="x" size={12} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(project.assets)
              .filter((a) => a.kind !== 'reference')
              .map((a) => (
                <button key={a.id} title={a.name} onClick={() => addImage(a.id)} className="aspect-square overflow-hidden rounded border border-zinc-800 bg-zinc-900 hover:border-zinc-500">
                  <img src={a.src} alt="" className={`h-full w-full ${a.kind === 'logo' ? 'object-contain p-1' : 'object-cover'}`} />
                </button>
              ))}
          </div>
          {!Object.keys(project.assets).length && <p className="text-xs text-zinc-500">Nenhuma imagem ainda.</p>}
        </div>
      )}
    </div>
  );
}
