import { useEffect, useState } from 'react';
import { useStore } from '../store';
import type { Project } from '../types';
import { deleteProject, listProjects, storageAvailable } from '../lib/storage';
import { readProjectFile } from '../lib/export';
import { Thumb } from '../components/Thumb';
import { ConfirmDelete, FilePick, Icon } from '../components/ui';

export function ProjectsScreen() {
  const { loadProject, notify, go } = useStore();
  const [items, setItems] = useState<Project[] | null>(null);
  const refresh = () => listProjects().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="panel-title">Projetos</p>
          <h1 className="mt-2 font-display text-4xl font-light tracking-tight">Meus projetos</h1>
          <p className="mt-2 text-sm text-zinc-400">{storageAvailable() ? 'Salvos neste navegador (IndexedDB). Use “Exportar .json” no editor para levar a outro computador.' : 'Armazenamento local indisponível: use arquivos .json.'}</p>
        </div>
        <div className="flex gap-2">
          <FilePick
            accept=".json,application/json"
            className="btn-outline"
            onFiles={async ([f]) => {
              try {
                loadProject(await readProjectFile(f));
                notify('Projeto aberto.');
              } catch (e) {
                notify((e as Error).message || 'Arquivo inválido.', 'err');
              }
            }}
          >
            <Icon name="folder" /> Abrir arquivo .json
          </FilePick>
          <button className="btn-primary" onClick={() => go('create')}>
            <Icon name="plus" /> Novo design
          </button>
        </div>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items?.map((p) => (
          <div key={p.id} className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-600">
            <button className="block w-full overflow-hidden rounded-md" onClick={() => loadProject(p)}>
              <Thumb ab={p.feed} assets={p.assets} width={240} />
            </button>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="text-[11px] text-zinc-500">
                  {p.conceptName} · {new Date(p.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>
              <ConfirmDelete
                onConfirm={async () => {
                  await deleteProject(p.id);
                  refresh();
                }}
              />
            </div>
          </div>
        ))}
        {items && !items.length && <p className="text-sm text-zinc-500">Nenhum projeto salvo ainda.</p>}
      </div>
    </div>
  );
}
