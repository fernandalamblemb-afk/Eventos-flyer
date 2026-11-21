import { useState } from 'react';
import { useStore } from '../store';
import type { Brand, Motif, Palette, StyleId } from '../types';
import { ColorInput, ConfirmDelete, FilePick, Icon } from '../components/ui';
import { FONTS } from '../engine/fonts';
import { PALETTES, extractColors, paletteFromColors } from '../engine/palettes';
import { STYLES } from '../engine/compose';
import { uid } from '../engine/factory';
import { fileToAsset } from '../lib/files';
import { deleteBrand, listBrands, saveBrand, storageAvailable } from '../lib/storage';

const MOTIFS: { id: Motif; label: string }[] = [
  { id: 'cantos', label: 'Cantoneiras' },
  { id: 'linhas', label: 'Linha vertical' },
  { id: 'circulos', label: 'Círculo vazado' },
  { id: 'grade', label: 'Grade sutil' },
  { id: 'barras', label: 'Barras de borda' },
];

const ROLES: { key: keyof Omit<Palette, 'id' | 'name'>; label: string }[] = [
  { key: 'bg', label: 'Fundo' },
  { key: 'surface', label: 'Superfície' },
  { key: 'ink', label: 'Texto' },
  { key: 'muted', label: 'Texto secundário' },
  { key: 'accent', label: 'Destaque' },
  { key: 'accent2', label: 'Destaque 2' },
];

const newBrand = (): Brand => ({
  id: uid(),
  name: '',
  logo: null,
  palette: { ...PALETTES[1], id: 'brand', name: 'Marca' },
  fontDisplay: 'Fraunces',
  fontBody: 'Inter',
  style: 'editorial',
  motifs: [],
  updatedAt: Date.now(),
});

export function BrandsScreen() {
  const { brands, setBrands, notify } = useStore();
  const [edit, setEdit] = useState<Brand | null>(null);

  const refresh = async () => setBrands(await listBrands());

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return notify('Dê um nome à organização.', 'err');
    await saveBrand({ ...edit, updatedAt: Date.now() });
    await refresh();
    setEdit(null);
    notify('Marca salva.');
  };

  const remove = async (id: string) => {
    await deleteBrand(id);
    await refresh();
  };

  const setPal = (k: keyof Palette, v: string) => edit && setEdit({ ...edit, palette: { ...edit.palette, [k]: v } });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="panel-title">Identidade visual</p>
          <h1 className="mt-2 font-display text-4xl font-light tracking-tight">Biblioteca de marcas</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Marcas ficam salvas {storageAvailable() ? 'neste navegador (IndexedDB)' : 'apenas nesta sessão'} e podem ser selecionadas no briefing.
          </p>
        </div>
        {!edit && (
          <button className="btn-primary" onClick={() => setEdit(newBrand())}>
            <Icon name="plus" /> Nova marca
          </button>
        )}
      </div>

      {edit && (
        <div className="mt-8 grid gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <label className="field-label">Nome da organização</label>
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Logotipo</label>
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-32 items-center justify-center rounded-md border border-zinc-800 bg-[repeating-conic-gradient(#27272a_0_25%,#18181b_0_50%)] bg-[length:12px_12px]">
                  {edit.logo ? <img src={edit.logo.src} className="max-h-16 max-w-28 object-contain" alt="" /> : <span className="text-xs text-zinc-600">sem logo</span>}
                </div>
                <FilePick
                  accept="image/png,image/svg+xml,image/webp,image/jpeg"
                  className="btn-outline"
                  onFiles={async ([f]) => {
                    const a = await fileToAsset(f, 'logo');
                    setEdit((cur) => (cur ? { ...cur, logo: a } : cur));
                  }}
                >
                  <Icon name="upload" /> Enviar
                </FilePick>
                {edit.logo && (
                  <button
                    className="btn-ghost text-xs"
                    onClick={async () => {
                      const colors = await extractColors(edit.logo!.src, 5);
                      const p = paletteFromColors(colors, 'brand', 'Marca');
                      setEdit({ ...edit, palette: p });
                    }}
                  >
                    Extrair paleta do logo
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Fonte de títulos</label>
                <select className="input" value={edit.fontDisplay} onChange={(e) => setEdit({ ...edit, fontDisplay: e.target.value })}>
                  {FONTS.map((f) => (
                    <option key={f.family}>{f.family}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Fonte de texto</label>
                <select className="input" value={edit.fontBody} onChange={(e) => setEdit({ ...edit, fontBody: e.target.value })}>
                  {FONTS.map((f) => (
                    <option key={f.family}>{f.family}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 p-4">
              <div style={{ fontFamily: edit.fontDisplay }} className="text-3xl" >
                {edit.name || 'Nome da organização'}
              </div>
              <div style={{ fontFamily: edit.fontBody }} className="mt-1 text-sm text-zinc-400">
                Texto de apoio com a fonte de leitura escolhida.
              </div>
            </div>
            <div>
              <label className="field-label">Estilo visual</label>
              <select className="input" value={edit.style} onChange={(e) => setEdit({ ...edit, style: e.target.value as StyleId })}>
                {STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Elementos gráficos recorrentes</label>
              <div className="flex flex-wrap gap-2">
                {MOTIFS.map((m) => {
                  const on = edit.motifs.includes(m.id);
                  return (
                    <button key={m.id} className={`chip ${on ? 'chip-active' : ''}`} onClick={() => setEdit({ ...edit, motifs: on ? edit.motifs.filter((x) => x !== m.id) : [...edit.motifs, m.id] })}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <label className="field-label">Paleta de cores</label>
              <div className="mb-3 flex h-12 overflow-hidden rounded-md">
                {ROLES.map((r) => (
                  <div key={r.key} className="flex-1" style={{ background: edit.palette[r.key] }} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map((r) => (
                  <div key={r.key}>
                    <div className="mb-1 text-[11px] text-zinc-500">{r.label}</div>
                    <ColorInput value={edit.palette[r.key]} onChange={(v) => setPal(r.key, v)} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="mr-1 text-[11px] text-zinc-500">Partir de:</span>
                {PALETTES.map((p) => (
                  <button key={p.id} className="chip !px-2 !py-0.5 text-[11px]" onClick={() => setEdit({ ...edit, palette: { ...p, id: 'brand', name: 'Marca' } })}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button className="btn-primary" onClick={save}>
                <Icon name="check" /> Salvar marca
              </button>
              <button className="btn-ghost" onClick={() => setEdit(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => (
          <div key={b.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-16 items-center justify-center rounded bg-zinc-800/60">
                {b.logo ? <img src={b.logo.src} className="max-h-10 max-w-14 object-contain" alt="" /> : <Icon name="brand" />}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{b.name}</div>
                <div className="text-xs text-zinc-500">
                  {b.fontDisplay} · {b.fontBody}
                </div>
              </div>
            </div>
            <div className="mt-4 flex h-6 overflow-hidden rounded">
              {ROLES.map((r) => (
                <div key={r.key} className="flex-1" style={{ background: b.palette[r.key] }} />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn-outline flex-1 text-xs" onClick={() => setEdit(structuredClone(b))}>
                Editar
              </button>
              <ConfirmDelete onConfirm={() => remove(b.id)} />
            </div>
          </div>
        ))}
        {!brands.length && !edit && <p className="text-sm text-zinc-500">Nenhuma marca cadastrada ainda.</p>}
      </div>
    </div>
  );
}
