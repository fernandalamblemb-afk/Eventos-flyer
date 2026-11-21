import { useStore } from '../store';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/ui';

export function ProposalsScreen() {
  const { proposals, briefAssets, openProposal, go } = useStore();
  if (!proposals.length)
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-zinc-400">Nenhuma proposta gerada ainda.</p>
        <button className="btn-primary mt-4" onClick={() => go('create')}>
          Ir para o briefing
        </button>
      </div>
    );
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="panel-title">Etapa 2 · Geração automática</p>
          <h1 className="mt-2 font-display text-4xl font-light tracking-tight">Três propostas</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Cada conceito tem grade, hierarquia e tipografia próprias. Feed e Story foram recompostos — não redimensionados. Escolha uma para editar.</p>
        </div>
        <button className="btn-outline" onClick={() => go('create')}>
          <Icon name="arrowLeft" /> Ajustar briefing
        </button>
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {proposals.map((p, idx) => (
          <div key={p.id} className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-600">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl">
                <span className="mr-2 text-sm text-zinc-500">0{idx + 1}</span>
                {p.conceptName}
              </h2>
            </div>
            <p className="mt-1 min-h-[40px] text-xs leading-relaxed text-zinc-400">{p.rationale}</p>
            <div className="mt-4 flex items-end gap-3">
              <div className="overflow-hidden rounded-md shadow-2xl ring-1 ring-white/5">
                <Thumb ab={p.feed} assets={briefAssets} width={208} />
              </div>
              <div className="overflow-hidden rounded-md shadow-2xl ring-1 ring-white/5">
                <Thumb ab={p.story} assets={briefAssets} width={146} />
              </div>
            </div>
            <div className="mt-2 flex gap-3 text-[10px] uppercase tracking-widest text-zinc-500">
              <span className="w-[208px]">Feed 1080×1350</span>
              <span>Story 1080×1920</span>
            </div>
            <button className="btn-primary mt-5 w-full" onClick={() => openProposal(p)}>
              Editar esta proposta
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
