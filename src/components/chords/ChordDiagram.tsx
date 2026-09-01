import { StyleSheet, Text, View } from 'react-native-web';
import type { ChordShape } from '../../lib/chordShapes';

interface ChordDiagramProps {
  shape: ChordShape;
}

const VISUAL_STRING_ORDER = [0, 1, 2, 3, 4, 5] as const;
const STRING_GAP = 30;
const FRET_GAP = 34;
const DOT_SIZE = 24;
const FRET_COUNT = 4;
const GRID_WIDTH = STRING_GAP * (VISUAL_STRING_ORDER.length - 1);
const GRID_HEIGHT = FRET_GAP * FRET_COUNT;

const getVisualStringIndex = (stringIndex: number) =>
  VISUAL_STRING_ORDER.findIndex((item) => item === stringIndex);

const getStringMarker = (shape: ChordShape, stringIndex: number) => {
  const fret = shape.frets[stringIndex];
  const stringName = shape.tuning[stringIndex];
  if (fret === 'x') return 'X';
  if (shape.rootString === stringName) return '●';
  if (fret === 0) return '○';
  return '';
};

const getFretTop = (fret: number, baseFret: number) =>
  (fret - baseFret) * FRET_GAP + FRET_GAP / 2 - DOT_SIZE / 2;

const formatBaseFret = (baseFret: number) => `${baseFret}ª`;

const getFingerLabel = (shape: ChordShape, stringIndex: number) => {
  const finger = shape.fingers?.[stringIndex];
  if (finger === undefined || finger === 'x' || finger === 0) return '•';
  return String(finger);
};

const isCoveredByBarre = (shape: ChordShape, stringIndex: number, fret: number) =>
  shape.barres?.some((barre) => {
    if (barre.fret !== fret) return false;
    const start = Math.min(barre.fromString, barre.toString);
    const end = Math.max(barre.fromString, barre.toString);
    return stringIndex >= start && stringIndex <= end;
  }) ?? false;

export function ChordDiagram({ shape }: ChordDiagramProps) {
  const baseFret = shape.baseFret ?? 1;
  const visibleFrets = Array.from({ length: FRET_COUNT + 1 }, (_, index) => index);
  const frettedStrings = shape.frets
    .map((fret, stringIndex) => ({ fret, stringIndex }))
    .filter((item): item is { fret: number; stringIndex: number } =>
      typeof item.fret === 'number' &&
      item.fret > 0 &&
      item.fret >= baseFret &&
      item.fret < baseFret + FRET_COUNT &&
      !isCoveredByBarre(shape, item.stringIndex, item.fret)
    );

  return (
    <View style={styles.content}>
      <View style={styles.markerRow}>
        {VISUAL_STRING_ORDER.map((stringIndex) => (
          <Text key={`marker-${stringIndex}`} style={styles.marker}>
            {getStringMarker(shape, stringIndex)}
          </Text>
        ))}
      </View>

      <View style={styles.gridWrap}>
        {shape.baseFret && shape.baseFret > 1 ? (
          <Text style={styles.baseFret}>{formatBaseFret(shape.baseFret)}</Text>
        ) : null}

        <View style={styles.grid}>
          {VISUAL_STRING_ORDER.map((stringIndex, visualIndex) => (
            <View
              key={`string-${stringIndex}`}
              style={[
                styles.stringLine,
                { left: visualIndex * STRING_GAP },
              ]}
            />
          ))}

          {visibleFrets.map((fretIndex) => (
            <View
              key={`fret-${fretIndex}`}
              style={[
                styles.fretLine,
                fretIndex === 0 && baseFret === 1 && styles.nutLine,
                { top: fretIndex * FRET_GAP },
              ]}
            />
          ))}

          {shape.barres?.filter((barre) =>
            barre.fret >= baseFret &&
            barre.fret < baseFret + FRET_COUNT
          ).map((barre, index) => {
            const fromVisual = getVisualStringIndex(barre.fromString);
            const toVisual = getVisualStringIndex(barre.toString);
            const minVisual = Math.min(fromVisual, toVisual);
            const maxVisual = Math.max(fromVisual, toVisual);
            const top = getFretTop(barre.fret, baseFret);
            const left = minVisual * STRING_GAP - DOT_SIZE / 2;
            const width = (maxVisual - minVisual) * STRING_GAP + DOT_SIZE;

            return (
              <View
                key={`barre-${barre.fret}-${index}`}
                style={[styles.barre, { top, left, width }]}
              >
                {barre.finger ? <Text style={styles.dotText}>{barre.finger}</Text> : null}
              </View>
            );
          })}

          {frettedStrings.map(({ fret, stringIndex }) => {
            const visualIndex = getVisualStringIndex(stringIndex);
            const top = getFretTop(fret, baseFret);
            const left = visualIndex * STRING_GAP - DOT_SIZE / 2;
            const stringName = shape.tuning[stringIndex];
            const isRoot = shape.rootString === stringName;

            return (
              <View
                key={`dot-${stringIndex}-${fret}`}
                style={[
                  styles.dot,
                  isRoot && styles.rootDot,
                  { top, left },
                ]}
              >
                <Text style={styles.dotText}>{getFingerLabel(shape, stringIndex)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.stringLabelRow}>
        {VISUAL_STRING_ORDER.map((stringIndex) => (
          <Text key={`label-${stringIndex}`} style={styles.stringLabel}>
            {shape.tuning[stringIndex]}
          </Text>
        ))}
      </View>
      <Text style={styles.legend}>X não tocar · ○ solta · ● tônica</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 8,
  },
  markerRow: {
    width: GRID_WIDTH + DOT_SIZE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  marker: {
    width: DOT_SIZE,
    textAlign: 'center',
    color: 'var(--app-text)',
    fontSize: 16,
    fontWeight: '900',
  },
  gridWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  baseFret: {
    width: 18,
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: DOT_SIZE,
    textAlign: 'right',
  },
  grid: {
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    position: 'relative',
  },
  stringLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'var(--app-muted-text)',
    opacity: 0.75,
  },
  fretLine: {
    position: 'absolute',
    left: 0,
    width: GRID_WIDTH,
    height: 1,
    backgroundColor: 'var(--app-muted-text)',
    opacity: 0.75,
  },
  nutLine: {
    height: 4,
    backgroundColor: 'var(--app-text)',
    opacity: 0.9,
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  rootDot: {
    borderColor: 'var(--app-accent)',
    borderWidth: 2,
  },
  barre: {
    position: 'absolute',
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  dotText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  stringLabelRow: {
    width: GRID_WIDTH + DOT_SIZE,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stringLabel: {
    width: DOT_SIZE,
    color: 'var(--app-muted-text)',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  legend: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '700',
  },
});
