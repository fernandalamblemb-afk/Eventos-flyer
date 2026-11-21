import { useState } from 'react';
import { useArtboard, useStore } from '../../store';
import type { DesignElement } from '../../types';
import { Icon } from '../ui';

const typeIcon = (e: DesignElement) =>
  e.type === 'text' ? 'text' : e.type === 'image' ? 'image' : e.shape === 'ellipse' ? 'circle' : e.shape === 'triangle' ? 'triangle' : e.shape === 'line' ? 'line' : e.shape === 'arch' ? 'arch' : 'square';

export function LayersPanel() {
  const ab = useArtboard();
  const { selectedId, select, update, moveTo } = useStore();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  if (!ab) return null;
  const n = ab.elements.length;
  // Lista invertida: topo da pilha aparece primeiro
  const list = [...ab.elements].map((e, i) => ({ e, i })).reverse();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h3 className="panel-title">Camadas</h3>
        <span className="text-[11px] text-zinc-600">{n}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {list.map(({ e, i }) => (
          <div
            key={e.id}
            draggable
            onDragStart={() => setDrag(e.id)}
            onDragOver={(ev) => {
              ev.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(ev) => {
              ev.preventDefault();
              if (drag) moveTo(drag, i);
              setDrag(null);
              setOver(null);
            }}
            onClick={() => select(e.id)}
            className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${selectedId === e.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'} ${over === i ? 'ring-1 ring-[#4f8cff]' : ''} ${!e.visible ? 'opacity-50' : ''}`}
          >
            <Icon name={typeIcon(e)} size={14} className="shrink-0 text-zinc-500" />
            <span className="min-w-0 flex-1 truncate">{e.name || (e.type === 'text' ? e.text : e.type)}</span>
            <button
              className={`p-0.5 hover:text-white ${e.locked ? 'text-zinc-300' : 'text-zinc-600 opacity-0 group-hover:opacity-100'}`}
              title={e.locked ? 'Desbloquear' : 'Bloquear'}
              onClick={(ev) => {
                ev.stopPropagation();
                update(e.id, { locked: !e.locked });
              }}
            >
              <Icon name={e.locked ? 'lock' : 'unlock'} size={13} />
            </button>
            <button
              className={`p-0.5 hover:text-white ${!e.visible ? 'text-zinc-300' : 'text-zinc-600 opacity-0 group-hover:opacity-100'}`}
              title={e.visible ? 'Ocultar' : 'Mostrar'}
              onClick={(ev) => {
                ev.stopPropagation();
                update(e.id, { visible: !e.visible });
              }}
            >
              <Icon name={e.visible ? 'eye' : 'eyeOff'} size={13} />
            </button>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-600">
          <Icon name="square" size={14} /> Fundo (no painel ao lado)
        </div>
      </div>
    </div>
  );
}
