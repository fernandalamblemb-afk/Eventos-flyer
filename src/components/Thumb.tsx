import { Layer, Stage } from 'react-konva';
import type { Artboard, Asset } from '../types';
import { StaticArtboard } from './ArtboardRenderer';

/** Miniatura fiel de uma prancheta (mesmo renderizador do editor e da exportação). */
export function Thumb({ ab, assets, width }: { ab: Artboard; assets: Record<string, Asset>; width: number }) {
  const s = width / ab.width;
  return (
    <Stage width={width} height={ab.height * s} scaleX={s} scaleY={s} listening={false}>
      <Layer listening={false}>
        <StaticArtboard ab={ab} assets={assets} />
      </Layer>
    </Stage>
  );
}
