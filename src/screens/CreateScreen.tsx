import { useState } from 'react';
import { useStore } from '../store';
import type { Asset, Palette } from '../types';
import { fileToAsset } from '../lib/files';
import { FilePick, Icon } from '../components/ui';
import { PALETTES, extractColors, paletteFromColors } from '../engine/palettes';
import { STYLES, generateProposals } from '../engine/compose';
import { ensureFonts } from '../engine/fonts';
import { resolvePalette } from '../lib/palette';

function PaletteChip({ p, active, onClick, label }: { p: Palette; active: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className={`group rounded-lg border p-2 text-left transition ${active ? 'border-zinc-200 bg-zinc-900' : 'border-zinc-800 hover:border-zinc-600'}`}>
      <div className="flex h-8 overflow-hidden rounded">
        {[p.bg, p.surface, p.ink, p.accent, p.accent2].map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="mt-1.5 truncate text-[11px] text-zinc-400">{label ?? p.name}</div>
    </button>
  );
}

function AssetGrid({ ids, assets, onRemove, contain }: { ids: string[]; assets: Record<string, Asset>; onRemove: (id: string) => void; contain?: boolean }) {
  if (!ids.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {ids.map((id) => (
        <div key={id} className="group relative h-20 w-20 overflow-hidden rounded-md border border-zinc-800 bg-[repeating-conic-gradient(#27272a_0_25%,#18181b_0_50%)] bg-[length:12px_12px]">
          <img src={assets[id]?.src} alt="" className={`h-full w-full ${contain ? 'object-contain p-1.5' : 'object-cover'}`} />
          <button onClick={() => onRemove(id)} className="absolute right-1 top-1 hidden rounded bg-black/70 p-0.5 text-white group-hover:block" title="Remover">
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function CreateScreen() {
  const { brief, briefAssets, setBrief, addBriefAsset, removeBriefAsset, brands, setProposals, go, notify, resetBrief } = useStore();
  const [busy, setBusy] = useState(false);
  const brand = brands.find((b) => b.id === brief.brandId) ?? null;

  const upload = async (files: File[], kind: Asset['kind']) => {
    for (const f of files) {
      try {
        const a = await fileToAsset(f, kind);
        addBriefAsset(a);
        const s = useStore.getState().brief;
        if (kind === 'photo') setBrief({ photoIds: [...s.photoIds, a.id] });
        if (kind === 'logo') setBrief({ logoIds: [...s.logoIds, a.id] });
        if (kind === 'reference') {
          if (s.referenceId) removeBriefAsset(s.referenceId);
          setBrief({ referenceId: a.id });
        }
      } catch {
        notify(`Não foi possível ler ${f.name}`, 'err');
      }
    }
  };

  const useExtracted = async (src: string | undefined, id: 'reference' | 'photo') => {
    if (!src) return;
    const colors = await extractColors(src, 6);
    setBrief({ paletteId: id, customPalette: paletteFromColors(colors, id, id === 'reference' ? 'Da referência' : 'Da fotografia') });
  };

  const selectBrand = (id: string | null) => {
    const b = brands.find((x) => x.id === id);
    if (!b) return setBrief({ brandId: null, paletteId: brief.paletteId === 'brand' ? 'noir' : brief.paletteId });
    // Logotipo da marca entra automaticamente na lista de logotipos
    let logoIds = brief.logoIds;
    if (b.logo && !briefAssets[b.logo.id]) {
      addBriefAsset(b.logo);
      logoIds = [b.logo.id, ...logoIds];
    } else if (b.logo && !logoIds.includes(b.logo.id)) logoIds = [b.logo.id, ...logoIds];
    setBrief({ brandId: b.id, paletteId: 'brand', style: b.style, logoIds });
  };

  const generate = async () => {
    if (!brief.eventName.trim()) return notify('Informe ao menos o nome do evento.', 'err');
    setBusy(true);
    try {
      await ensureFonts();
      const palette = resolvePalette(brief, brands);
      const proposals = generateProposals({ brief, assets: briefAssets, palette, brand });
      setProposals(proposals);
      go('proposals');
    } catch (e) {
      console.error(e);
      notify('Falha ao gerar propostas.', 'err');
    } finally {
      setBusy(false);
    }
  };

  const field = (key: 'eventName' | 'subtitle' | 'location' | 'speaker', label: string, ph: string) => (
    <div>
      <label className="field-label">{label}</label>
      <input className="input" value={brief[key]} placeholder={ph} onChange={(e) => setBrief({ [key]: e.target.value })} />
    </div>
  );

  const ref = brief.referenceId ? briefAssets[brief.referenceId] : undefined;
  const firstPhoto = brief.photoIds[0] ? briefAssets[brief.photoIds[0]] : undefined;

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1fr_380px]">
      <div>
        <p className="panel-title">Etapa 1 · Briefing</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight">Criar design</h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">Preencha apenas o que existe. O motor nunca inventa informações: campos vazios simplesmente não aparecem no layout.</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{field('eventName', 'Nome do evento *', 'Ex.: Encontro Nacional de Arquitetura')}</div>
          <div className="sm:col-span-2">{field('subtitle', 'Subtítulo', 'Ex.: Cidades que respiram')}</div>
          <div>
            <label className="field-label">Data</label>
            <input type="date" className="input [color-scheme:dark]" value={brief.date} onChange={(e) => setBrief({ date: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Horário</label>
            <input type="time" className="input [color-scheme:dark]" value={brief.time} onChange={(e) => setBrief({ time: e.target.value })} />
          </div>
          {field('location', 'Local', 'Ex.: Teatro Municipal, São Paulo')}
          {field('speaker', 'Palestrante', 'Ex.: Ana Martins')}
          <div className="sm:col-span-2">
            <label className="field-label">Informações adicionais</label>
            <textarea className="input min-h-[80px] resize-y" value={brief.extra} placeholder="Ex.: Entrada gratuita · Inscrições pelo link na bio" onChange={(e) => setBrief({ extra: e.target.value })} />
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <div>
            <label className="field-label">Fotografias</label>
            <FilePick multiple onFiles={(f) => upload(f, 'photo')} className="btn-outline w-full">
              <Icon name="upload" /> Enviar fotos
            </FilePick>
            <AssetGrid ids={brief.photoIds} assets={briefAssets} onRemove={removeBriefAsset} />
            {brief.photoIds.length > 1 && <p className="mt-1 text-[11px] text-zinc-500">A primeira foto é a principal.</p>}
          </div>
          <div>
            <label className="field-label">Logotipos</label>
            <FilePick multiple accept="image/png,image/svg+xml,image/webp,image/jpeg" onFiles={(f) => upload(f, 'logo')} className="btn-outline w-full">
              <Icon name="upload" /> Enviar logos
            </FilePick>
            <AssetGrid ids={brief.logoIds} assets={briefAssets} onRemove={removeBriefAsset} contain />
          </div>
          <div>
            <label className="field-label">Referência visual</label>
            <FilePick onFiles={(f) => upload(f, 'reference')} className="btn-outline w-full">
              <Icon name="upload" /> Enviar referência
            </FilePick>
            <AssetGrid ids={brief.referenceId ? [brief.referenceId] : []} assets={briefAssets} onRemove={removeBriefAsset} />
            {ref && <p className="mt-1 text-[11px] text-zinc-500">Usada para extrair a paleta. Não entra no layout.</p>}
          </div>
        </div>

        <div className="mt-10">
          <label className="field-label">Estilo</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STYLES.map((s) => (
              <button key={s.id} onClick={() => setBrief({ style: s.id })} className={`rounded-lg border px-4 py-3 text-left transition ${brief.style === s.id ? 'border-zinc-200 bg-zinc-900' : 'border-zinc-800 hover:border-zinc-600'}`}>
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-zinc-500">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <label className="field-label">Paleta de cores</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PALETTES.map((p) => (
              <PaletteChip key={p.id} p={p} active={brief.paletteId === p.id} onClick={() => setBrief({ paletteId: p.id })} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={!ref} onClick={() => useExtracted(ref?.src, 'reference')} className={`chip ${brief.paletteId === 'reference' ? 'chip-active' : ''} disabled:opacity-40`}>
              Extrair da referência
            </button>
            <button disabled={!firstPhoto} onClick={() => useExtracted(firstPhoto?.src, 'photo')} className={`chip ${brief.paletteId === 'photo' ? 'chip-active' : ''} disabled:opacity-40`}>
              Extrair da fotografia
            </button>
            {brand && (
              <button onClick={() => setBrief({ paletteId: 'brand' })} className={`chip ${brief.paletteId === 'brand' ? 'chip-active' : ''}`}>
                Paleta da marca
              </button>
            )}
          </div>
          {(brief.paletteId === 'reference' || brief.paletteId === 'photo') && brief.customPalette && (
            <div className="mt-3 w-48">
              <PaletteChip p={brief.customPalette} active onClick={() => undefined} />
            </div>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <label className="field-label">Identidade visual</label>
          <select className="input" value={brief.brandId ?? ''} onChange={(e) => selectBrand(e.target.value || null)}>
            <option value="">Sem marca (livre)</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {brand ? (
            <p className="mt-2 text-xs text-zinc-400">
              Usando fontes <b className="text-zinc-200">{brand.fontDisplay}</b> / <b className="text-zinc-200">{brand.fontBody}</b>, paleta e elementos recorrentes da marca.
            </p>
          ) : (
            <button className="mt-2 text-xs text-zinc-400 underline-offset-2 hover:underline" onClick={() => go('brands')}>
              Cadastrar uma marca →
            </button>
          )}

          <div className="mt-6 space-y-1 text-xs text-zinc-500">
            <p>• 3 conceitos com grades e hierarquias distintas</p>
            <p>• Versões Feed 1080×1350 e Story 1080×1920 recompostas</p>
            <p>• Textos, fotos e logos como camadas editáveis</p>
          </div>

          <button onClick={generate} disabled={busy} className="btn-primary mt-6 w-full py-3 text-sm tracking-wide">
            <Icon name="sparkles" /> {busy ? 'Compondo…' : 'GERAR 3 PROPOSTAS'}
          </button>
          <button onClick={resetBrief} className="btn-ghost mt-2 w-full text-xs">
            Limpar briefing
          </button>
        </div>
      </aside>
    </div>
  );
}
