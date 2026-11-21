import { create } from 'zustand';
import type { Artboard, Asset, Brand, Brief, DesignElement, Fill, FormatId, Project, Proposal } from './types';
import { uid } from './engine/factory';

export type Screen = 'create' | 'proposals' | 'editor' | 'brands' | 'projects';

interface Snapshot {
  feed: Artboard;
  story: Artboard;
  assets: Record<string, Asset>;
}

export const emptyBrief = (): Brief => ({
  eventName: '',
  subtitle: '',
  date: '',
  time: '',
  location: '',
  speaker: '',
  extra: '',
  photoIds: [],
  logoIds: [],
  referenceId: null,
  style: 'editorial',
  paletteId: 'noir',
  brandId: null,
});

interface State {
  screen: Screen;
  brief: Brief;
  briefAssets: Record<string, Asset>;
  proposals: Proposal[];
  project: Project | null;
  dirty: boolean;
  format: FormatId;
  selectedId: string | null;
  editingTextId: string | null;
  zoom: number;
  past: Snapshot[];
  future: Snapshot[];
  lastKey: string | null;
  lastTime: number;
  brands: Brand[];
  toast: { msg: string; kind: 'ok' | 'err' | 'info' } | null;

  go: (s: Screen) => void;
  setBrief: (p: Partial<Brief>) => void;
  addBriefAsset: (a: Asset) => void;
  removeBriefAsset: (id: string) => void;
  resetBrief: () => void;
  setProposals: (p: Proposal[]) => void;
  openProposal: (p: Proposal) => void;
  loadProject: (p: Project) => void;
  renameProject: (name: string) => void;
  markSaved: () => void;

  setFormat: (f: FormatId) => void;
  select: (id: string | null) => void;
  setEditingText: (id: string | null) => void;
  setZoom: (z: number) => void;

  update: (id: string, patch: Partial<DesignElement>, key?: string) => void;
  add: (el: DesignElement, asset?: Asset) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  reorder: (id: string, to: 'up' | 'down' | 'top' | 'bottom') => void;
  moveTo: (id: string, index: number) => void;
  setBackground: (fill: Fill, key?: string) => void;
  addAsset: (a: Asset) => void;
  replaceArtboard: (f: FormatId, a: Artboard) => void;
  undo: () => void;
  redo: () => void;

  setBrands: (b: Brand[]) => void;
  notify: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

const clone = <T,>(v: T): T => structuredClone(v);

export const useStore = create<State>((set, get) => {
  /** Aplica uma mutação na prancheta ativa registrando histórico (com agrupamento por chave). */
  const mutate = (fn: (ab: Artboard, assets: Record<string, Asset>) => void, key?: string) => {
    const s = get();
    if (!s.project) return;
    const now = Date.now();
    const coalesce = key && key === s.lastKey && now - s.lastTime < 900;
    const snap: Snapshot = { feed: s.project.feed, story: s.project.story, assets: s.project.assets };
    const next = clone({ feed: s.project.feed, story: s.project.story });
    const assets = { ...s.project.assets };
    fn(next[s.format], assets);
    set({
      project: { ...s.project, feed: next.feed, story: next.story, assets, updatedAt: now },
      past: coalesce ? s.past : [...s.past.slice(-79), snap],
      future: [],
      lastKey: key ?? null,
      lastTime: now,
      dirty: true,
    });
  };

  return {
    screen: 'create',
    brief: emptyBrief(),
    briefAssets: {},
    proposals: [],
    project: null,
    dirty: false,
    format: 'feed',
    selectedId: null,
    editingTextId: null,
    zoom: 0.5,
    past: [],
    future: [],
    lastKey: null,
    lastTime: 0,
    brands: [],
    toast: null,

    go: (screen) => set({ screen }),
    setBrief: (p) => set((s) => ({ brief: { ...s.brief, ...p } })),
    addBriefAsset: (a) => set((s) => ({ briefAssets: { ...s.briefAssets, [a.id]: a } })),
    removeBriefAsset: (id) =>
      set((s) => {
        const { [id]: _, ...rest } = s.briefAssets;
        void _;
        return {
          briefAssets: rest,
          brief: {
            ...s.brief,
            photoIds: s.brief.photoIds.filter((x) => x !== id),
            logoIds: s.brief.logoIds.filter((x) => x !== id),
            referenceId: s.brief.referenceId === id ? null : s.brief.referenceId,
          },
        };
      }),
    resetBrief: () => set({ brief: emptyBrief(), briefAssets: {}, proposals: [] }),
    setProposals: (proposals) => set({ proposals }),
    openProposal: (p) => {
      const s = get();
      const now = Date.now();
      set({
        project: {
          id: uid(),
          name: s.brief.eventName || 'Sem título',
          brief: clone(s.brief),
          assets: { ...s.briefAssets },
          conceptId: p.conceptId,
          conceptName: p.conceptName,
          feed: clone(p.feed),
          story: clone(p.story),
          createdAt: now,
          updatedAt: now,
        },
        past: [],
        future: [],
        selectedId: null,
        format: 'feed',
        screen: 'editor',
        dirty: true,
      });
    },
    loadProject: (p) => set({ project: p, past: [], future: [], selectedId: null, format: 'feed', screen: 'editor', dirty: false }),
    renameProject: (name) => set((s) => (s.project ? { project: { ...s.project, name }, dirty: true } : {})),
    markSaved: () => set({ dirty: false }),

    setFormat: (format) => set({ format, selectedId: null, editingTextId: null }),
    select: (selectedId) => set({ selectedId, editingTextId: get().editingTextId === selectedId ? get().editingTextId : null }),
    setEditingText: (editingTextId) => set({ editingTextId }),
    setZoom: (z) => set({ zoom: Math.min(3, Math.max(0.1, z)) }),

    update: (id, patch, key) =>
      mutate((ab) => {
        const i = ab.elements.findIndex((e) => e.id === id);
        if (i >= 0) ab.elements[i] = { ...ab.elements[i], ...patch } as DesignElement;
      }, key ? `${id}:${key}` : undefined),
    add: (el, asset) => {
      mutate((ab, assets) => {
        if (asset) assets[asset.id] = asset;
        ab.elements.push(el);
      });
      set({ selectedId: el.id });
    },
    remove: (id) => {
      mutate((ab) => {
        ab.elements = ab.elements.filter((e) => e.id !== id);
      });
      set({ selectedId: null });
    },
    duplicate: (id) => {
      const nid = uid();
      mutate((ab) => {
        const i = ab.elements.findIndex((e) => e.id === id);
        if (i < 0) return;
        const c = clone(ab.elements[i]);
        c.id = nid;
        c.x += 24;
        c.y += 24;
        c.locked = false;
        c.name = c.name + ' (cópia)';
        ab.elements.splice(i + 1, 0, c);
      });
      set({ selectedId: nid });
    },
    reorder: (id, to) =>
      mutate((ab) => {
        const i = ab.elements.findIndex((e) => e.id === id);
        if (i < 0) return;
        const [el] = ab.elements.splice(i, 1);
        const n = ab.elements.length;
        const j = to === 'up' ? Math.min(n, i + 1) : to === 'down' ? Math.max(0, i - 1) : to === 'top' ? n : 0;
        ab.elements.splice(j, 0, el);
      }),
    moveTo: (id, index) =>
      mutate((ab) => {
        const i = ab.elements.findIndex((e) => e.id === id);
        if (i < 0) return;
        const [el] = ab.elements.splice(i, 1);
        ab.elements.splice(Math.max(0, Math.min(ab.elements.length, index)), 0, el);
      }),
    setBackground: (fill, key) =>
      mutate((ab) => {
        ab.background = fill;
      }, key ? `bg:${key}` : undefined),
    addAsset: (a) =>
      set((s) => (s.project ? { project: { ...s.project, assets: { ...s.project.assets, [a.id]: a } } } : {})),
    replaceArtboard: (f, a) => {
      const s = get();
      if (!s.project) return;
      const snap: Snapshot = { feed: s.project.feed, story: s.project.story, assets: s.project.assets };
      set({ project: { ...s.project, [f]: a }, past: [...s.past, snap], future: [], dirty: true, selectedId: null });
    },
    undo: () => {
      const s = get();
      if (!s.project || !s.past.length) return;
      const prev = s.past[s.past.length - 1];
      const cur: Snapshot = { feed: s.project.feed, story: s.project.story, assets: s.project.assets };
      set({ project: { ...s.project, ...prev }, past: s.past.slice(0, -1), future: [cur, ...s.future], lastKey: null, dirty: true, editingTextId: null });
    },
    redo: () => {
      const s = get();
      if (!s.project || !s.future.length) return;
      const nxt = s.future[0];
      const cur: Snapshot = { feed: s.project.feed, story: s.project.story, assets: s.project.assets };
      set({ project: { ...s.project, ...nxt }, past: [...s.past, cur], future: s.future.slice(1), lastKey: null, dirty: true, editingTextId: null });
    },

    setBrands: (brands) => set({ brands }),
    notify: (msg, kind = 'ok') => {
      set({ toast: { msg, kind } });
      setTimeout(() => {
        if (get().toast?.msg === msg) set({ toast: null });
      }, 3200);
    },
  };
});

export const useArtboard = () => useStore((s) => (s.project ? s.project[s.format] : null));
