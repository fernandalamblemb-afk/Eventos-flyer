// Modelo de dados estruturado do Studio Design AI.
// Todas as coordenadas estão em pixels reais da prancheta (1080×1350 / 1080×1920).

export type FormatId = 'feed' | 'story';

export const FORMATS: Record<FormatId, { label: string; width: number; height: number }> = {
  feed: { label: 'Feed 1080 × 1350', width: 1080, height: 1350 },
  story: { label: 'Story 1080 × 1920', width: 1080, height: 1920 },
};

export interface Shadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface ElementBase {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  shadow?: Shadow;
  /** Papel semântico (ex.: "title", "date") usado pelo motor de composição. */
  role?: string;
}

export type TextAlign = 'left' | 'center' | 'right';

export interface TextElement extends ElementBase {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  /** Espaçamento entre letras em em (0.1 = 10% do corpo). */
  letterSpacing: number;
  lineHeight: number;
  align: TextAlign;
  fill: string;
  uppercase: boolean;
}

export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'line' | 'arch';

export interface Fill {
  type: 'solid' | 'linear';
  color: string;
  color2: string;
  /** Ângulo do gradiente em graus (0 = esquerda→direita, 90 = topo→base). */
  angle: number;
  /** Opacidade do segundo ponto (útil para véus fotográficos). */
  alpha1?: number;
  alpha2?: number;
}

export interface ShapeElement extends ElementBase {
  type: 'shape';
  shape: ShapeKind;
  fill: Fill;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

export type MaskKind = 'none' | 'rounded' | 'circle' | 'arch';

export interface ImageElement extends ElementBase {
  type: 'image';
  assetId: string;
  /** cover = preenche a moldura (recorte); contain = imagem inteira, sem cortes. */
  fit: 'cover' | 'contain';
  /** Recorte: 1 = enquadramento completo; >1 aproxima. */
  cropZoom: number;
  /** Ponto focal do recorte (0–1). */
  focusX: number;
  focusY: number;
  mask: MaskKind;
  cornerRadius: number;
  grayscale: boolean;
}

export type DesignElement = TextElement | ShapeElement | ImageElement;

export interface Artboard {
  format: FormatId;
  width: number;
  height: number;
  background: Fill;
  elements: DesignElement[];
}

export interface Asset {
  id: string;
  name: string;
  kind: 'photo' | 'logo' | 'reference' | 'generated' | 'upload';
  src: string; // dataURL
  width: number;
  height: number;
}

export type StyleId = 'editorial' | 'minimalista' | 'cinematografico' | 'contemporaneo' | 'corporativo' | 'luxo';

export interface Palette {
  id: string;
  name: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
}

export type Motif = 'linhas' | 'circulos' | 'grade' | 'cantos' | 'barras' | 'numerais';

export interface Brief {
  eventName: string;
  subtitle: string;
  date: string; // yyyy-mm-dd
  time: string; // hh:mm
  location: string;
  speaker: string;
  extra: string;
  photoIds: string[];
  logoIds: string[];
  referenceId: string | null;
  style: StyleId;
  paletteId: string; // id de paleta pré-definida, "brand", "reference" ou "photo"
  customPalette?: Palette;
  brandId: string | null;
}

export interface Brand {
  id: string;
  name: string;
  logo: Asset | null;
  palette: Palette;
  fontDisplay: string;
  fontBody: string;
  style: StyleId;
  motifs: Motif[];
  updatedAt: number;
}

export interface Proposal {
  id: string;
  conceptId: string;
  conceptName: string;
  rationale: string;
  feed: Artboard;
  story: Artboard;
}

export interface Project {
  id: string;
  name: string;
  brief: Brief;
  assets: Record<string, Asset>;
  conceptId: string;
  conceptName: string;
  feed: Artboard;
  story: Artboard;
  createdAt: number;
  updatedAt: number;
}

export const defaultShadow = (): Shadow => ({
  enabled: false,
  color: '#000000',
  blur: 30,
  offsetX: 0,
  offsetY: 12,
  opacity: 0.35,
});
