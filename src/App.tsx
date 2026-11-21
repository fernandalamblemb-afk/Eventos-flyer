import { useEffect } from 'react';
import { useStore, type Screen } from './store';
import { CreateScreen } from './screens/CreateScreen';
import { ProposalsScreen } from './screens/ProposalsScreen';
import { EditorScreen } from './screens/EditorScreen';
import { BrandsScreen } from './screens/BrandsScreen';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { listBrands } from './lib/storage';
import { ensureFonts } from './engine/fonts';

const NAV: { id: Screen; label: string }[] = [
  { id: 'create', label: 'Criar' },
  { id: 'proposals', label: 'Propostas' },
  { id: 'editor', label: 'Editor' },
  { id: 'brands', label: 'Marcas' },
  { id: 'projects', label: 'Projetos' },
];

export default function App() {
  const { screen, go, setBrands, toast, proposals, project } = useStore();

  useEffect(() => {
    ensureFonts();
    listBrands().then(setBrands).catch(() => undefined);
  }, [setBrands]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (useStore.getState().dirty && useStore.getState().project) e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-8 border-b border-zinc-800 bg-zinc-950/90 px-5 backdrop-blur">
        <button onClick={() => go('create')} className="flex items-baseline gap-2">
          <span className="font-display text-lg italic">Studio</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-400">Design AI</span>
        </button>
        <nav className="flex gap-1">
          {NAV.map((n) => {
            const disabled = (n.id === 'proposals' && !proposals.length) || (n.id === 'editor' && !project);
            return (
              <button key={n.id} disabled={disabled} onClick={() => go(n.id)} className={`rounded-md px-3 py-1.5 text-sm transition disabled:opacity-30 ${screen === n.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
                {n.label}
              </button>
            );
          })}
        </nav>
      </header>
      <main>
        {screen === 'create' && <CreateScreen />}
        {screen === 'proposals' && <ProposalsScreen />}
        {screen === 'editor' && <EditorScreen />}
        {screen === 'brands' && <BrandsScreen />}
        {screen === 'projects' && <ProjectsScreen />}
      </main>
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-2xl ${toast.kind === 'err' ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-900'}`}>{toast.msg}</div>
      )}
    </div>
  );
}
