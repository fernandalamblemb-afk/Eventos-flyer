// Renderizador único do modelo → Konva. Usado no editor, nas miniaturas e na exportação,
// garantindo que o arquivo exportado seja idêntico ao que se vê na tela.
import { forwardRef, useEffect, useRef } from 'react';
import { Group, Image as KImage, Line, Rect, Ellipse, Shape, Text } from 'react-konva';
import Konva from 'konva';
import type { Artboard, Asset, DesignElement, Fill, ImageElement, ShapeElement, TextElement } from '../types';
import { useImage } from '../lib/imageCache';
import { rgba } from '../engine/palettes';

// ---------- utilidades geométricas compartilhadas (também usadas no SVG) ----------

export function gradientPoints(angle: number, w: number, h: number) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const hl = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  return {
    start: { x: w / 2 - dx * hl, y: h / 2 - dy * hl },
    end: { x: w / 2 + dx * hl, y: h / 2 + dy * hl },
  };
}

export function fillProps(fill: Fill, w: number, h: number): Record<string, unknown> {
  if (fill.type === 'linear') {
    const { start, end } = gradientPoints(fill.angle, w, h);
    const c1 = fill.color === 'transparent' ? 'rgba(0,0,0,0)' : rgba(fill.color, fill.alpha1 ?? 1);
    const c2 = fill.color2 === 'transparent' ? 'rgba(0,0,0,0)' : rgba(fill.color2, fill.alpha2 ?? 1);
    return {
      fillLinearGradientStartPoint: start,
      fillLinearGradientEndPoint: end,
      fillLinearGradientColorStops: [0, c1, 1, c2],
    };
  }
  if (!fill.color || fill.color === 'transparent') return { fill: undefined };
  return { fill: fill.color };
}

export function coverCrop(img: { width: number; height: number }, el: Pick<ImageElement, 'width' | 'height' | 'cropZoom' | 'focusX' | 'focusY'>) {
  const s = Math.max(el.width / img.width, el.height / img.height) * Math.max(1, el.cropZoom);
  const cw = el.width / s;
  const ch = el.height / s;
  return { x: (img.width - cw) * el.focusX, y: (img.height - ch) * el.focusY, width: cw, height: ch };
}

export function containBox(img: { width: number; height: number }, w: number, h: number) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  return { x: (w - dw) / 2, y: (h - dh) / 2, width: dw, height: dh };
}

export function maskPath(ctx: { beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void; ellipse(x: number, y: number, rx: number, ry: number, rot: number, s: number, e: number, ccw?: boolean): void; rect(x: number, y: number, w: number, h: number): void; closePath(): void }, mask: string, w: number, h: number, r: number) {
  ctx.beginPath();
  if (mask === 'circle') ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (mask === 'arch') {
    const ry = Math.min(w / 2, h);
    ctx.moveTo(0, h);
    ctx.lineTo(0, ry);
    ctx.ellipse(w / 2, ry, w / 2, ry, 0, Math.PI, 0);
    ctx.lineTo(w, h);
    ctx.closePath();
  } else if (mask === 'rounded' && r > 0) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(rr, 0);
    ctx.arcTo(w, 0, w, h, rr);
    ctx.arcTo(w, h, 0, h, rr);
    ctx.arcTo(0, h, 0, 0, rr);
    ctx.arcTo(0, 0, w, 0, rr);
    ctx.closePath();
  } else ctx.rect(0, 0, w, h);
}

const shadowProps = (el: DesignElement) =>
  el.shadow?.enabled
    ? {
        shadowEnabled: true,
        shadowColor: el.shadow.color,
        shadowBlur: el.shadow.blur,
        shadowOffsetX: el.shadow.offsetX,
        shadowOffsetY: el.shadow.offsetY,
        shadowOpacity: el.shadow.opacity,
      }
    : { shadowEnabled: false };

// ---------- nós ----------

export interface NodeHandlers {
  draggable?: boolean;
  onMouseDown?: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDblClick?: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd?: (e: Konva.KonvaEventObject<Event>) => void;
}

function TextNode({ el, hidden }: { el: TextElement; hidden?: boolean }) {
  return (
    <Text
      text={el.uppercase ? el.text.toUpperCase() : el.text}
      width={el.width}
      fontFamily={el.fontFamily}
      fontSize={el.fontSize}
      fontStyle={`${el.italic ? 'italic ' : ''}${el.fontWeight}`}
      letterSpacing={el.letterSpacing * el.fontSize}
      lineHeight={el.lineHeight}
      align={el.align}
      fill={el.fill}
      wrap="word"
      opacity={hidden ? 0 : 1}
      {...shadowProps(el)}
    />
  );
}

function ShapeNode({ el }: { el: ShapeElement }) {
  const fp = fillProps(el.fill, el.width, el.height);
  const stroke = el.strokeWidth > 0 && el.stroke ? { stroke: el.stroke, strokeWidth: el.strokeWidth } : {};
  const common = { ...fp, ...stroke, ...shadowProps(el) };
  switch (el.shape) {
    case 'ellipse':
      return <Ellipse x={el.width / 2} y={el.height / 2} radiusX={el.width / 2} radiusY={el.height / 2} {...common} />;
    case 'triangle':
      return <Line points={[el.width / 2, 0, el.width, el.height, 0, el.height]} closed {...common} />;
    case 'line':
      return (
        <>
          <Rect width={el.width} height={Math.max(el.height, 12)} y={Math.min(0, (el.height - 12) / 2)} fill="rgba(0,0,0,0)" />
          <Line points={[0, el.height / 2, el.width, el.height / 2]} stroke={el.stroke || (el.fill.color !== 'transparent' ? el.fill.color : '#000')} strokeWidth={Math.max(1, el.strokeWidth || 2)} {...shadowProps(el)} />
        </>
      );
    case 'arch':
      return (
        <Shape
          width={el.width}
          height={el.height}
          sceneFunc={(ctx, shape) => {
            maskPath(ctx as unknown as CanvasRenderingContext2D, 'arch', el.width, el.height, 0);
            ctx.fillStrokeShape(shape);
          }}
          {...common}
        />
      );
    default:
      return <Rect width={el.width} height={el.height} cornerRadius={el.cornerRadius} {...common} />;
  }
}

function ImageNode({ el, asset }: { el: ImageElement; asset?: Asset }) {
  const img = useImage(asset?.src);
  const ref = useRef<Konva.Image>(null);
  useEffect(() => {
    const n = ref.current;
    if (!n || !img) return;
    if (el.grayscale) {
      n.cache({ pixelRatio: 2 });
      n.filters([Konva.Filters.Grayscale]);
    } else {
      n.filters([]);
      n.clearCache();
    }
    n.getLayer()?.batchDraw();
  }, [img, el.grayscale, el.width, el.height, el.cropZoom, el.focusX, el.focusY, el.fit]);

  const hit = <Rect width={el.width} height={el.height} fill="rgba(0,0,0,0)" />;
  if (!img) return <>{hit}<Rect width={el.width} height={el.height} fill="#27272a" opacity={0.4} /></>;

  if (el.fit === 'contain') {
    const b = containBox(img, el.width, el.height);
    return (
      <>
        {hit}
        <KImage ref={ref} image={img} x={b.x} y={b.y} width={b.width} height={b.height} {...shadowProps(el)} />
      </>
    );
  }
  const crop = coverCrop(img, el);
  const masked = el.mask !== 'none' && !(el.mask === 'rounded' && el.cornerRadius <= 0);
  return (
    <>
      {el.shadow?.enabled && (
        <Shape
          sceneFunc={(ctx, shape) => {
            maskPath(ctx as unknown as CanvasRenderingContext2D, el.mask, el.width, el.height, el.cornerRadius);
            ctx.fillStrokeShape(shape);
          }}
          fill="#000"
          {...shadowProps(el)}
        />
      )}
      <Group
        clipFunc={masked ? (ctx) => maskPath(ctx as unknown as CanvasRenderingContext2D, el.mask, el.width, el.height, el.cornerRadius) : undefined}
      >
        <KImage ref={ref} image={img} width={el.width} height={el.height} crop={crop} />
      </Group>
    </>
  );
}

export const ElementNode = forwardRef<Konva.Group, { el: DesignElement; assets: Record<string, Asset>; handlers?: NodeHandlers; hideText?: boolean }>(
  function ElementNode({ el, assets, handlers, hideText }, ref) {
    if (!el.visible) return null;
    return (
      <Group
        ref={ref}
        id={el.id}
        name="element"
        x={el.x}
        y={el.y}
        rotation={el.rotation}
        opacity={el.opacity}
        draggable={handlers?.draggable && !el.locked}
        listening={!!handlers}
        onMouseDown={handlers?.onMouseDown}
        onTouchStart={handlers?.onMouseDown}
        onDblClick={handlers?.onDblClick}
        onDblTap={handlers?.onDblClick}
        onDragStart={handlers?.onDragStart}
        onDragMove={handlers?.onDragMove}
        onDragEnd={handlers?.onDragEnd}
        onTransformEnd={handlers?.onTransformEnd}
      >
        {el.type === 'text' && <TextNode el={el} hidden={hideText} />}
        {el.type === 'shape' && <ShapeNode el={el} />}
        {el.type === 'image' && <ImageNode el={el} asset={assets[el.assetId]} />}
      </Group>
    );
  },
);

export function BackgroundNode({ ab, onMouseDown }: { ab: Artboard; onMouseDown?: () => void }) {
  return <Rect name="background" width={ab.width} height={ab.height} {...fillProps(ab.background, ab.width, ab.height)} fill={ab.background.type === 'solid' ? ab.background.color : undefined} onMouseDown={onMouseDown} onTouchStart={onMouseDown} />;
}

/** Conteúdo estático (sem interação) de uma prancheta. */
export function StaticArtboard({ ab, assets }: { ab: Artboard; assets: Record<string, Asset> }) {
  return (
    <>
      <BackgroundNode ab={ab} />
      {ab.elements.map((el) => (
        <ElementNode key={el.id} el={el} assets={assets} />
      ))}
    </>
  );
}
