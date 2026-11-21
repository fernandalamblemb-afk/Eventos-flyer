import { useEffect, useRef, useState, type ReactNode } from 'react';

// Ícones de traço fino (inline, sem dependências)
const paths: Record<string, string> = {
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  text: 'M4 7V4h16v3M9 20h6M12 4v16',
  square: 'M4 4h16v16H4z',
  circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  triangle: 'M12 3 22 20H2z',
  line: 'M4 12h16',
  arch: 'M5 21V11a7 7 0 0 1 14 0v10z',
  image: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 9.5a1.5 1.5 0 1 0 0-.01',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  unlock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  top: 'M6 4h12M6 14l6-6 6 6M12 8v12',
  bottom: 'M6 20h12M6 10l6 6 6-6M12 16V4',
  download: 'M12 3v12m0 0-5-5m5 5 5-5M4 21h16',
  save: 'M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7',
  folder: 'M3 6h6l2 2h10v12H3z',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z',
  layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5',
  zoomIn: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomOut: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11h6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  alignLeft: 'M4 4v16M8 8h12M8 16h8',
  alignCenter: 'M12 4v16M6 8h12M8 16h8',
  alignRight: 'M20 4v16M4 8h12M8 16h8',
  alignTop: 'M4 4h16M8 8v12M16 8v8',
  alignMiddle: 'M4 12h16M8 6v12M16 8v8',
  alignBottom: 'M4 20h16M8 4v12M16 8v8',
  textLeft: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  textCenter: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  textRight: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  brand: 'M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.6 6.5 19.5l1-6.3L3 8.9 9 8z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  upload: 'M12 16V4m0 0-5 5m5-5 5 5M4 20h16',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  check: 'M5 12l5 5L20 7',
  arrowLeft: 'M19 12H5m0 0 6-6m-6 6 6 6',
  phone: 'M7 2h10v20H7zM11 18h2',
  frame: 'M6 3h12v18H6z',
  both: 'M3 5h8v14H3zM14 3h7v18h-7z',
};

export function Icon({ name, size = 16, className = '' }: { name: keyof typeof paths | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={paths[name] ?? ''} />
    </svg>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="border-b border-zinc-800/80 px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="panel-title">{title}</h3>
        {right}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-zinc-400">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}

export function Slider({ value, min, max, step = 1, onChange, suffix = '', format }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string; format?: (v: number) => string }) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" className="h-1 flex-1" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="w-12 text-right text-[11px] tabular-nums text-zinc-400">{format ? format(value) : `${Math.round(value * 100) / 100}${suffix}`}</span>
    </div>
  );
}

export function NumberInput({ value, onChange, step = 1, min, max }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <input
      type="number"
      className="input h-8 px-2 py-1 text-xs tabular-nums"
      value={Math.round(value * 100) / 100}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
    />
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  return (
    <div className="flex items-center gap-2">
      <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-zinc-700" style={{ background: value === 'transparent' ? 'repeating-conic-gradient(#3f3f46 0 25%, #27272a 0 50%) 50%/10px 10px' : value }}>
        <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={safe} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      </label>
      <input
        className="input h-8 px-2 py-1 font-mono text-xs uppercase"
        onChange={(e) => {
          const v = e.target.value.trim();
          if (/^#[0-9a-f]{6}$/i.test(v) || v === 'transparent') onChange(v.toUpperCase() === 'TRANSPARENT' ? 'transparent' : v.toUpperCase());
        }}
        onBlur={(e) => (e.target.value = value)}
        defaultValue={value}
        key={value}
      />
    </div>
  );
}

export function Swatches({ colors, onPick }: { colors: string[]; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[...new Set(colors)].map((c) => (
        <button key={c} title={c} onClick={() => onPick(c)} className="h-5 w-5 rounded-full border border-zinc-700 transition hover:scale-110" style={{ background: c }} />
      ))}
    </div>
  );
}

export function FilePick({ accept = 'image/*', multiple, onFiles, children, className }: { accept?: string; multiple?: boolean; onFiles: (f: File[]) => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
      {options.map((o) => (
        <button key={o.value} title={o.title} onClick={() => onChange(o.value)} className={`rounded px-2.5 py-1 text-xs transition ${value === o.value ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Botão de exclusão em dois cliques (o artefato não permite janelas confirm()). */
export function ConfirmDelete({ onConfirm, title = 'Excluir' }: { onConfirm: () => void; title?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <button className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-500" onClick={onConfirm}>
      Confirmar exclusão
    </button>
  ) : (
    <button className="icon-btn" title={title} onClick={() => setArmed(true)}>
      <Icon name="trash" />
    </button>
  );
}
