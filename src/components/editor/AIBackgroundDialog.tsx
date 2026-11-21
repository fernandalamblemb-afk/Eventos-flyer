import { useState } from 'react';
import { useStore } from '../../store';
import type { FormatId } from '../../types';
import { image } from '../../engine/factory';
import { dataUrlToAsset } from '../../lib/files';
import { resolvePalette } from '../../lib/palette';
import { buildBackgroundPrompt, generateBackground, isImageGenConfigured, loadImageGenConfig, saveImageGenConfig, type ImageGenConfig } from '../../lib/imageGen';
import { Icon, Segmented } from '../ui';

/** Geração de fundos por IA — textos e logos permanecem como camadas separadas. */
export function AIBackgroundDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project)!;
  const brands = useStore((s) => s.brands);
  const format = useStore((s) => s.format);
  const notify = useStore((s) => s.notify);
  const [cfg, setCfg] = useState<ImageGenConfig>(loadImageGenConfig);
  const [prompt, setPrompt] = useState(() => buildBackgroundPrompt(project.brief, resolvePalette(project.brief, brands), format));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const configured = isImageGenConfigured(cfg);

  const run = async () => {
    saveImageGenConfig(cfg);
    setBusy(true);
    setErr('');
    try {
      const url = await generateBackground(cfg, prompt, format);
      const asset = await dataUrlToAsset(url, 'Fundo IA', 'generated');
      const s = useStore.getState();
      const ab = s.project![format as FormatId];
      const el = image(asset, { x: 0, y: 0, w: ab.width, h: ab.height, name: 'Fundo gerado por IA', role: 'ai-background', focusY: 0.5 });
      s.add(el, asset);
      s.moveTo(el.id, 0); // camada mais ao fundo: textos e logos continuam por cima e editáveis
      notify('Fundo gerado e inserido como camada inferior.');
      onClose();
    } catch (e) {
      setErr((e as Error).message || 'Falha ao gerar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Fundo com IA</h2>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-400">A IA gera apenas o fundo. Textos, fotografias e logotipos continuam como camadas separadas e editáveis.</p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="field-label">Provedor</label>
            <Segmented
              value={cfg.provider}
              options={[
                { value: 'none', label: 'Nenhum' },
                { value: 'openai', label: 'OpenAI Images' },
                { value: 'custom', label: 'Endpoint próprio' },
              ]}
              onChange={(v) => setCfg({ ...cfg, provider: v })}
            />
          </div>
          {cfg.provider === 'openai' && (
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <div>
                <label className="field-label">Chave da API</label>
                <input type="password" className="input" value={cfg.apiKey} onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })} placeholder="sk-…" />
              </div>
              <div>
                <label className="field-label">Modelo</label>
                <input className="input" value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} />
              </div>
            </div>
          )}
          {cfg.provider === 'custom' && (
            <div className="space-y-2">
              <div>
                <label className="field-label">URL do endpoint</label>
                <input className="input" value={cfg.endpoint} onChange={(e) => setCfg({ ...cfg, endpoint: e.target.value })} placeholder="https://seu-servidor/gerar-fundo" />
              </div>
              <div>
                <label className="field-label">Token (opcional)</label>
                <input type="password" className="input" value={cfg.apiKey} onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })} />
              </div>
              <p className="text-[11px] text-zinc-500">
                Contrato: <code>POST {'{prompt, width, height}'}</code> → <code>{'{image: "data:…" | "https://…"}'}</code>
              </p>
            </div>
          )}
          {cfg.provider !== 'none' && (
            <div>
              <label className="field-label">Prompt (diretor de arte)</label>
              <textarea className="input min-h-[120px] text-xs" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </div>
          )}
          <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-[11px] leading-relaxed text-amber-200/80">
            Integração preparada, mas depende de configuração externa. A chave fica salva só neste navegador e é enviada diretamente do navegador ao provedor — para produção, use um endpoint próprio no servidor para não expor a chave. Sem API configurada, todo o restante do app funciona normalmente (layouts são vetoriais).
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
          <button className="btn-primary" disabled={!configured || busy} onClick={run}>
            <Icon name="sparkles" /> {busy ? 'Gerando…' : `Gerar fundo (${format === 'feed' ? 'Feed' : 'Story'})`}
          </button>
        </div>
      </div>
    </div>
  );
}
