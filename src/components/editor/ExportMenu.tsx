import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { exportPNG, exportProjectFile, exportSVG } from '../../lib/export';
import { saveProject } from '../../lib/storage';
import { SaveDeclined } from '../../lib/files';
import { Icon } from '../ui';

export function useSaveProject() {
  const notify = useStore((s) => s.notify);
  const markSaved = useStore((s) => s.markSaved);
  return async () => {
    const p = useStore.getState().project;
    if (!p) return;
    try {
      await saveProject({ ...p, updatedAt: Date.now() });
      markSaved();
      notify('Projeto salvo.');
    } catch (e) {
      console.error(e);
      notify('Não foi possível salvar (armazenamento cheio?). Use “Exportar .json”.', 'err');
    }
  };
}

/** Tela 6 — Exportação. */
export function ExportMenu() {
  const project = useStore((s) => s.project);
  const notify = useStore((s) => s.notify);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ratio, setRatio] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  if (!project) return null;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      if (e instanceof SaveDeclined) return notify('Download cancelado.', 'info');
      console.error(e);
      notify('Falha na exportação.', 'err');
    } finally {
      setBusy(null);
    }
  };

  const item = (label: string, sub: string, fn: () => Promise<void> | void, icon = 'download') => (
    <button
      disabled={!!busy}
      onClick={() => run(label, async () => fn())}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
    >
      <Icon name={icon} />
      <span className="flex-1">{busy === label ? 'Gerando…' : label}</span>
      <span className="text-[10px] text-zinc-500">{sub}</span>
    </button>
  );

  const W = 1080 * ratio;
  return (
    <div className="relative" ref={ref}>
      <button className="btn-primary" onClick={() => setOpen(!open)}>
        <Icon name="download" /> Exportar
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-80 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="panel-title">Resolução</span>
            <div className="flex gap-1">
              {[1, 2].map((r) => (
                <button key={r} onClick={() => setRatio(r)} className={`chip !py-0.5 ${ratio === r ? 'chip-active' : ''}`}>
                  {r}× {r === 1 ? '(nativa)' : ''}
                </button>
              ))}
            </div>
          </div>
          {item('Baixar Feed PNG', `${W}×${1350 * ratio}`, () => exportPNG(project, 'feed', ratio))}
          {item('Baixar Story PNG', `${W}×${1920 * ratio}`, () => exportPNG(project, 'story', ratio))}
          {item('Baixar ambos', 'PNG', async () => {
            await exportPNG(project, 'feed', ratio);
            await exportPNG(project, 'story', ratio);
          })}
          <div className="my-1 h-px bg-zinc-800" />
          {item('Feed SVG', 'vetorial', () => exportSVG(project, 'feed'))}
          {item('Story SVG', 'vetorial', () => exportSVG(project, 'story'))}
          <p className="px-3 pb-2 pt-1 text-[10px] leading-relaxed text-zinc-500">SVG mantém textos como texto real; fontes são carregadas do Google Fonts ao abrir. Para impressão, prefira PNG 2×.</p>
          <div className="my-1 h-px bg-zinc-800" />
          {item('Exportar projeto (.json)', 'arquivo', () => exportProjectFile(project), 'save')}
        </div>
      )}
    </div>
  );
}
