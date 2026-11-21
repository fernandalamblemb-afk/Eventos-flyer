import { useEffect, useState } from 'react';
import { useStore } from '../store';
import type { DesignElement, FormatId } from '../types';
import { EditorCanvas } from '../components/editor/EditorCanvas';
import { PropertiesPanel } from '../components/editor/PropertiesPanel';
import { LayersPanel } from '../components/editor/LayersPanel';
import { Toolbar } from '../components/editor/Toolbar';
import { ExportMenu, useSaveProject } from '../components/editor/ExportMenu';
import { AIBackgroundDialog } from '../components/editor/AIBackgroundDialog';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/ui';

function useShortcuts() {
  const save = useSaveProject();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        return s.redo();
      }
      if (mod && k === 's') {
        e.preventDefault();
        return void save();
      }
      const id = s.selectedId;
      const el = id && s.project ? s.project[s.format].elements.find((x) => x.id === id) : null;
      if (!el) return;
      if (mod && k === 'd') {
        e.preventDefault();
        return s.duplicate(el.id);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !el.locked) {
        e.preventDefault();
        return s.remove(el.id);
      }
      if (e.key === 'Escape') return s.select(null);
      if (e.key === 'Enter' && el.type === 'text' && !el.locked) {
        e.preventDefault();
        return s.setEditingText(el.id);
      }
      const step = e.shiftKey ? 10 : 1;
      const mv: Record<string, Partial<DesignElement>> = {
        arrowleft: { x: el.x - step },
        arrowright: { x: el.x + step },
        arrowup: { y: el.y - step },
        arrowdown: { y: el.y + step },
      };
      if (mv[k] && !el.locked) {
        e.preventDefault();
        s.update(el.id, mv[k], 'nudge');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [save]);
}

export function EditorScreen() {
  const { project, format, setFormat, undo, redo, past, future, zoom, setZoom, renameProject, dirty, go } = useStore();
  const save = useSaveProject();
  const [both, setBoth] = useState(false);
  const [ai, setAi] = useState(false);
  useShortcuts();

  if (!project)
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-zinc-400">Nenhum projeto aberto.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-primary" onClick={() => go('create')}>
            Criar design
          </button>
          <button className="btn-outline" onClick={() => go('projects')}>
            Abrir projeto
          </button>
        </div>
      </div>
    );

  const pickFormat = (f: FormatId) => {
    setBoth(false);
    setFormat(f);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* barra superior do editor */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800 px-4">
        <input className="w-56 rounded bg-transparent px-2 py-1 text-sm font-medium outline-none hover:bg-zinc-900 focus:bg-zinc-900" value={project.name} onChange={(e) => renameProject(e.target.value)} />
        <span className="hidden text-[11px] text-zinc-500 md:inline">{project.conceptName}</span>
        {dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Alterações não salvas" />}

        <div className="mx-auto flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          {(
            [
              ['feed', 'Feed', 'frame'],
              ['story', 'Story', 'phone'],
            ] as [FormatId, string, string][]
          ).map(([f, l, ic]) => (
            <button key={f} onClick={() => pickFormat(f)} className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs ${!both && format === f ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
              <Icon name={ic} size={14} /> {l}
            </button>
          ))}
          <button onClick={() => setBoth(true)} className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs ${both ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
            <Icon name="both" size={14} /> Ambos
          </button>
        </div>

        <div className="flex items-center">
          <button className="icon-btn" title="Desfazer (Ctrl+Z)" disabled={!past.length} onClick={undo}>
            <Icon name="undo" />
          </button>
          <button className="icon-btn" title="Refazer (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo}>
            <Icon name="redo" />
          </button>
        </div>
        {!both && (
          <div className="flex items-center gap-0.5 rounded-md border border-zinc-800 px-1">
            <button className="icon-btn h-7 w-7" title="Diminuir zoom" onClick={() => setZoom(zoom / 1.2)}>
              <Icon name="zoomOut" size={14} />
            </button>
            <button className="w-12 text-center text-[11px] tabular-nums text-zinc-300" title="100%" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <button className="icon-btn h-7 w-7" title="Aumentar zoom" onClick={() => setZoom(zoom * 1.2)}>
              <Icon name="zoomIn" size={14} />
            </button>
            <button className="icon-btn h-7 w-7" title="Ajustar à tela" onClick={() => window.dispatchEvent(new Event('studio:fit'))}>
              <Icon name="fit" size={14} />
            </button>
          </div>
        )}
        <button className="btn-outline" onClick={save} title="Salvar projeto (Ctrl+S)">
          <Icon name="save" /> Salvar
        </button>
        <button className="btn-ghost" onClick={() => go('projects')} title="Abrir projeto">
          <Icon name="folder" /> Abrir
        </button>
        <ExportMenu />
      </div>

      {both ? (
        <div className="flex flex-1 items-center justify-center gap-12 overflow-auto bg-[radial-gradient(#27272a_1px,transparent_1px)] p-10 [background-size:20px_20px]">
          {(['feed', 'story'] as FormatId[]).map((f) => (
            <div key={f} className="text-center">
              <button className="overflow-hidden rounded shadow-2xl ring-1 ring-white/10 transition hover:ring-[#4f8cff]" onClick={() => pickFormat(f)}>
                <Thumb ab={project[f]} assets={project.assets} width={f === 'feed' ? 440 : 340} />
              </button>
              <div className="mt-3 text-xs text-zinc-400">
                {f === 'feed' ? 'Feed · 1080 × 1350' : 'Story · 1080 × 1920'} — clique para editar
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <Toolbar onOpenAI={() => setAi(true)} />
          <div className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
            <LayersPanel />
          </div>
          <div className="min-w-0 flex-1">
            <EditorCanvas />
          </div>
          <div className="w-80 shrink-0 overflow-y-auto border-l border-zinc-800 bg-zinc-950">
            <PropertiesPanel />
          </div>
        </div>
      )}
      {ai && <AIBackgroundDialog onClose={() => setAi(false)} />}
    </div>
  );
}
