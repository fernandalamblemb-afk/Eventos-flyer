import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Layer, Line, Stage, Transformer } from 'react-konva';
import Konva from 'konva';
import { useArtboard, useStore } from '../../store';
import type { DesignElement, TextElement } from '../../types';
import { BackgroundNode, ElementNode } from '../ArtboardRenderer';
import { textHeight } from '../../engine/text';

interface Guide {
  o: 'v' | 'h';
  pos: number;
}
interface Snap {
  v: number[];
  h: number[];
}

export function EditorCanvas() {
  const ab = useArtboard();
  const assets = useStore((s) => s.project?.assets ?? {});
  const { selectedId, select, update, zoom, setZoom, editingTextId, setEditingText, format } = useStore();
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<Snap>({ v: [], h: [] });
  const [guides, setGuides] = useState<Guide[]>([]);

  const selected = ab?.elements.find((e) => e.id === selectedId) ?? null;

  // Ajusta o zoom para caber na área visível ao trocar de formato
  const fit = useCallback(() => {
    const w = wrapRef.current;
    if (!w || !ab) return;
    const z = Math.min((w.clientWidth - 96) / ab.width, (w.clientHeight - 96) / ab.height);
    setZoom(Math.max(0.1, Math.floor(z * 100) / 100));
  }, [ab?.width, ab?.height, setZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    fit();
  }, [format]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = () => fit();
    window.addEventListener('studio:fit', h);
    return () => window.removeEventListener('studio:fit', h);
  }, [fit]);

  // Redesenha quando as webfonts terminam de carregar
  useEffect(() => {
    const h = () => stageRef.current?.batchDraw();
    document.fonts?.addEventListener('loadingdone', h);
    return () => document.fonts?.removeEventListener('loadingdone', h);
  }, []);

  // Conecta o Transformer ao elemento selecionado
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selectedId && editingTextId !== selectedId ? stage.findOne('#' + selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, ab, editingTextId]);

  // Ctrl/⌘ + roda = zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(useStore.getState().zoom * (e.deltaY > 0 ? 0.92 : 1.08));
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [setZoom]);

  if (!ab) return null;

  // ---------------- guias de alinhamento ----------------
  const collectSnaps = (selfId: string) => {
    const layer = layerRef.current!;
    const v = [0, ab.width / 2, ab.width];
    const h = [0, ab.height / 2, ab.height];
    layer.find('.element').forEach((n) => {
      if (n.id() === selfId) return;
      const r = n.getClientRect({ relativeTo: layer });
      v.push(r.x, r.x + r.width / 2, r.x + r.width);
      h.push(r.y, r.y + r.height / 2, r.y + r.height);
    });
    snapRef.current = { v, h };
  };

  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const layer = layerRef.current!;
    const r = node.getClientRect({ relativeTo: layer });
    const th = 6 / zoom;
    const found: Guide[] = [];
    const tryAxis = (edges: number[], targets: number[], o: 'v' | 'h') => {
      let best: { d: number; t: number } | null = null;
      for (const ed of edges)
        for (const t of targets) {
          const d = t - ed;
          if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t };
        }
      if (best) {
        if (o === 'v') node.x(node.x() + best.d);
        else node.y(node.y() + best.d);
        found.push({ o, pos: best.t });
      }
    };
    tryAxis([r.x, r.x + r.width / 2, r.x + r.width], snapRef.current.v, 'v');
    tryAxis([r.y, r.y + r.height / 2, r.y + r.height], snapRef.current.h, 'h');
    setGuides(found);
  };

  const onTransform = (el: DesignElement) => (e: Konva.KonvaEventObject<Event>) => {
    if (el.type !== 'text') return;
    const node = e.target as Konva.Group;
    const anchor = trRef.current?.getActiveAnchor() ?? '';
    if (anchor === 'middle-left' || anchor === 'middle-right') {
      const t = node.findOne('Text') as Konva.Text;
      const sx = node.scaleX();
      node.scaleX(1);
      t.width(Math.max(20, t.width() * sx));
    }
  };

  const onTransformEnd = (el: DesignElement) => (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target as Konva.Group;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const base = { x: Math.round(node.x()), y: Math.round(node.y()), rotation: Math.round(node.rotation() * 10) / 10 };
    if (el.type === 'text') {
      const t = node.findOne('Text') as Konva.Text;
      const width = Math.round(t.width() * sx);
      const fontSize = Math.max(6, Math.round(el.fontSize * sy * 10) / 10);
      const next = { ...el, ...base, width, fontSize };
      update(el.id, { ...base, width, fontSize, height: Math.round(textHeight(next)) } as Partial<TextElement>);
    } else {
      update(el.id, { ...base, width: Math.max(4, Math.round(el.width * sx)), height: Math.max(2, Math.round(el.height * sy)) });
    }
  };

  const editing = ab.elements.find((e) => e.id === editingTextId && e.type === 'text') as TextElement | undefined;
  const pad = 48;
  const isKeepRatio = selected?.type === 'image' && selected.fit === 'contain';

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-auto bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:20px_20px]">
      <div className="flex min-h-full min-w-full items-center justify-center" style={{ padding: pad, width: ab.width * zoom + pad * 2, height: ab.height * zoom + pad * 2 }}>
        <div className="relative shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]" style={{ width: ab.width * zoom, height: ab.height * zoom }}>
          <Stage
            ref={stageRef}
            width={ab.width * zoom}
            height={ab.height * zoom}
            scaleX={zoom}
            scaleY={zoom}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) select(null);
            }}
          >
            <Layer ref={layerRef}>
              <BackgroundNode ab={ab} onMouseDown={() => select(null)} />
              {ab.elements.map((el) => (
                <ElementNode
                  key={el.id}
                  el={el}
                  assets={assets}
                  hideText={el.id === editingTextId}
                  handlers={{
                    draggable: true,
                    onMouseDown: (e) => {
                      e.cancelBubble = true;
                      if (selectedId !== el.id) select(el.id);
                    },
                    onDblClick: () => {
                      if (el.type === 'text' && !el.locked) {
                        select(el.id);
                        setEditingText(el.id);
                      }
                    },
                    onDragStart: () => {
                      select(el.id);
                      collectSnaps(el.id);
                    },
                    onDragMove,
                    onDragEnd: (e) => {
                      setGuides([]);
                      update(el.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
                    },
                    onTransformEnd: onTransformEnd(el),
                  }}
                />
              ))}
              <Transformer
                ref={trRef}
                rotateEnabled={!selected?.locked}
                resizeEnabled={!selected?.locked}
                borderStroke={selected?.locked ? '#a1a1aa' : '#4f8cff'}
                borderDash={selected?.locked ? [4, 4] : undefined}
                anchorStroke="#4f8cff"
                anchorFill="#ffffff"
                anchorSize={9}
                anchorCornerRadius={2}
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                rotationSnapTolerance={4}
                keepRatio={isKeepRatio}
                enabledAnchors={
                  selected?.type === 'text'
                    ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']
                    : isKeepRatio
                      ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                      : undefined
                }
                boundBoxFunc={(o, n) => (Math.abs(n.width) < 8 || Math.abs(n.height) < 2 ? o : n)}
                onTransform={(e) => selected && onTransform(selected)(e)}
              />
            </Layer>
            <Layer listening={false}>
              {guides.map((g, i) => (
                <Line key={i} points={g.o === 'v' ? [g.pos, 0, g.pos, ab.height] : [0, g.pos, ab.width, g.pos]} stroke="#ff3ea5" strokeWidth={1 / zoom} dash={[6 / zoom, 4 / zoom]} />
              ))}
            </Layer>
          </Stage>
          {editing && <TextEditorOverlay el={editing} zoom={zoom} onDone={() => setEditingText(null)} />}
        </div>
      </div>
    </div>
  );
}

function TextEditorOverlay({ el, zoom, onDone }: { el: TextElement; zoom: number; onDone: () => void }) {
  const update = useStore((s) => s.update);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [val, setVal] = useState(el.text);
  useEffect(() => {
    const t = ref.current;
    if (t) {
      t.focus();
      t.select();
    }
  }, []);
  const commit = () => {
    if (val !== el.text) update(el.id, { text: val, height: Math.round(textHeight({ ...el, text: val })) } as Partial<TextElement>);
    onDone();
  };
  const h = textHeight({ ...el, text: val });
  return (
    <textarea
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) commit();
      }}
      spellCheck={false}
      className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline outline-1 outline-[#4f8cff]"
      style={{
        left: el.x * zoom,
        top: el.y * zoom,
        width: el.width * zoom + 4,
        height: h * zoom + el.fontSize * zoom * 0.2,
        transform: `rotate(${el.rotation}deg)`,
        transformOrigin: 'top left',
        fontFamily: `"${el.fontFamily}"`,
        fontSize: el.fontSize * zoom,
        fontWeight: el.fontWeight,
        fontStyle: el.italic ? 'italic' : 'normal',
        letterSpacing: el.letterSpacing * el.fontSize * zoom,
        lineHeight: el.lineHeight,
        textAlign: el.align,
        color: el.fill,
        textTransform: el.uppercase ? 'uppercase' : 'none',
        opacity: el.opacity,
      }}
    />
  );
}
