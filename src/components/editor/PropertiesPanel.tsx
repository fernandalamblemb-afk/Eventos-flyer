import { useMemo } from 'react';
import { useArtboard, useStore } from '../../store';
import type { DesignElement, Fill, ImageElement, MaskKind, ShapeElement, TextElement } from '../../types';
import { defaultShadow } from '../../types';
import { ColorInput, FilePick, Icon, NumberInput, Row, Section, Segmented, Slider, Swatches } from '../ui';
import { FONTS, fontWeights, nearestWeight } from '../../engine/fonts';
import { textHeight } from '../../engine/text';
import { fileToAsset } from '../../lib/files';
import { resolvePalette, paletteColors } from '../../lib/palette';

function useSwatches() {
  const ab = useArtboard();
  const project = useStore((s) => s.project);
  const brands = useStore((s) => s.brands);
  return useMemo(() => {
    const out: string[] = [];
    if (project) out.push(...paletteColors(resolvePalette(project.brief, brands)));
    if (ab) {
      out.push(ab.background.color);
      ab.elements.forEach((e) => {
        if (e.type === 'text') out.push(e.fill);
        if (e.type === 'shape') {
          if (e.fill.color !== 'transparent') out.push(e.fill.color);
          if (e.stroke) out.push(e.stroke);
        }
      });
    }
    out.push('#FFFFFF', '#000000');
    return [...new Set(out.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map((c) => c.toUpperCase()))].slice(0, 16);
  }, [ab, project, brands]);
}

function FillEditor({ fill, onChange }: { fill: Fill; onChange: (f: Fill, key: string) => void }) {
  const sw = useSwatches();
  return (
    <div className="space-y-3">
      <Segmented
        value={fill.type}
        options={[
          { value: 'solid', label: 'Sólido' },
          { value: 'linear', label: 'Gradiente' },
        ]}
        onChange={(t) => onChange({ ...fill, type: t, color: fill.color === 'transparent' ? '#000000' : fill.color, color2: fill.color2 === 'transparent' || !fill.color2 ? '#FFFFFF' : fill.color2, alpha1: fill.alpha1 ?? 1, alpha2: fill.alpha2 ?? 1 }, 'type')}
      />
      <Row label={fill.type === 'linear' ? 'Cor 1' : 'Cor'}>
        <ColorInput value={fill.color} onChange={(c) => onChange({ ...fill, color: c }, 'c1')} />
      </Row>
      <Swatches colors={sw} onPick={(c) => onChange({ ...fill, color: c }, 'c1')} />
      {fill.type === 'linear' && (
        <>
          <Row label="Opac. 1">
            <Slider value={fill.alpha1 ?? 1} min={0} max={1} step={0.01} onChange={(v) => onChange({ ...fill, alpha1: v }, 'a1')} format={(v) => `${Math.round(v * 100)}%`} />
          </Row>
          <Row label="Cor 2">
            <ColorInput value={fill.color2} onChange={(c) => onChange({ ...fill, color2: c }, 'c2')} />
          </Row>
          <Row label="Opac. 2">
            <Slider value={fill.alpha2 ?? 1} min={0} max={1} step={0.01} onChange={(v) => onChange({ ...fill, alpha2: v }, 'a2')} format={(v) => `${Math.round(v * 100)}%`} />
          </Row>
          <Row label="Ângulo">
            <Slider value={fill.angle} min={0} max={360} onChange={(v) => onChange({ ...fill, angle: v }, 'ang')} suffix="°" />
          </Row>
        </>
      )}
    </div>
  );
}

function ArtboardProps() {
  const ab = useArtboard()!;
  const setBackground = useStore((s) => s.setBackground);
  return (
    <>
      <Section title="Prancheta">
        <p className="text-xs text-zinc-400">
          {ab.format === 'feed' ? 'Feed' : 'Story'} · {ab.width} × {ab.height} px
        </p>
        <p className="text-[11px] leading-relaxed text-zinc-500">Clique em um elemento para editá-lo. Duplo clique em um texto edita diretamente no canvas.</p>
      </Section>
      <Section title="Fundo">
        <FillEditor fill={ab.background} onChange={(f, k) => setBackground(f, k)} />
      </Section>
    </>
  );
}

function TextProps({ el, set }: { el: TextElement; set: (p: Partial<TextElement>, key?: string) => void }) {
  const sw = useSwatches();
  const setT = (p: Partial<TextElement>, key?: string) => set({ ...p, height: Math.round(textHeight({ ...el, ...p })) }, key);
  return (
    <Section title="Texto">
      <textarea className="input min-h-[72px] resize-y text-sm" value={el.text} onChange={(e) => setT({ text: e.target.value }, 'text')} />
      <Row label="Fonte">
        <select className="input h-8 px-2 py-1 text-xs" value={el.fontFamily} onChange={(e) => setT({ fontFamily: e.target.value, fontWeight: nearestWeight(e.target.value, el.fontWeight) })} style={{ fontFamily: el.fontFamily }}>
          {FONTS.map((f) => (
            <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
              {f.family}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Peso">
        <div className="flex gap-2">
          <select className="input h-8 px-2 py-1 text-xs" value={el.fontWeight} onChange={(e) => setT({ fontWeight: Number(e.target.value) })}>
            {fontWeights(el.fontFamily).map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <button className={`icon-btn border border-zinc-800 italic ${el.italic ? 'bg-zinc-700 text-white' : ''}`} onClick={() => setT({ italic: !el.italic })} title="Itálico">
            I
          </button>
          <button className={`icon-btn border border-zinc-800 text-[10px] ${el.uppercase ? 'bg-zinc-700 text-white' : ''}`} onClick={() => setT({ uppercase: !el.uppercase })} title="Caixa-alta">
            AA
          </button>
        </div>
      </Row>
      <Row label="Tamanho">
        <div className="flex gap-2">
          <div className="flex-1">
            <Slider value={el.fontSize} min={8} max={400} onChange={(v) => setT({ fontSize: v }, 'size')} suffix="" />
          </div>
          <div className="w-16">
            <NumberInput value={el.fontSize} onChange={(v) => setT({ fontSize: Math.max(4, v) })} />
          </div>
        </div>
      </Row>
      <Row label="Espaçam.">
        <Slider value={el.letterSpacing} min={-0.1} max={0.6} step={0.005} onChange={(v) => setT({ letterSpacing: v }, 'ls')} format={(v) => `${Math.round(v * 1000)}`} />
      </Row>
      <Row label="Entrelinha">
        <Slider value={el.lineHeight} min={0.7} max={2.2} step={0.01} onChange={(v) => setT({ lineHeight: v }, 'lh')} />
      </Row>
      <Row label="Alinhar">
        <Segmented
          value={el.align}
          options={[
            { value: 'left', label: <Icon name="textLeft" size={14} />, title: 'Esquerda' },
            { value: 'center', label: <Icon name="textCenter" size={14} />, title: 'Centro' },
            { value: 'right', label: <Icon name="textRight" size={14} />, title: 'Direita' },
          ]}
          onChange={(a) => setT({ align: a })}
        />
      </Row>
      <Row label="Cor">
        <ColorInput value={el.fill} onChange={(c) => set({ fill: c }, 'fill')} />
      </Row>
      <Swatches colors={sw} onPick={(c) => set({ fill: c })} />
    </Section>
  );
}

function ShapeProps({ el, set }: { el: ShapeElement; set: (p: Partial<ShapeElement>, key?: string) => void }) {
  const sw = useSwatches();
  return (
    <>
      {el.shape !== 'line' && (
        <Section title="Preenchimento">
          <FillEditor fill={el.fill} onChange={(f, k) => set({ fill: f }, 'fill' + k)} />
          <button className="text-[11px] text-zinc-500 hover:text-zinc-300" onClick={() => set({ fill: { ...el.fill, type: 'solid', color: 'transparent' } })}>
            Sem preenchimento
          </button>
        </Section>
      )}
      <Section title={el.shape === 'line' ? 'Linha' : 'Contorno'}>
        <Row label="Cor">
          <ColorInput value={el.stroke || '#000000'} onChange={(c) => set({ stroke: c, strokeWidth: el.strokeWidth || 2 }, 'stroke')} />
        </Row>
        <Swatches colors={sw} onPick={(c) => set({ stroke: c, strokeWidth: el.strokeWidth || 2 })} />
        <Row label="Espessura">
          <Slider value={el.strokeWidth} min={0} max={40} step={0.5} onChange={(v) => set({ strokeWidth: v }, 'sw')} />
        </Row>
        {el.shape === 'rect' && (
          <Row label="Cantos">
            <Slider value={el.cornerRadius} min={0} max={Math.round(Math.min(el.width, el.height) / 2)} onChange={(v) => set({ cornerRadius: v }, 'cr')} />
          </Row>
        )}
      </Section>
    </>
  );
}

function ImageProps({ el, set }: { el: ImageElement; set: (p: Partial<ImageElement>, key?: string) => void }) {
  const project = useStore((s) => s.project)!;
  const addAsset = useStore((s) => s.addAsset);
  const notify = useStore((s) => s.notify);
  const asset = project.assets[el.assetId];
  const others = Object.values(project.assets).filter((a) => a.kind !== 'reference' && a.id !== el.assetId);
  return (
    <>
      <Section title="Imagem">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded border border-zinc-800 bg-zinc-900">{asset && <img src={asset.src} className="h-full w-full object-contain" alt="" />}</div>
          <div className="min-w-0 text-xs text-zinc-400">
            <div className="truncate text-zinc-200">{asset?.name}</div>
            {asset && (
              <div>
                {asset.width} × {asset.height} px (original preservado)
              </div>
            )}
          </div>
        </div>
        <FilePick
          className="btn-outline w-full text-xs"
          onFiles={async ([f]) => {
            try {
              const a = await fileToAsset(f, 'upload');
              addAsset(a);
              set({ assetId: a.id, name: a.name, cropZoom: 1, focusX: 0.5, focusY: 0.5 });
            } catch {
              notify('Não foi possível ler a imagem.', 'err');
            }
          }}
        >
          <Icon name="upload" size={14} /> Substituir fotografia
        </FilePick>
        {others.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] text-zinc-500">Ou trocar por uma imagem do projeto:</div>
            <div className="flex flex-wrap gap-1.5">
              {others.map((a) => (
                <button key={a.id} title={a.name} onClick={() => set({ assetId: a.id, name: a.name })} className="h-10 w-10 overflow-hidden rounded border border-zinc-800 hover:border-zinc-500">
                  <img src={a.src} className="h-full w-full object-cover" alt="" />
                </button>
              ))}
            </div>
          </div>
        )}
        <Row label="Encaixe">
          <Segmented
            value={el.fit}
            options={[
              { value: 'cover', label: 'Preencher', title: 'Recorta para preencher a moldura' },
              { value: 'contain', label: 'Inteira', title: 'Mostra a imagem completa, sem cortes' },
            ]}
            onChange={(v) => set({ fit: v })}
          />
        </Row>
        {asset && (
          <button className="text-[11px] text-zinc-500 hover:text-zinc-300" onClick={() => set({ height: Math.round((el.width * asset.height) / asset.width) })}>
            Restaurar proporção original
          </button>
        )}
      </Section>
      {el.fit === 'cover' && (
        <Section title="Recorte">
          <Row label="Zoom">
            <Slider value={el.cropZoom} min={1} max={4} step={0.01} onChange={(v) => set({ cropZoom: v }, 'cz')} format={(v) => `${Math.round(v * 100)}%`} />
          </Row>
          <Row label="Horizontal">
            <Slider value={el.focusX} min={0} max={1} step={0.005} onChange={(v) => set({ focusX: v }, 'fx')} format={(v) => `${Math.round(v * 100)}%`} />
          </Row>
          <Row label="Vertical">
            <Slider value={el.focusY} min={0} max={1} step={0.005} onChange={(v) => set({ focusY: v }, 'fy')} format={(v) => `${Math.round(v * 100)}%`} />
          </Row>
        </Section>
      )}
      {el.fit === 'cover' && (
        <Section title="Máscara">
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ['none', 'square', 'Nenhuma'],
                ['rounded', 'frame', 'Cantos'],
                ['circle', 'circle', 'Círculo'],
                ['arch', 'arch', 'Arco'],
              ] as [MaskKind, string, string][]
            ).map(([m, ic, label]) => (
              <button key={m} onClick={() => set({ mask: m, cornerRadius: m === 'rounded' && !el.cornerRadius ? 32 : el.cornerRadius })} className={`flex flex-col items-center gap-1 rounded-md border py-2 text-[10px] ${el.mask === m ? 'border-zinc-300 text-white' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
                <Icon name={ic} size={16} />
                {label}
              </button>
            ))}
          </div>
          {el.mask === 'rounded' && (
            <Row label="Raio">
              <Slider value={el.cornerRadius} min={0} max={Math.round(Math.min(el.width, el.height) / 2)} onChange={(v) => set({ cornerRadius: v }, 'cr')} />
            </Row>
          )}
        </Section>
      )}
      <Section title="Ajustes">
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={el.grayscale} onChange={(e) => set({ grayscale: e.target.checked })} /> Preto e branco
        </label>
      </Section>
    </>
  );
}

function CommonProps({ el, set }: { el: DesignElement; set: (p: Partial<DesignElement>, key?: string) => void }) {
  const ab = useArtboard()!;
  const { duplicate, remove, reorder } = useStore();
  const sh = el.shadow ?? defaultShadow();
  const box = { w: el.width, h: el.type === 'text' ? textHeight(el) : el.height };
  const align = (k: string) => {
    const p: Partial<DesignElement> = {};
    if (k === 'l') p.x = 0;
    if (k === 'c') p.x = Math.round((ab.width - box.w) / 2);
    if (k === 'r') p.x = Math.round(ab.width - box.w);
    if (k === 't') p.y = 0;
    if (k === 'm') p.y = Math.round((ab.height - box.h) / 2);
    if (k === 'b') p.y = Math.round(ab.height - box.h);
    set(p);
  };
  return (
    <>
      <Section
        title="Elemento"
        right={
          <div className="flex">
            <button className="icon-btn" title={el.locked ? 'Desbloquear' : 'Bloquear'} onClick={() => set({ locked: !el.locked })}>
              <Icon name={el.locked ? 'lock' : 'unlock'} />
            </button>
            <button className="icon-btn" title="Duplicar (Ctrl+D)" onClick={() => duplicate(el.id)}>
              <Icon name="copy" />
            </button>
            <button className="icon-btn" title="Excluir (Delete)" onClick={() => remove(el.id)}>
              <Icon name="trash" />
            </button>
          </div>
        }
      >
        <input className="input h-8 px-2 py-1 text-xs" value={el.name} onChange={(e) => set({ name: e.target.value }, 'name')} />
        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y', 'width', 'height'] as const).map((k) =>
            el.type === 'text' && k === 'height' ? (
              <div key={k} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span className="w-3">A</span>
                <span className="tabular-nums">{Math.round(box.h)} (auto)</span>
              </div>
            ) : (
              <label key={k} className="flex items-center gap-1.5">
                <span className="w-3 text-[11px] uppercase text-zinc-500">{k === 'width' ? 'L' : k === 'height' ? 'A' : k}</span>
                <NumberInput value={el[k]} onChange={(v) => set({ [k]: k === 'width' || k === 'height' ? Math.max(1, v) : v })} />
              </label>
            ),
          )}
        </div>
        <Row label="Rotação">
          <Slider value={el.rotation} min={-180} max={180} onChange={(v) => set({ rotation: v }, 'rot')} suffix="°" />
        </Row>
        <Row label="Opacidade">
          <Slider value={el.opacity} min={0} max={1} step={0.01} onChange={(v) => set({ opacity: v }, 'op')} format={(v) => `${Math.round(v * 100)}%`} />
        </Row>
        <div>
          <div className="mb-1.5 text-[11px] text-zinc-500">Alinhar à prancheta</div>
          <div className="flex gap-0.5">
            {[
              ['l', 'alignLeft'],
              ['c', 'alignCenter'],
              ['r', 'alignRight'],
              ['t', 'alignTop'],
              ['m', 'alignMiddle'],
              ['b', 'alignBottom'],
            ].map(([k, ic]) => (
              <button key={k} className="icon-btn" disabled={el.locked} onClick={() => align(k)}>
                <Icon name={ic} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] text-zinc-500">Ordem</div>
          <div className="flex gap-0.5">
            <button className="icon-btn" title="Trazer para frente" onClick={() => reorder(el.id, 'top')}>
              <Icon name="top" />
            </button>
            <button className="icon-btn" title="Avançar" onClick={() => reorder(el.id, 'up')}>
              <Icon name="up" />
            </button>
            <button className="icon-btn" title="Recuar" onClick={() => reorder(el.id, 'down')}>
              <Icon name="down" />
            </button>
            <button className="icon-btn" title="Enviar para trás" onClick={() => reorder(el.id, 'bottom')}>
              <Icon name="bottom" />
            </button>
          </div>
        </div>
      </Section>
      <Section
        title="Sombra"
        right={
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <input type="checkbox" checked={sh.enabled} onChange={(e) => set({ shadow: { ...sh, enabled: e.target.checked } })} /> Ativar
          </label>
        }
      >
        {sh.enabled && (
          <>
            <Row label="Cor">
              <ColorInput value={sh.color} onChange={(c) => set({ shadow: { ...sh, color: c } }, 'shc')} />
            </Row>
            <Row label="Desfoque">
              <Slider value={sh.blur} min={0} max={120} onChange={(v) => set({ shadow: { ...sh, blur: v } }, 'shb')} />
            </Row>
            <Row label="Desloc. X">
              <Slider value={sh.offsetX} min={-80} max={80} onChange={(v) => set({ shadow: { ...sh, offsetX: v } }, 'shx')} />
            </Row>
            <Row label="Desloc. Y">
              <Slider value={sh.offsetY} min={-80} max={80} onChange={(v) => set({ shadow: { ...sh, offsetY: v } }, 'shy')} />
            </Row>
            <Row label="Intensid.">
              <Slider value={sh.opacity} min={0} max={1} step={0.01} onChange={(v) => set({ shadow: { ...sh, opacity: v } }, 'sho')} format={(v) => `${Math.round(v * 100)}%`} />
            </Row>
          </>
        )}
      </Section>
    </>
  );
}

export function PropertiesPanel() {
  const ab = useArtboard();
  const { selectedId, update } = useStore();
  const el = ab?.elements.find((e) => e.id === selectedId);
  if (!ab) return null;
  if (!el) return <ArtboardProps />;
  const set = (p: Partial<DesignElement>, key?: string) => update(el.id, p, key);
  return (
    <>
      {el.type === 'text' && <TextProps el={el} set={set as (p: Partial<TextElement>, k?: string) => void} />}
      {el.type === 'shape' && <ShapeProps el={el} set={set as (p: Partial<ShapeElement>, k?: string) => void} />}
      {el.type === 'image' && <ImageProps el={el} set={set as (p: Partial<ImageElement>, k?: string) => void} />}
      <CommonProps el={el} set={set} />
    </>
  );
}
