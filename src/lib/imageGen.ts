// Integração (preparada) com APIs de geração de imagens.
// A IA gera APENAS fundos/texturas. Textos e logotipos continuam como camadas vetoriais editáveis.
import type { Brief, Palette, StyleId } from '../types';

export type ImageProvider = 'none' | 'openai' | 'custom';

export interface ImageGenConfig {
  provider: ImageProvider;
  apiKey: string;
  model: string;
  endpoint: string; // para "custom"
}

const KEY = 'studio-design-ai:imagegen';

export const defaultImageGenConfig = (): ImageGenConfig => ({ provider: 'none', apiKey: '', model: 'gpt-image-1', endpoint: '' });

export function loadImageGenConfig(): ImageGenConfig {
  try {
    return { ...defaultImageGenConfig(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return defaultImageGenConfig();
  }
}

export function saveImageGenConfig(c: ImageGenConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* armazenamento indisponível */
  }
}

export const isImageGenConfigured = (c: ImageGenConfig) =>
  c.provider === 'openai' ? !!c.apiKey : c.provider === 'custom' ? !!c.endpoint : false;

const STYLE_DIRECTION: Record<StyleId, string> = {
  editorial: 'editorial magazine photography backdrop, soft natural light, subtle paper grain',
  minimalista: 'minimal abstract composition, large negative space, soft gradients, swiss modernism',
  cinematografico: 'cinematic atmospheric backdrop, volumetric light, film grain, anamorphic mood',
  contemporaneo: 'contemporary abstract geometric shapes, bold color fields, clean matte textures',
  corporativo: 'clean corporate abstract backdrop, soft light gradients, professional and calm',
  luxo: 'luxurious abstract texture, elegant soft light, marble or silk feel, refined and subtle',
};

/** Prompt de diretor de arte: fundo sem texto, sem pessoas, sem logotipos. */
export function buildBackgroundPrompt(brief: Brief, palette: Palette, format: 'feed' | 'story') {
  return [
    `Abstract background artwork for an event poster (${format === 'story' ? 'vertical 9:16' : 'portrait 4:5'}).`,
    `Theme inspiration (do not write it): ${brief.eventName}${brief.subtitle ? ' — ' + brief.subtitle : ''}.`,
    `Art direction: ${STYLE_DIRECTION[brief.style]}.`,
    `Color palette: ${palette.bg}, ${palette.surface}, ${palette.accent}, ${palette.accent2}.`,
    'Absolutely no text, no letters, no numbers, no logos, no watermarks, no people.',
    'Leave calm areas with low detail for typography. High-end, tasteful, not artificial looking.',
  ].join(' ');
}

/** Gera uma imagem e retorna um dataURL. Lança erro descritivo em caso de falha. */
export async function generateBackground(cfg: ImageGenConfig, prompt: string, format: 'feed' | 'story'): Promise<string> {
  if (cfg.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model || 'gpt-image-1', prompt, size: format === 'story' ? '1024x1536' : '1024x1536', n: 1 }),
    });
    if (!res.ok) throw new Error(`API respondeu ${res.status}: ${(await res.text()).slice(0, 240)}`);
    const data = await res.json();
    const item = data.data?.[0];
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item?.url) return await urlToDataUrl(item.url);
    throw new Error('Resposta sem imagem.');
  }
  if (cfg.provider === 'custom') {
    // Contrato: POST {prompt, width, height} → {image: "data:..." | "https://..."}
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({ prompt, width: 1080, height: format === 'story' ? 1920 : 1350 }),
    });
    if (!res.ok) throw new Error(`Endpoint respondeu ${res.status}`);
    const data = await res.json();
    if (typeof data.image !== 'string') throw new Error('Resposta deve conter { image }.');
    return data.image.startsWith('data:') ? data.image : await urlToDataUrl(data.image);
  }
  throw new Error('Nenhuma API de imagem configurada.');
}

async function urlToDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
