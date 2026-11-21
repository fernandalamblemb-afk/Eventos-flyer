// Motor de composição: transforma o briefing em layouts vetoriais editáveis.
// Cada conceito possui sua própria lógica de grade, hierarquia e recomposição feed/story.

import type { Artboard, Asset, Brand, Brief, DesignElement, Fill, FormatId, Motif, Palette, Proposal, StyleId, TextElement } from '../types';
import { FORMATS } from '../types';
import { image, linear, logoBox, shape, solid, text, uid } from './factory';
import { bestText, contrast, isDark, luminance, mix } from './palettes';
import { lineWidth } from './text';
import { nearestWeight } from './fonts';

// ------------------------------------------------------------------ dados derivados

export interface Info {
  title: string;
  subtitle: string;
  dateLong: string;
  dateShort: string;
  day: string;
  monthShort: string;
  monthLong: string;
  year: string;
  weekday: string;
  time: string;
  location: string;
  speaker: string;
  extra: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function deriveInfo(b: Brief): Info {
  let dateLong = '', dateShort = '', day = '', monthShort = '', monthLong = '', year = '', weekday = '';
  if (b.date) {
    const [y, m, d] = b.date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) {
      monthLong = dt.toLocaleDateString('pt-BR', { month: 'long' });
      weekday = cap(dt.toLocaleDateString('pt-BR', { weekday: 'long' }));
      dateLong = `${weekday}, ${d} de ${monthLong} de ${y}`;
      dateShort = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
      day = String(d).padStart(2, '0');
      monthShort = monthLong.slice(0, 3).toUpperCase();
      year = String(y);
    }
  }
  let time = '';
  if (b.time) {
    const [hh, mm] = b.time.split(':');
    time = `${Number(hh)}h${mm && mm !== '00' ? mm : ''}`;
  }
  return {
    title: b.eventName.trim(),
    subtitle: b.subtitle.trim(),
    dateLong,
    dateShort,
    day,
    monthShort,
    monthLong,
    year,
    weekday,
    time,
    location: b.location.trim(),
    speaker: b.speaker.trim(),
    extra: b.extra.trim(),
  };
}

// ------------------------------------------------------------------ contexto

interface Fonts {
  display: string;
  displayWeight: number;
  body: string;
}

interface Ctx {
  W: number;
  H: number;
  story: boolean;
  p: Palette;
  f: Fonts;
  i: Info;
  photos: Asset[];
  logos: Asset[];
  motifs: Motif[];
  /** Limites seguros (story reserva áreas para a interface do Instagram). */
  top: number;
  bottom: number;
  m: number;
}

interface Out {
  bg: Fill;
  els: DesignElement[];
  /** Ponto mais baixo ocupado pelo conteúdo textual. */
  bottom: number;
  limit: number;
  /** Ponto mais alto (para layouts ancorados na base). */
  topUsed?: number;
  minTop?: number;
}

type Builder = (c: Ctx, k: number) => Out;

const bottomOf = (e: DesignElement) => e.y + e.height;
const place = <T extends DesignElement>(e: T, y: number): T => {
  e.y = Math.round(y);
  return e;
};
const shiftAll = (els: DesignElement[], dy: number) => els.forEach((e) => (e.y = Math.round(e.y + dy)));

function logosRow(logos: Asset[], x: number, y: number, h: number, maxW: number, align: 'left' | 'center' | 'right' = 'left') {
  if (!logos.length) return { els: [] as DesignElement[], w: 0, h: 0 };
  const gap = Math.round(h * 0.7);
  const each = (maxW - gap * (logos.length - 1)) / logos.length;
  const boxes = logos.map((l) => ({ l, ...logoBox(l, h, Math.max(40, each)) }));
  const total = boxes.reduce((s, b) => s + b.w, 0) + gap * (boxes.length - 1);
  let cx = align === 'left' ? x : align === 'right' ? x + maxW - total : x + (maxW - total) / 2;
  const els = boxes.map((b) => {
    const el = image(b.l, { x: Math.round(cx), y: Math.round(y + (h - b.h) / 2), w: b.w, h: b.h, fit: 'contain', role: 'logo', name: `Logo · ${b.l.name}` });
    cx += b.w + gap;
    return el;
  });
  return { els: els as DesignElement[], w: total, h };
}

interface Item {
  label: string;
  value: string;
  role: string;
}

function items(i: Info, keys: ('date' | 'time' | 'datetime' | 'location' | 'speaker')[]): Item[] {
  const out: Item[] = [];
  for (const k of keys) {
    if (k === 'date' && i.dateLong) out.push({ label: 'Data', value: i.dateLong, role: 'date' });
    if (k === 'time' && i.time) out.push({ label: 'Horário', value: i.time, role: 'time' });
    if (k === 'datetime' && (i.dateLong || i.time))
      out.push({ label: i.dateLong && i.time ? 'Data e horário' : i.dateLong ? 'Data' : 'Horário', value: [i.dateLong, i.time].filter(Boolean).join(' · '), role: 'date' });
    if (k === 'location' && i.location) out.push({ label: 'Local', value: i.location, role: 'location' });
    if (k === 'speaker' && i.speaker) out.push({ label: 'Palestrante', value: i.speaker, role: 'speaker' });
  }
  return out;
}

// ------------------------------------------------------------------ conceitos

/** 1. Editorial — revista: fotografia dominante, serifa refinada, colunas de informação. */
const editorial: Builder = (c, k) => {
  const { W, H, p, f, i, m, story } = c;
  const els: DesignElement[] = [];
  const photo = c.photos[0];
  const photoH = Math.round(H * (story ? 0.46 : 0.5) * k);

  if (photo) {
    els.push(image(photo, { x: 0, y: 0, w: W, h: photoH, focusY: 0.38, role: 'photo', name: 'Fotografia principal' }));
  } else {
    els.push(shape('rect', { x: 0, y: 0, w: W, h: photoH, fill: solid(p.surface), name: 'Bloco de cor', role: 'block' }));
    const glyph = i.day || i.title.charAt(0).toUpperCase();
    const g = text(glyph, { x: m - 10, y: 0, w: W - 2 * m, family: f.display, size: Math.round(photoH * 0.9), weight: f.displayWeight, fill: p.accent, lh: 0.9, role: 'numeral', name: 'Numeral gráfico' });
    place(g, photoH - g.height + g.fontSize * 0.12);
    els.push(g);
  }

  let y = photoH + (story ? 72 : 60);
  const tw = W - 2 * m;
  const kicker = [i.dateShort, i.time].filter(Boolean).join('  ·  ');
  if (kicker) {
    const t = text(kicker, { x: m, y, w: tw, family: f.body, size: 22, weight: 600, ls: 0.22, upper: true, fill: p.accent, role: 'kicker', name: 'Data · horário' });
    els.push(t);
    y = bottomOf(t) + 22;
  }
  const title = text(i.title, { x: m, y, w: tw, family: f.display, size: Math.round((story ? 124 : 108) * Math.min(1, k + 0.1)), weight: f.displayWeight, ls: -0.015, lh: 1.02, fill: p.ink, role: 'title', name: 'Título', fit: { maxLines: 3, minSize: 52 } });
  els.push(title);
  y = bottomOf(title) + 22;
  if (i.subtitle) {
    const s = text(i.subtitle, { x: m, y, w: tw * 0.92, family: f.display, size: story ? 38 : 34, weight: nearestWeight(f.display, 400), italic: true, lh: 1.25, fill: p.ink, opacity: 0.78, role: 'subtitle', name: 'Subtítulo', fit: { maxLines: 2, minSize: 24 } });
    els.push(s);
    y = bottomOf(s) + 36;
  } else y += 14;

  const info = items(i, ['location', 'speaker']);
  if (info.length) {
    els.push(shape('rect', { x: m, y, w: tw, h: 2, fill: solid(p.ink), opacity: 0.22, name: 'Fio', role: 'rule' }));
    y += 30;
    if (!story) {
      const gap = 48;
      const cw = (tw - gap * (info.length - 1)) / info.length;
      let maxB = y;
      info.forEach((it, idx) => {
        const x = m + idx * (cw + gap);
        const l = text(it.label, { x, y, w: cw, family: f.body, size: 16, weight: 600, ls: 0.2, upper: true, fill: p.muted, role: it.role + '-label', name: it.label });
        const v = text(it.value, { x, y: bottomOf(l) + 10, w: cw, family: f.body, size: 26, weight: 500, lh: 1.3, fill: p.ink, role: it.role, name: it.label + ' · valor', fit: { maxLines: 3, minSize: 18 } });
        els.push(l, v);
        maxB = Math.max(maxB, bottomOf(v));
      });
      y = maxB + 28;
    } else {
      info.forEach((it, idx) => {
        const l = text(it.label, { x: m, y: y + 6, w: 220, family: f.body, size: 18, weight: 600, ls: 0.2, upper: true, fill: p.muted, role: it.role + '-label', name: it.label });
        const v = text(it.value, { x: m + 250, y, w: tw - 250, family: f.body, size: 30, weight: 500, lh: 1.3, fill: p.ink, role: it.role, name: it.label + ' · valor', fit: { maxLines: 3, minSize: 20 } });
        els.push(l, v);
        y = bottomOf(v) + 22;
        if (idx < info.length - 1) {
          els.push(shape('rect', { x: m, y, w: tw, h: 1, fill: solid(p.ink), opacity: 0.15, name: 'Fio' }));
          y += 22;
        }
      });
      y += 8;
    }
  }

  // Rodapé: informações adicionais + logotipos
  const footH = story ? 72 : 60;
  const footY = c.bottom - footH;
  const lr = logosRow(c.logos, story ? m : m + tw * 0.55, footY, footH, story ? tw : tw * 0.45, story ? 'center' : 'right');
  els.push(...lr.els);
  let limit = footY - 28;
  if (i.extra) {
    const ew = story ? tw : tw - lr.w - (lr.w ? 48 : 0);
    const ex = text(i.extra, { x: m, y: 0, w: ew, family: f.body, size: story ? 22 : 19, weight: 400, lh: 1.4, fill: p.muted, role: 'extra', name: 'Informações adicionais', fit: { maxLines: 3, minSize: 15 }, align: story ? 'center' : 'left' });
    if (story) {
      place(ex, footY - 36 - ex.height);
      limit = ex.y - 24;
    } else place(ex, footY + footH - ex.height);
    els.push(ex);
  }
  return { bg: solid(p.bg), els, bottom: y, limit };
};

/** 2. Cinematográfico — fotografia em tela cheia, véu escuro e créditos de cinema. */
const cinematic: Builder = (c, k) => {
  const { W, H, p, f, i, m, story } = c;
  const dark = luminance(p.bg) < luminance(p.ink) ? p.bg : p.ink;
  const light = dark === p.bg ? p.ink : p.bg;
  const veil = isDark(dark) ? dark : mix(dark, '#000000', 0.6);
  const acc = contrast(p.accent, veil) >= 3 ? p.accent : light;
  const els: DesignElement[] = [];
  const photo = c.photos[0];
  if (photo) {
    els.push(image(photo, { x: 0, y: 0, w: W, h: H, focusY: story ? 0.3 : 0.35, role: 'photo', name: 'Fotografia em tela cheia' }));
  } else {
    els.push(shape('ellipse', { x: W * 0.18, y: H * (story ? 0.1 : 0.04), w: W * 1.1, h: W * 1.1, fill: linear(acc, veil, 120, 0.35, 0), name: 'Halo de luz', role: 'glow' }));
  }
  const veilEl = shape('rect', { x: 0, y: H * (story ? 0.28 : 0.22), w: W, h: H * (story ? 0.72 : 0.78), fill: linear(veil, veil, 90, 0, 0.94), name: 'Véu inferior', role: 'veil' });
  els.push(veilEl);
  els.push(shape('rect', { x: 0, y: 0, w: W, h: story ? 420 : 300, fill: linear(veil, veil, 90, 0.6, 0), name: 'Véu superior', role: 'veil' }));

  const align = story ? 'center' : 'left';
  const tw = W - 2 * m;
  const block: DesignElement[] = [];
  let y = 0;
  if (i.subtitle) {
    const s = text(i.subtitle, { x: m, y, w: tw, family: f.body, size: story ? 24 : 22, weight: 600, ls: 0.32, upper: true, fill: acc, align, lh: 1.4, role: 'subtitle', name: 'Subtítulo', fit: { maxLines: 2, minSize: 16 } });
    block.push(s);
    y = bottomOf(s) + 18;
  }
  const t = text(i.title, { x: m, y, w: tw, family: f.display, size: Math.round((story ? 200 : 180) * Math.min(1, k + 0.2)), weight: f.displayWeight, upper: true, lh: 0.92, ls: 0.01, fill: light, align, role: 'title', name: 'Título', fit: { maxLines: story ? 4 : 3, minSize: 70 } });
  block.push(t);
  y = bottomOf(t) + 34;
  block.push(shape('rect', { x: story ? W / 2 - 40 : m, y, w: 80, h: 3, fill: solid(acc), name: 'Fio de destaque', role: 'rule' }));
  y += 34;
  const credits = [i.dateLong, i.time, i.location].filter(Boolean).join('   ·   ');
  if (credits) {
    const cr = text(credits, { x: m, y, w: tw, family: f.body, size: story ? 26 : 23, weight: 500, ls: 0.14, upper: true, lh: 1.55, fill: light, opacity: 0.88, align, role: 'credits', name: 'Data · horário · local', fit: { maxLines: 3, minSize: 16 } });
    block.push(cr);
    y = bottomOf(cr) + 26;
  }
  if (i.speaker) {
    const l = text('Palestrante', { x: m, y, w: tw, family: f.body, size: 17, weight: 600, ls: 0.3, upper: true, fill: light, opacity: 0.6, align, role: 'speaker-label', name: 'Palestrante' });
    const v = text(i.speaker, { x: m, y: bottomOf(l) + 8, w: tw, family: f.display, size: story ? 52 : 46, weight: f.displayWeight, upper: true, ls: 0.04, lh: 1.05, fill: light, align, role: 'speaker', name: 'Palestrante · nome', fit: { maxLines: 2, minSize: 28 } });
    block.push(l, v);
    y = bottomOf(v) + 24;
  }
  if (i.extra) {
    const ex = text(i.extra, { x: m, y, w: tw, family: f.body, size: 19, weight: 400, lh: 1.45, fill: light, opacity: 0.65, align, role: 'extra', name: 'Informações adicionais', fit: { maxLines: 3, minSize: 15 } });
    block.push(ex);
    y = bottomOf(ex);
  }

  // Topo: logos e data curta
  const logoH = 58;
  let anchorBottom = c.bottom;
  if (story) {
    const lr = logosRow(c.logos, m, c.bottom - logoH, logoH, tw, 'center');
    els.push(...lr.els);
    if (lr.els.length) anchorBottom = c.bottom - logoH - 56;
    if (i.dateShort) els.push(text(i.dateShort, { x: m, y: c.top, w: tw, family: f.body, size: 22, weight: 600, ls: 0.4, fill: light, opacity: 0.8, align: 'center', role: 'date-short', name: 'Data curta' }));
  } else {
    const lr = logosRow(c.logos, m, m, logoH, tw * 0.6, 'left');
    els.push(...lr.els);
    if (i.dateShort) els.push(text(i.dateShort, { x: W - m - 320, y: m + logoH / 2 - 14, w: 320, family: f.body, size: 22, weight: 600, ls: 0.4, fill: light, opacity: 0.85, align: 'right', role: 'date-short', name: 'Data curta' }));
  }
  const dy = anchorBottom - y;
  shiftAll(block, dy);
  els.push(...block);
  const topUsed = block.length ? Math.min(...block.map((e) => e.y)) : anchorBottom;
  // O véu começa acima do bloco de texto, garantindo contraste para toda a tipografia.
  const seam = Math.round(topUsed - 60);
  const veilTop = Math.max(0, Math.min(veilEl.y, seam - (story ? 460 : 380)));
  veilEl.y = Math.round(veilTop);
  veilEl.height = Math.round(seam - veilTop);
  veilEl.fill = { ...veilEl.fill, alpha1: 0, alpha2: 0.8 };
  const veil2 = shape('rect', { x: 0, y: seam, w: W, h: H - seam, fill: linear(veil, veil, 90, 0.8, 0.96), name: 'Véu inferior (base)', role: 'veil' });
  els.splice(els.indexOf(veilEl) + 1, 0, veil2);
  return { bg: solid(veil), els, bottom: anchorBottom, limit: anchorBottom, topUsed, minTop: H * (story ? 0.36 : 0.3) };
};

/** 3. Suíço minimalista — numerais monumentais, grade visível, foto em círculo. */
const swiss: Builder = (c, k) => {
  const { W, p, f, i, m, story } = c;
  const els: DesignElement[] = [];
  const tw = W - 2 * m;
  const top = story ? c.top : m;
  els.push(shape('rect', { x: m, y: top, w: tw, h: 2, fill: solid(p.ink), name: 'Fio superior', role: 'rule' }));
  const headY = top + 18;
  if (i.weekday) els.push(text(i.weekday, { x: m, y: headY, w: tw / 2, family: f.body, size: 18, weight: 600, ls: 0.18, upper: true, fill: p.ink, role: 'weekday', name: 'Dia da semana' }));
  if (i.time) els.push(text(i.time, { x: W / 2, y: headY, w: tw / 2, family: f.body, size: 18, weight: 600, ls: 0.18, upper: true, fill: p.ink, align: 'right', role: 'time', name: 'Horário' }));

  let y = headY + 60;
  const D = Math.round((story ? 620 : 430) * k);
  const photo = c.photos[0];
  const circleX = story ? W - D + Math.round(D * 0.12) : W - m - D;
  const circleY = story ? y + 260 * k : y + 10;
  if (photo) els.push(image(photo, { x: circleX, y: circleY, w: D, h: D, mask: 'circle', role: 'photo', name: 'Fotografia (círculo)', focusY: 0.35 }));
  else els.push(shape('ellipse', { x: circleX, y: circleY, w: D, h: D, fill: solid(p.accent), name: 'Círculo', role: 'circle' }));

  let numB = y;
  if (i.day) {
    const n = text(i.day, { x: m - 14, y: y - 30, w: 600, family: f.display, size: Math.round((story ? 420 : 360) * Math.min(1, k + 0.1)), weight: nearestWeight(f.display, 300), lh: 0.86, ls: -0.04, fill: p.accent, role: 'numeral', name: 'Dia (numeral)' });
    const nw = lineWidth(i.day, { family: n.fontFamily, size: n.fontSize, weight: n.fontWeight, letterSpacing: n.letterSpacing });
    n.width = Math.ceil(nw + 20);
    els.push(n);
    const mo = text(`${i.monthLong}\n${i.year}`, { x: story ? m : m + nw + 10, y: 0, w: 260, family: f.body, size: 24, weight: 600, ls: 0.16, upper: true, lh: 1.35, fill: p.ink, role: 'month', name: 'Mês e ano' });
    if (story) place(mo, bottomOf(n) + 10);
    else place(mo, bottomOf(n) - mo.height - n.fontSize * 0.1);
    els.push(mo);
    numB = Math.max(bottomOf(n), bottomOf(mo));
  }
  y = Math.max(numB + 40, story ? circleY + D + 50 : circleY + D + 50);

  const title = text(i.title, { x: m, y, w: tw, family: f.display, size: Math.round((story ? 104 : 92) * Math.min(1, k + 0.15)), weight: nearestWeight(f.display, 600), ls: -0.03, lh: 1.0, fill: p.ink, role: 'title', name: 'Título', fit: { maxLines: 4, minSize: 48 } });
  els.push(title);
  y = bottomOf(title) + 20;
  if (i.subtitle) {
    const s = text(i.subtitle, { x: m, y, w: tw * 0.85, family: f.body, size: story ? 32 : 28, weight: 400, lh: 1.35, fill: p.muted, role: 'subtitle', name: 'Subtítulo', fit: { maxLines: 3, minSize: 20 } });
    els.push(s);
    y = bottomOf(s) + 36;
  } else y += 16;

  const info = items(i, i.day ? ['location', 'speaker'] : ['date', 'location', 'speaker']);
  info.forEach((it) => {
    els.push(shape('rect', { x: m, y, w: tw, h: 1.5, fill: solid(p.ink), opacity: 0.35, name: 'Fio' }));
    y += 18;
    const l = text(it.label, { x: m, y: y + 4, w: 220, family: f.body, size: 16, weight: 600, ls: 0.18, upper: true, fill: p.muted, role: it.role + '-label', name: it.label });
    const v = text(it.value, { x: m + 240, y, w: tw - 240, family: f.body, size: story ? 28 : 25, weight: 500, lh: 1.3, fill: p.ink, role: it.role, name: it.label + ' · valor', fit: { maxLines: 2, minSize: 18 } });
    els.push(l, v);
    y = bottomOf(v) + 18;
  });

  const footH = 56;
  const footY = c.bottom - footH;
  const lr = logosRow(c.logos, m, footY, footH, tw * 0.5, 'left');
  els.push(...lr.els);
  let limit = footY - 24;
  if (i.extra) {
    const ex = text(i.extra, { x: lr.w ? W / 2 : m, y: 0, w: lr.w ? tw / 2 : tw, family: f.body, size: 18, weight: 400, lh: 1.4, fill: p.muted, align: lr.w ? 'right' : 'left', role: 'extra', name: 'Informações adicionais', fit: { maxLines: 3, minSize: 14 } });
    place(ex, footY + footH - ex.height);
    els.push(ex);
    if (!lr.w) limit = ex.y - 24;
  }
  return { bg: solid(p.bg), els, bottom: y, limit };
};

/** 4. Arco clássico — simetria, moldura fina, foto em arco, serifa de alto contraste. */
const arch: Builder = (c, k) => {
  const { W, H, p, f, i, m, story } = c;
  const els: DesignElement[] = [];
  const inset = 36;
  els.push(shape('rect', { x: inset, y: inset, w: W - inset * 2, h: H - inset * 2, stroke: p.accent, strokeWidth: 1.5, name: 'Moldura', role: 'frame', opacity: 0.8 }));
  const photo = c.photos[0];

  const ornament = (cx: number, y: number) => {
    const out: DesignElement[] = [
      shape('rect', { x: cx - 110, y: y + 7, w: 90, h: 1.5, fill: solid(p.accent), name: 'Ornamento' }),
      shape('rect', { x: cx - 7, y: y, w: 14, h: 14, rotation: 0, fill: solid(p.accent), name: 'Ornamento losango' }),
      shape('rect', { x: cx + 20, y: y + 7, w: 90, h: 1.5, fill: solid(p.accent), name: 'Ornamento' }),
    ];
    // losango: rotaciona 45° em torno do centro
    const d = out[1];
    d.rotation = 45;
    d.x = cx;
    d.y = y - 3;
    return out;
  };

  const archEl = (x: number, y: number, w: number, h: number) =>
    photo
      ? image(photo, { x, y, w, h, mask: 'arch', role: 'photo', name: 'Fotografia (arco)', focusY: 0.35 })
      : shape('arch', { x, y, w, h, fill: solid(p.surface), stroke: p.accent, strokeWidth: 1.5, name: 'Arco', role: 'arch' });

  // Coluna de texto (centralizada)
  const column = (x: number, w: number, y0: number, titleMax: number) => {
    const col: DesignElement[] = [];
    let y = y0;
    const lr = logosRow(c.logos, x, y, 56, w, 'center');
    if (lr.els.length) {
      col.push(...lr.els);
      y += 56 + 40;
    }
    if (i.subtitle) {
      const s = text(i.subtitle, { x, y, w, family: f.body, size: 19, weight: 600, ls: 0.3, upper: true, lh: 1.5, align: 'center', fill: p.accent, role: 'subtitle', name: 'Subtítulo', fit: { maxLines: 3, minSize: 14 } });
      col.push(s);
      y = bottomOf(s) + 24;
    }
    const t = text(i.title, { x, y, w, family: f.display, size: titleMax, weight: f.displayWeight, lh: 1.04, align: 'center', fill: p.ink, role: 'title', name: 'Título', fit: { maxLines: story ? 3 : 5, minSize: 44 } });
    col.push(t);
    y = bottomOf(t) + 30;
    col.push(...ornament(x + w / 2, y));
    y += 46;
    const lines: [string, string, number, number][] = [];
    if (i.dateLong) lines.push([i.dateLong, 'date', story ? 30 : 26, 500]);
    if (i.time) lines.push([i.time, 'time', story ? 30 : 26, 500]);
    if (i.location) lines.push([i.location, 'location', story ? 26 : 22, 400]);
    lines.forEach(([v, role, size, weight]) => {
      const e = text(v, { x, y, w, family: f.body, size, weight, lh: 1.35, align: 'center', fill: p.ink, opacity: role === 'location' ? 0.75 : 1, role, name: role === 'date' ? 'Data' : role === 'time' ? 'Horário' : 'Local', fit: { maxLines: 2, minSize: 16 } });
      col.push(e);
      y = bottomOf(e) + 8;
    });
    if (i.speaker) {
      y += 22;
      const l = text('Palestrante', { x, y, w, family: f.body, size: 15, weight: 600, ls: 0.3, upper: true, align: 'center', fill: p.muted, role: 'speaker-label', name: 'Palestrante' });
      const v = text(i.speaker, { x, y: bottomOf(l) + 8, w, family: f.display, size: story ? 46 : 38, weight: f.displayWeight, italic: true, align: 'center', fill: p.ink, role: 'speaker', name: 'Palestrante · nome', fit: { maxLines: 2, minSize: 24 } });
      col.push(l, v);
      y = bottomOf(v);
    }
    if (i.extra) {
      y += 26;
      const ex = text(i.extra, { x, y, w, family: f.body, size: 17, weight: 400, lh: 1.45, align: 'center', fill: p.muted, role: 'extra', name: 'Informações adicionais', fit: { maxLines: 4, minSize: 13 } });
      col.push(ex);
      y = bottomOf(ex);
    }
    return { col, y };
  };

  if (!story) {
    const aw = Math.round(420 * Math.min(1, k + 0.1));
    const ah = Math.round(H * 0.62 * k);
    const ax = m + 10;
    const ay = Math.round((H - ah) / 2);
    els.push(archEl(ax, ay, aw, ah));
    const cx = ax + aw + 60;
    const cw = W - m - cx;
    const { col, y } = column(cx, cw, 0, Math.round(84 * Math.min(1, k + 0.15)));
    const h = y;
    shiftAll(col, Math.max(m + 20, (H - h) / 2));
    els.push(...col);
    if (!photo && i.day) els.push(text(i.day, { x: ax, y: ay + ah * 0.35, w: aw, family: f.display, size: 220, weight: f.displayWeight, italic: true, align: 'center', fill: p.accent, role: 'numeral', name: 'Dia (numeral)' }));
    const bottom = Math.max(...col.map(bottomOf));
    return { bg: solid(p.bg), els, bottom, limit: H - m };
  }
  // Story: coluna única centralizada
  const tw = W - 2 * m - 40;
  const out: DesignElement[] = [];
  let y = c.top;
  const lr = logosRow(c.logos, m, y, 60, W - 2 * m, 'center');
  if (lr.els.length) {
    out.push(...lr.els);
    y += 60 + 44;
  }
  if (i.subtitle) {
    const s = text(i.subtitle, { x: m + 20, y, w: tw, family: f.body, size: 22, weight: 600, ls: 0.3, upper: true, lh: 1.5, align: 'center', fill: p.accent, role: 'subtitle', name: 'Subtítulo', fit: { maxLines: 2, minSize: 15 } });
    out.push(s);
    y = bottomOf(s) + 36;
  }
  const aw = Math.round(560 * k);
  const ah = Math.round(720 * k);
  out.push(archEl((W - aw) / 2, y, aw, ah));
  if (!photo && i.day) out.push(text(i.day, { x: (W - aw) / 2, y: y + ah * 0.32, w: aw, family: f.display, size: 260, weight: f.displayWeight, italic: true, align: 'center', fill: p.accent, role: 'numeral', name: 'Dia (numeral)' }));
  y += ah + 48;
  const t = text(i.title, { x: m + 20, y, w: tw, family: f.display, size: Math.round(104 * Math.min(1, k + 0.15)), weight: f.displayWeight, lh: 1.04, align: 'center', fill: p.ink, role: 'title', name: 'Título', fit: { maxLines: 3, minSize: 48 } });
  out.push(t);
  y = bottomOf(t) + 32;
  out.push(...ornament(W / 2, y));
  y += 50;
  const meta = [i.dateLong, i.time].filter(Boolean).join(' · ');
  if (meta) {
    const e = text(meta, { x: m + 20, y, w: tw, family: f.body, size: 30, weight: 500, lh: 1.35, align: 'center', fill: p.ink, role: 'date', name: 'Data · horário', fit: { maxLines: 2, minSize: 20 } });
    out.push(e);
    y = bottomOf(e) + 10;
  }
  if (i.location) {
    const e = text(i.location, { x: m + 20, y, w: tw, family: f.body, size: 26, weight: 400, lh: 1.35, align: 'center', fill: p.ink, opacity: 0.75, role: 'location', name: 'Local', fit: { maxLines: 2, minSize: 18 } });
    out.push(e);
    y = bottomOf(e) + 10;
  }
  if (i.speaker) {
    y += 24;
    const l = text('Palestrante', { x: m + 20, y, w: tw, family: f.body, size: 17, weight: 600, ls: 0.3, upper: true, align: 'center', fill: p.muted, role: 'speaker-label', name: 'Palestrante' });
    const v = text(i.speaker, { x: m + 20, y: bottomOf(l) + 8, w: tw, family: f.display, size: 48, weight: f.displayWeight, italic: true, align: 'center', fill: p.ink, role: 'speaker', name: 'Palestrante · nome', fit: { maxLines: 2, minSize: 26 } });
    out.push(l, v);
    y = bottomOf(v);
  }
  if (i.extra) {
    y += 28;
    const ex = text(i.extra, { x: m + 20, y, w: tw, family: f.body, size: 20, weight: 400, lh: 1.45, align: 'center', fill: p.muted, role: 'extra', name: 'Informações adicionais', fit: { maxLines: 3, minSize: 14 } });
    out.push(ex);
    y = bottomOf(ex);
  }
  els.push(...out);
  return { bg: solid(p.bg), els, bottom: y, limit: c.bottom };
};

/** 5. Contemporâneo — blocos de cor sobrepostos, sans geométrica pesada, chips de informação. */
const blocks: Builder = (c, k) => {
  const { W, p, f, i, m, story } = c;
  const els: DesignElement[] = [];
  const onAcc = bestText(p.accent, [p.bg, p.ink, '#FFFFFF', '#0A0A0A']);
  const photo = c.photos[0];
  const tw = W - 2 * m;
  let photoBottom: number;

  if (!story) {
    els.push(shape('rect', { x: 0, y: 0, w: 620, h: 660 * k, fill: solid(p.accent), name: 'Bloco de cor', role: 'block' }));
    const px = 320, py = 110, pw = W - px - m, ph = Math.round(580 * k);
    if (photo) els.push(image(photo, { x: px, y: py, w: pw, h: ph, mask: 'rounded', radius: 28, role: 'photo', name: 'Fotografia', focusY: 0.35 }));
    else {
      els.push(shape('rect', { x: px, y: py, w: pw, h: ph, radius: 28, fill: solid(p.surface), name: 'Bloco secundário' }));
      const d = Math.min(pw, ph) * 0.72;
      els.push(shape('ellipse', { x: px + (pw - d) / 2, y: py + (ph - d) / 2, w: d, h: d, stroke: p.accent, strokeWidth: 2, name: 'Anel gráfico' }));
    }
    photoBottom = py + ph;
    let dy = 110;
    if (i.day) {
      const d = text(i.day, { x: m - 6, y: dy - 14, w: 230, family: f.display, size: 150, weight: f.displayWeight, lh: 0.9, ls: -0.03, fill: onAcc, role: 'numeral', name: 'Dia' });
      els.push(d);
      dy = bottomOf(d) + 6;
      const mo = text(`${i.monthShort} ${i.year}`, { x: m, y: dy, w: 220, family: f.body, size: 24, weight: 700, ls: 0.16, fill: onAcc, role: 'month', name: 'Mês' });
      els.push(mo);
      dy = bottomOf(mo) + 10;
    }
    if (i.time) els.push(text(i.time, { x: m, y: dy, w: 220, family: f.body, size: 24, weight: 500, ls: 0.06, fill: onAcc, opacity: 0.85, role: 'time', name: 'Horário' }));
  } else {
    els.push(shape('rect', { x: 0, y: 0, w: W, h: Math.round(860 * k), fill: solid(p.accent), name: 'Faixa de cor', role: 'block' }));
    const py = c.top + 230, ph = Math.round(700 * k);
    if (photo) els.push(image(photo, { x: m, y: py, w: tw, h: ph, mask: 'rounded', radius: 32, role: 'photo', name: 'Fotografia', focusY: 0.35 }));
    else {
      els.push(shape('rect', { x: m, y: py, w: tw, h: ph, radius: 32, fill: solid(p.surface), name: 'Bloco secundário' }));
      const d = Math.min(tw, ph) * 0.72;
      els.push(shape('ellipse', { x: m + (tw - d) / 2, y: py + (ph - d) / 2, w: d, h: d, stroke: p.accent, strokeWidth: 2, name: 'Anel gráfico' }));
    }
    photoBottom = py + ph;
    if (i.day) {
      els.push(text(`${i.day} ${i.monthShort}`, { x: m, y: c.top + 20, w: tw - 240, family: f.display, size: 130, weight: f.displayWeight, lh: 0.95, ls: -0.03, fill: onAcc, role: 'numeral', name: 'Data', fit: { maxLines: 1, minSize: 60 } }));
    }
    if (i.time) els.push(text(i.time, { x: W - m - 300, y: c.top + 40, w: 300, family: f.body, size: 34, weight: 600, align: 'right', fill: onAcc, role: 'time', name: 'Horário' }));
  }

  let y = photoBottom + (story ? 64 : 56);
  const title = text(i.title, { x: m, y, w: tw, family: f.display, size: Math.round((story ? 112 : 100) * Math.min(1, k + 0.12)), weight: f.displayWeight, lh: 0.98, ls: -0.025, fill: p.ink, role: 'title', name: 'Título', fit: { maxLines: 3, minSize: 50 } });
  els.push(title);
  y = bottomOf(title) + 18;
  if (i.subtitle) {
    const s = text(i.subtitle, { x: m, y, w: tw, family: f.body, size: story ? 32 : 28, weight: 500, lh: 1.3, fill: p.muted, role: 'subtitle', name: 'Subtítulo', fit: { maxLines: 2, minSize: 20 } });
    els.push(s);
    y = bottomOf(s) + 30;
  } else y += 12;

  // Chips
  const chipVals: { v: string; role: string }[] = [];
  if (!i.day && i.dateLong) chipVals.push({ v: i.dateLong, role: 'date' });
  if (i.location) chipVals.push({ v: i.location, role: 'location' });
  if (i.speaker) chipVals.push({ v: i.speaker, role: 'speaker' });
  const chipH = story ? 64 : 56;
  const fs = story ? 24 : 21;
  let cx = m;
  for (const ch of chipVals) {
    const spec = { family: f.body, size: fs, weight: 600 };
    const tw0 = lineWidth(ch.v, spec);
    const cw = tw0 + 52;
    if (cw > tw) {
      // valor longo: texto corrido, sem pílula
      if (cx > m) {
        y += chipH + 14;
        cx = m;
      }
      const e = text(ch.v, { x: m, y, w: tw, family: f.body, size: fs, weight: 600, lh: 1.3, fill: p.ink, role: ch.role, name: ch.role === 'location' ? 'Local' : ch.role === 'speaker' ? 'Palestrante' : 'Data', fit: { maxLines: 2, minSize: 16 } });
      els.push(e);
      y = bottomOf(e) + 14;
      continue;
    }
    if (cx + cw > m + tw) {
      cx = m;
      y += chipH + 14;
    }
    els.push(shape('rect', { x: cx, y, w: cw, h: chipH, radius: chipH / 2, stroke: p.ink, strokeWidth: 2, name: 'Pílula', role: 'chip' }));
    els.push(text(ch.v, { x: cx, y: y + (chipH - fs * 1.2) / 2, w: cw, family: f.body, size: fs, weight: 600, align: 'center', fill: p.ink, role: ch.role, name: ch.role === 'location' ? 'Local' : ch.role === 'speaker' ? 'Palestrante' : 'Data' }));
    cx += cw + 14;
  }
  if (cx > m) y += chipH;

  const footH = 56;
  const footY = c.bottom - footH;
  const lr = logosRow(c.logos, m, footY, footH, story ? tw : tw * 0.5, story ? 'center' : 'left');
  els.push(...lr.els);
  let limit = footY - 28;
  if (i.extra) {
    const ex = text(i.extra, { x: story ? m : W / 2, y: 0, w: story ? tw : tw / 2, family: f.body, size: story ? 21 : 18, weight: 400, lh: 1.4, fill: p.muted, align: story ? 'center' : 'right', role: 'extra', name: 'Informações adicionais', fit: { maxLines: 3, minSize: 14 } });
    if (story) {
      place(ex, footY - 30 - ex.height);
      limit = ex.y - 24;
    } else place(ex, footY + footH - ex.height);
    els.push(ex);
  }
  return { bg: solid(p.bg), els, bottom: y, limit };
};

/** 6. Corporativo — clareza institucional, barra de destaque, faixa fotográfica, cartões. */
const corporate: Builder = (c, k) => {
  const { W, p, f, i, m, story } = c;
  const els: DesignElement[] = [];
  const tw = W - 2 * m;
  let y = story ? c.top : m;
  const lr = logosRow(c.logos, m, y, 60, tw * 0.6, 'left');
  els.push(...lr.els);
  if (i.dateShort) els.push(text(i.dateShort, { x: W - m - 300, y: y + 16, w: 300, family: f.body, size: 22, weight: 700, ls: 0.12, align: 'right', fill: p.accent, role: 'date-short', name: 'Data curta' }));
  y += 60 + (story ? 70 : 56);

  const title = text(i.title, { x: m + 40, y, w: tw - 40, family: f.display, size: Math.round((story ? 96 : 84) * Math.min(1, k + 0.15)), weight: f.displayWeight, lh: 1.04, ls: -0.02, fill: p.ink, role: 'title', name: 'Título', fit: { maxLines: 3, minSize: 46 } });
  els.push(shape('rect', { x: m, y: y + 8, w: 10, h: title.height - 16, fill: solid(p.accent), name: 'Barra de destaque', role: 'bar' }));
  els.push(title);
  y = bottomOf(title) + 22;
  if (i.subtitle) {
    const s = text(i.subtitle, { x: m + 40, y, w: tw - 40, family: f.body, size: story ? 32 : 28, weight: 400, lh: 1.35, fill: p.muted, role: 'subtitle', name: 'Subtítulo', fit: { maxLines: 2, minSize: 20 } });
    els.push(s);
    y = bottomOf(s) + 40;
  } else y += 20;

  const photo = c.photos[0];
  const ph = Math.round((story ? 600 : 360) * k);
  if (photo) els.push(image(photo, story ? { x: m, y, w: tw, h: ph, mask: 'rounded', radius: 24, role: 'photo', name: 'Fotografia' } : { x: 0, y, w: W, h: ph, role: 'photo', name: 'Fotografia (faixa)', focusY: 0.4 }));
  else {
    els.push(shape('rect', story ? { x: m, y, w: tw, h: ph, radius: 24, fill: solid(p.accent), name: 'Faixa de cor' } : { x: 0, y, w: W, h: ph, fill: solid(p.accent), name: 'Faixa de cor' }));
    if (i.dateShort) {
      const onA = bestText(p.accent, [p.bg, p.ink, '#FFFFFF', '#0A0A0A']);
      const d = text(i.dateShort, { x: m, y: 0, w: tw, family: f.display, size: story ? 150 : 140, weight: f.displayWeight, align: story ? 'center' : 'left', ls: -0.03, lh: 1, fill: onA, role: 'numeral', name: 'Data (destaque)', fit: { maxLines: 1, minSize: 60 } });
      place(d, y + (ph - d.height) / 2);
      els.push(d);
    }
  }
  y += ph + (story ? 40 : 36);

  const info = items(i, ['date', 'time', 'location', 'speaker']);
  const cols = story ? 1 : 2;
  const gap = 20;
  const cw = (tw - gap * (cols - 1)) / cols;
  for (let r = 0; r < info.length; r += cols) {
    const row = info.slice(r, r + cols);
    const built = row.map((it, idx) => {
      const x = m + idx * (cw + gap);
      const l = text(it.label, { x: x + 28, y: y + 24, w: cw - 56, family: f.body, size: 15, weight: 700, ls: 0.16, upper: true, fill: p.accent, role: it.role + '-label', name: it.label });
      const v = text(it.value, { x: x + 28, y: bottomOf(l) + 8, w: cw - 56, family: f.body, size: story ? 28 : 24, weight: 600, lh: 1.3, fill: p.ink, role: it.role, name: it.label + ' · valor', fit: { maxLines: 2, minSize: 17 } });
      return { x, l, v };
    });
    const rh = Math.max(...built.map((b) => bottomOf(b.v))) - y + 24;
    built.forEach((b) => els.push(shape('rect', { x: b.x, y, w: cw, h: rh, radius: 14, fill: solid(p.surface), name: 'Cartão' }), b.l, b.v));
    y += rh + gap;
  }

  let limit = c.bottom;
  if (i.extra) {
    const ex = text(i.extra, { x: m, y: 0, w: tw, family: f.body, size: story ? 21 : 18, weight: 400, lh: 1.4, fill: p.muted, role: 'extra', name: 'Informações adicionais', fit: { maxLines: 3, minSize: 14 } });
    place(ex, c.bottom - ex.height);
    els.push(ex);
    limit = ex.y - 20;
  }
  return { bg: solid(p.bg), els, bottom: y, limit };
};

// ------------------------------------------------------------------ catálogo

export interface Concept {
  id: string;
  name: string;
  rationale: string;
  build: Builder;
  fonts: Fonts;
}

export const CONCEPTS: Concept[] = [
  { id: 'editorial', name: 'Editorial', rationale: 'Linguagem de revista: fotografia dominante, serifa de alto contraste e informações em colunas com fios finos.', build: editorial, fonts: { display: 'Fraunces', displayWeight: 400, body: 'Inter' } },
  { id: 'cinematic', name: 'Cinematográfico', rationale: 'Fotografia em tela cheia com véu tonal, título monumental condensado e créditos no rodapé, como um cartaz de cinema.', build: cinematic, fonts: { display: 'Bebas Neue', displayWeight: 400, body: 'Manrope' } },
  { id: 'swiss', name: 'Suíço minimalista', rationale: 'Grade visível, numeral monumental como elemento gráfico, foto em círculo e tabela tipográfica precisa.', build: swiss, fonts: { display: 'Space Grotesk', displayWeight: 600, body: 'Inter' } },
  { id: 'arch', name: 'Arco clássico', rationale: 'Simetria, moldura fina e fotografia em arco; serifa clássica com ornamento discreto para um tom sofisticado.', build: arch, fonts: { display: 'Cormorant Garamond', displayWeight: 500, body: 'Manrope' } },
  { id: 'blocks', name: 'Contemporâneo', rationale: 'Blocos de cor sobrepostos à fotografia, sans geométrica pesada e informações em pílulas.', build: blocks, fonts: { display: 'Syne', displayWeight: 800, body: 'Manrope' } },
  { id: 'corporate', name: 'Institucional', rationale: 'Clareza institucional: barra de destaque, faixa fotográfica e cartões de informação bem organizados.', build: corporate, fonts: { display: 'Manrope', displayWeight: 800, body: 'Inter' } },
];

export const STYLES: { id: StyleId; name: string; description: string; concepts: string[] }[] = [
  { id: 'editorial', name: 'Editorial', description: 'Revista, serifas, respiro', concepts: ['editorial', 'swiss', 'cinematic'] },
  { id: 'minimalista', name: 'Minimalista', description: 'Grade, precisão, silêncio', concepts: ['swiss', 'editorial', 'arch'] },
  { id: 'cinematografico', name: 'Cinematográfico', description: 'Tela cheia, drama, luz', concepts: ['cinematic', 'editorial', 'blocks'] },
  { id: 'contemporaneo', name: 'Contemporâneo', description: 'Blocos, cor, geometria', concepts: ['blocks', 'swiss', 'cinematic'] },
  { id: 'corporativo', name: 'Corporativo', description: 'Clareza institucional', concepts: ['corporate', 'swiss', 'editorial'] },
  { id: 'luxo', name: 'Sofisticado', description: 'Clássico, simetria, arco', concepts: ['arch', 'cinematic', 'editorial'] },
];

// ------------------------------------------------------------------ motivos da marca

function motifEls(motifs: Motif[], c: Ctx): DesignElement[] {
  const { W, H, p } = c;
  const out: DesignElement[] = [];
  for (const mo of motifs) {
    if (mo === 'cantos') {
      const L = 46, t = 2, s = 24;
      const corners: [number, number, number, number][] = [
        [s, s, 1, 1],
        [W - s, s, -1, 1],
        [s, H - s, 1, -1],
        [W - s, H - s, -1, -1],
      ];
      corners.forEach(([x, y, dx, dy]) => {
        out.push(shape('rect', { x: dx > 0 ? x : x - L, y: dy > 0 ? y : y - t, w: L, h: t, fill: solid(p.accent), name: 'Canto', role: 'motif' }));
        out.push(shape('rect', { x: dx > 0 ? x : x - t, y: dy > 0 ? y : y - L, w: t, h: L, fill: solid(p.accent), name: 'Canto', role: 'motif' }));
      });
    }
    if (mo === 'linhas') out.push(shape('rect', { x: 40, y: H * 0.3, w: 2, h: H * 0.4, fill: solid(p.accent), opacity: 0.7, name: 'Linha da marca', role: 'motif' }));
    if (mo === 'circulos') out.push(shape('ellipse', { x: W * 0.55, y: H - W * 0.42, w: W * 0.8, h: W * 0.8, stroke: p.accent, strokeWidth: 2, opacity: 0.3, name: 'Círculo da marca', role: 'motif' }));
    if (mo === 'grade') [1, 2].forEach((n) => out.push(shape('rect', { x: (W / 3) * n, y: 0, w: 1, h: H, fill: solid(p.ink), opacity: 0.07, name: 'Grade', role: 'motif' })));
    if (mo === 'barras') {
      out.push(shape('rect', { x: 0, y: 0, w: W, h: 14, fill: solid(p.accent), name: 'Barra da marca', role: 'motif' }));
      out.push(shape('rect', { x: 0, y: H - 14, w: W, h: 14, fill: solid(p.accent), name: 'Barra da marca', role: 'motif' }));
    }
  }
  return out;
}

// ------------------------------------------------------------------ composição

export interface ComposeInput {
  brief: Brief;
  assets: Record<string, Asset>;
  palette: Palette;
  brand: Brand | null;
}

export function buildArtboard(concept: Concept, format: FormatId, input: ComposeInput): Artboard {
  const { W, H } = { W: FORMATS[format].width, H: FORMATS[format].height };
  const story = format === 'story';
  const brand = input.brand;
  const fonts: Fonts = brand
    ? { display: brand.fontDisplay, displayWeight: nearestWeight(brand.fontDisplay, concept.fonts.displayWeight), body: brand.fontBody }
    : concept.fonts;
  const logos = input.brief.logoIds.map((id) => input.assets[id]).filter(Boolean);
  const c: Ctx = {
    W,
    H,
    story,
    p: input.palette,
    f: fonts,
    i: deriveInfo(input.brief),
    photos: input.brief.photoIds.map((id) => input.assets[id]).filter(Boolean),
    logos,
    motifs: brand?.motifs ?? [],
    m: story ? 90 : 80,
    top: story ? 250 : 80,
    bottom: story ? H - 270 : H - 80,
  };

  // Laço de ajuste: comprime a região flexível até o conteúdo caber sem sobreposição.
  const fits = (o: Out) => o.bottom <= o.limit && (o.minTop === undefined || (o.topUsed ?? Infinity) >= o.minTop);
  let out: Out | null = null;
  for (const k of [1, 0.93, 0.86, 0.79, 0.72, 0.65, 0.58, 0.5]) {
    out = concept.build(c, k);
    if (fits(out)) break;
  }
  // No story, se sobrar muito espaço vertical, expande a região flexível (foto/bloco)
  // para que a composição ocupe a altura com intenção, em vez de deixar um vazio no rodapé.
  if (story && out && fits(out) && out.limit - out.bottom > H * 0.06) {
    for (const k of [1.08, 1.16, 1.24, 1.32, 1.4]) {
      const o = concept.build(c, k);
      if (!fits(o)) break;
      out = o;
      if (o.limit - o.bottom < H * 0.04) break;
    }
  }
  const res = out!;
  const els = res.els;
  if (c.motifs.length) {
    const firstText = els.findIndex((e) => e.type === 'text');
    els.splice(firstText < 0 ? els.length : firstText, 0, ...motifEls(c.motifs, c));
  }
  // garante nomes únicos legíveis
  els.forEach((e) => {
    if (!e.id) e.id = uid();
    if (e.type === 'text') (e as TextElement).name = e.name || e.text.slice(0, 24);
  });
  return { format, width: W, height: H, background: res.bg, elements: els };
}

export function generateProposals(input: ComposeInput): Proposal[] {
  const style = STYLES.find((s) => s.id === input.brief.style) ?? STYLES[0];
  return style.concepts.map((cid) => {
    const concept = CONCEPTS.find((c) => c.id === cid)!;
    return {
      id: uid(),
      conceptId: concept.id,
      conceptName: concept.name,
      rationale: concept.rationale,
      feed: buildArtboard(concept, 'feed', input),
      story: buildArtboard(concept, 'story', input),
    };
  });
}
