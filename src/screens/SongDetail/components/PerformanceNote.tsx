import type { CSSProperties, PointerEvent, RefObject } from 'react';
import { MoreHorizontal, StickyNote, Trash2, X } from 'lucide-react';
import type { PerformanceNoteBoxSize, PerformanceNoteColor, PerformanceNotePosition } from '../../../types/models';

interface PerformanceNoteColorConfig {
  label: string;
  background: string;
  border: string;
  text: string;
  accent: string;
}

interface PerformanceNoteProps {
  visible: boolean;
  overlayTop: number;
  overlayBottom: number;
  cardRef: RefObject<HTMLDivElement | null>;
  position: PerformanceNotePosition;
  boxSize: PerformanceNoteBoxSize;
  color: PerformanceNoteColor;
  colorKeys: readonly PerformanceNoteColor[];
  colorConfig: Record<PerformanceNoteColor, PerformanceNoteColorConfig>;
  dragging: boolean;
  resizing: boolean;
  menuOpen: boolean;
  draft: string;
  readOnly: boolean;
  saveStatus: 'idle' | 'saving' | 'saved';
  menuHighlightStyle?: CSSProperties;
  hideHighlightStyle?: CSSProperties;
  dragHighlightStyle?: CSSProperties;
  resizeHighlightStyle?: CSSProperties;
  onCardPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onCardPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onCardPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onToggleMenu: () => void;
  onHide: () => void;
  onDelete: () => void;
  onHeaderPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onTextPointerDown: () => void;
  onTextChange: (value: string) => void;
  onSelectColor: (color: PerformanceNoteColor) => void;
  onResizePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onResizePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onResizePointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onResizePointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
}

export function PerformanceNote({
  visible,
  overlayTop,
  overlayBottom,
  cardRef,
  position,
  boxSize,
  color,
  colorKeys,
  colorConfig,
  dragging,
  resizing,
  menuOpen,
  draft,
  readOnly,
  saveStatus,
  menuHighlightStyle,
  hideHighlightStyle,
  dragHighlightStyle,
  resizeHighlightStyle,
  onCardPointerMove,
  onCardPointerUp,
  onCardPointerCancel,
  onToggleMenu,
  onHide,
  onDelete,
  onHeaderPointerDown,
  onTextPointerDown,
  onTextChange,
  onSelectColor,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizePointerCancel,
}: PerformanceNoteProps) {
  if (!visible) return null;

  return (
    <div style={getOverlayStyle(overlayTop, overlayBottom)} data-swipe-ignore="true">
      <div
        ref={cardRef}
        data-swipe-ignore="true"
        style={getCardStyle(position, dragging || resizing, boxSize, color, colorConfig)}
        onPointerMove={onCardPointerMove}
        onPointerUp={onCardPointerUp}
        onPointerCancel={onCardPointerCancel}
      >
        <div style={styles.pin} />
        <button
          type="button"
          aria-label="OpÃƒÂ§ÃƒÂµes do post-it"
          style={{
            ...styles.menuButton,
            ...menuHighlightStyle,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleMenu}
        >
          <MoreHorizontal size={14} color={colorConfig[color].accent} />
        </button>
        <button
          type="button"
          aria-label="Ocultar lembrete"
          style={{
            ...styles.closeButton,
            ...hideHighlightStyle,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onHide}
        >
          <X size={13} color={colorConfig[color].accent} />
        </button>
        {menuOpen ? (
          <div style={styles.menu}>
            <div style={styles.menuTitle}>Trocar cor</div>
            <div style={styles.colorRow}>
              {colorKeys.map((option) => (
                <button
                  key={option}
                  type="button"
                  title={colorConfig[option].label}
                  style={getColorButtonStyle(option, color, colorConfig)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onSelectColor(option)}
                />
              ))}
            </div>
            <button
              type="button"
              style={styles.deleteButton}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onDelete}
            >
              <Trash2 size={13} color="#991b1b" />
              Excluir Lembrete
            </button>
          </div>
        ) : null}
        <div
          style={{
            ...styles.noteHeader,
            ...dragHighlightStyle,
          }}
          onPointerDown={onHeaderPointerDown}
        >
          <span style={styles.iconBox}>
            <StickyNote size={15} color={colorConfig[color].accent} />
          </span>
          <span style={styles.label}>Lembrete</span>
        </div>
        <textarea
          value={draft}
          readOnly={readOnly}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Ex: Tom D"
          style={getTextareaStyle(boxSize, color, colorConfig)}
          onPointerDown={(event) => {
            event.stopPropagation();
            onTextPointerDown();
          }}
        />
        <div style={styles.noteFooter}>
          <span style={styles.autosaveStatus}>
            {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Autosave'}
          </span>
        </div>
        <div
          style={{
            ...styles.resizeHandle,
            ...resizeHighlightStyle,
          }}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerCancel}
        />
      </div>
    </div>
  );
}

const getCardStyle = (
  position: PerformanceNotePosition,
  dragging: boolean,
  boxSize: PerformanceNoteBoxSize,
  color: PerformanceNoteColor,
  colorConfig: Record<PerformanceNoteColor, PerformanceNoteColorConfig>
): CSSProperties => ({
  width: boxSize.width,
  height: boxSize.height,
  position: 'absolute',
  left: position.x,
  top: position.y,
  zIndex: 40,
  maxWidth: 'calc(100vw - 24px)',
  borderRadius: 10,
  border: `1px solid ${colorConfig[color].border}`,
  background: colorConfig[color].background,
  boxShadow: dragging
    ? '0 18px 36px rgba(0, 0, 0, 0.36)'
    : '0 12px 24px rgba(0, 0, 0, 0.26)',
  padding: '14px 14px 16px',
  color: colorConfig[color].text,
  cursor: dragging ? 'grabbing' : 'grab',
  touchAction: 'none',
  userSelect: 'none',
  pointerEvents: 'auto',
  transform: dragging ? 'rotate(-1deg) scale(1.015)' : 'rotate(-1deg)',
  transition: dragging ? 'none' : 'box-shadow 140ms ease, transform 140ms ease',
});

const getOverlayStyle = (top: number, bottom: number): CSSProperties => ({
  position: 'fixed',
  top,
  left: 0,
  right: 0,
  bottom,
  zIndex: 39,
  pointerEvents: 'none',
  overflow: 'hidden',
});

const getTextareaStyle = (
  boxSize: PerformanceNoteBoxSize,
  color: PerformanceNoteColor,
  colorConfig: Record<PerformanceNoteColor, PerformanceNoteColorConfig>
): CSSProperties => ({
  width: '100%',
  minHeight: Math.max(56, boxSize.height - 86),
  border: 'none',
  outline: 'none',
  resize: 'none',
  background: 'rgba(255, 255, 255, 0.2)',
  borderRadius: 8,
  color: colorConfig[color].text,
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: '700',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  padding: '8px 9px',
});

const getColorButtonStyle = (
  color: PerformanceNoteColor,
  selectedColor: PerformanceNoteColor,
  colorConfig: Record<PerformanceNoteColor, PerformanceNoteColorConfig>
): CSSProperties => ({
  width: 22,
  height: 22,
  borderRadius: 999,
  border: color === selectedColor ? `2px solid ${colorConfig[color].accent}` : '1px solid rgba(0,0,0,0.18)',
  background: colorConfig[color].background,
  cursor: 'pointer',
  padding: 0,
});

const styles = {
  pin: {
    position: 'absolute',
    top: 8,
    left: '50%',
    width: 34,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(120, 82, 12, 0.18)',
    transform: 'translateX(-50%)',
  },
  closeButton: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    border: '1px solid rgba(95, 67, 0, 0.22)',
    background: 'rgba(255, 255, 255, 0.38)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
  },
  menuButton: {
    position: 'absolute',
    top: 7,
    right: 36,
    width: 24,
    height: 24,
    borderRadius: 12,
    border: '1px solid rgba(95, 67, 0, 0.22)',
    background: 'rgba(255, 255, 255, 0.38)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
  },
  menu: {
    position: 'absolute',
    top: 36,
    right: 8,
    zIndex: 2,
    width: 186,
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.14)',
    background: 'rgba(255,255,255,0.88)',
    boxShadow: '0 12px 22px rgba(0,0,0,0.22)',
    padding: 10,
  },
  menuTitle: {
    color: '#3d2a03',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  colorRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 7,
    marginBottom: 10,
  },
  deleteButton: {
    width: '100%',
    minHeight: 32,
    borderRadius: 8,
    border: '1px solid rgba(153,27,27,0.18)',
    background: 'rgba(254,226,226,0.78)',
    color: '#991b1b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    fontSize: 12,
    fontWeight: '900',
    cursor: 'pointer',
  },
  noteHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    paddingRight: 24,
    marginTop: 4,
    marginBottom: 8,
    cursor: 'grab',
    touchAction: 'none',
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
    border: '1px solid rgba(95, 67, 0, 0.18)',
    flexShrink: 0,
  },
  label: {
    color: '#5f4300',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  noteFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  autosaveStatus: {
    color: '#5f4300',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    opacity: 0.72,
  },
  resizeHandle: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRight: '3px solid rgba(95, 67, 0, 0.34)',
    borderBottom: '3px solid rgba(95, 67, 0, 0.34)',
    borderRadius: 3,
    cursor: 'nwse-resize',
    touchAction: 'none',
  },
} satisfies Record<string, CSSProperties>;
