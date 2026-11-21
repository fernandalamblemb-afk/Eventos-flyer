// Persistência local via IndexedDB (suporta projetos com imagens grandes).
// Em ambientes sem IndexedDB, cai para memória (os dados se perdem ao recarregar).
import type { Brand, Project } from '../types';

const DB = 'studio-design-ai';
const VERSION = 1;
type Store = 'projects' | 'brands';

let dbPromise: Promise<IDBDatabase> | null = null;
const memory: Record<Store, Map<string, unknown>> = { projects: new Map(), brands: new Map() };

export const storageAvailable = () => typeof indexedDB !== 'undefined';

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('brands')) db.createObjectStore('brands', { keyPath: 'id' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return dbPromise;
}

async function tx<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function put<T extends { id: string }>(store: Store, v: T) {
  if (!storageAvailable()) return void memory[store].set(v.id, v);
  try {
    await tx(store, 'readwrite', (s) => s.put(v));
  } catch {
    memory[store].set(v.id, v);
  }
}
async function all<T>(store: Store): Promise<T[]> {
  if (!storageAvailable()) return [...memory[store].values()] as T[];
  try {
    return await tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
  } catch {
    return [...memory[store].values()] as T[];
  }
}
async function get<T>(store: Store, id: string): Promise<T | undefined> {
  if (!storageAvailable()) return memory[store].get(id) as T | undefined;
  return tx<T | undefined>(store, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
}
async function del(store: Store, id: string) {
  memory[store].delete(id);
  if (storageAvailable()) await tx(store, 'readwrite', (s) => s.delete(id));
}

export const saveProject = (p: Project) => put('projects', p);
export const loadProject = (id: string) => get<Project>('projects', id);
export const deleteProject = (id: string) => del('projects', id);
export const listProjects = async () => (await all<Project>('projects')).sort((a, b) => b.updatedAt - a.updatedAt);

export const saveBrand = (b: Brand) => put('brands', b);
export const deleteBrand = (id: string) => del('brands', id);
export const listBrands = async () => (await all<Brand>('brands')).sort((a, b) => a.name.localeCompare(b.name));
