/**
 * PosterEditorModal.tsx
 *
 * Full in-browser poster editor for IDCS.
 * Features: drag · resize · rotate · inline text edit · font/color/align controls · image fit
 * Export: html2canvas → PNG dataUrl → onExport callback
 *
 * Usage:
 *   import PosterEditorModal, { buildEditorElements } from '../../components/poster/PosterEditorModal';
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Download,
  Italic,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  X,
} from 'lucide-react';

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
export interface PosterElement {
  id: string;
  kind: 'text' | 'image';
  /** All position/size values are percentages of canvas width/height */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // degrees
  opacity: number;  // 0–1
  zIndex: number;
  // text
  text?: string;
  fontFamily?: string;
  fontSize?: number; // px rendered at 560-wide canvas
  bold?: boolean;
  italic?: boolean;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  bgColor?: string;
  // image
  src?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

type Interaction =
  | { type: 'move'; startX: number; startY: number; origX: number; origY: number }
  | { type: 'resize'; handle: Exclude<Handle, 'rotate'>; startX: number; startY: number; orig: PosterElement }
  | { type: 'rotate'; cx: number; cy: number; startAngle: number; origRotation: number };

const FONTS = [
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
  'Impact',
  'Palatino',
  'Courier New',
];

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
let _eid = 0;
function eid() {
  return `el-${++_eid}`;
}

/**
 * Build an initial set of PosterElements from the Canva template dataset,
 * the user's filled form values, and any uploaded image previews.
 * Call this when opening the editor so elements are pre-populated.
 */
export function buildEditorElements(
  dataset: Record<string, { type: string }>,
  fieldValues: Record<string, string>,
  imagePreviews: Record<string, string>,
): PosterElement[] {
  const elements: PosterElement[] = [];

  const textEntries = Object.entries(dataset).filter(([, d]) => d.type === 'text');
  const imageEntries = Object.entries(dataset).filter(([, d]) => d.type === 'image');

  // Distribute text elements evenly across the top 55% of the canvas
  const textSlotH = textEntries.length > 0 ? Math.min(18, 55 / textEntries.length) : 18;

  textEntries.forEach(([key], ti) => {
    const text = (fieldValues[key] ?? '').trim() || `[${key}]`;
    elements.push({
      id: eid(),
      kind: 'text',
      x: 5,
      y: 5 + ti * (textSlotH + 2),
      w: 90,
      h: textSlotH,
      rotation: 0,
      opacity: 0.92,
      zIndex: 10 + ti,
      text,
      fontFamily: 'Arial',
      fontSize: Math.min(28, Math.max(14, Math.round(textSlotH * 0.55))),
      bold: false,
      italic: false,
      color: '#111111',
      textAlign: 'center',
      bgColor: 'rgba(255,255,255,0.75)',
    });
  });

  // Distribute image elements along the lower half
  imageEntries.forEach(([key], ii) => {
    const src = imagePreviews[key];
    if (!src) return;
    elements.push({
      id: eid(),
      kind: 'image',
      x: 5 + (ii % 2) * 48,
      y: 60,
      w: 43,
      h: 35,
      rotation: 0,
      opacity: 1,
      zIndex: 5 + ii,
      src,
      objectFit: 'cover',
    });
  });

  return elements;
}

/* ─────────────────────────────────────────
   Handle position map
───────────────────────────────────────── */
const HANDLE_STYLES: Record<Handle, React.CSSProperties> = {
  nw: { top: -5, left: -5, cursor: 'nw-resize' },
  n:  { top: -5, left: 'calc(50% - 5px)', cursor: 'n-resize' },
  ne: { top: -5, right: -5, cursor: 'ne-resize' },
  e:  { top: 'calc(50% - 5px)', right: -5, cursor: 'e-resize' },
  se: { bottom: -5, right: -5, cursor: 'se-resize' },
  s:  { bottom: -5, left: 'calc(50% - 5px)', cursor: 's-resize' },
  sw: { bottom: -5, left: -5, cursor: 'sw-resize' },
  w:  { top: 'calc(50% - 5px)', left: -5, cursor: 'w-resize' },
  rotate: { top: -28, left: 'calc(50% - 7px)', cursor: 'grab', width: 14, height: 14, borderRadius: '50%', background: '#7c3aed' },
};

const RESIZE_HANDLES: Exclude<Handle, 'rotate'>[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/* ─────────────────────────────────────────
   ElementRenderer
───────────────────────────────────────── */
function ElementRenderer({
  el,
  selected,
  editing,
  onPointerDown,
  onDoubleClick,
  onBlurText,
  onPointerDownHandle,
}: {
  el: PosterElement;
  selected: boolean;
  editing: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onDoubleClick: (id: string) => void;
  onBlurText: (id: string, text: string) => void;
  onPointerDownHandle: (e: React.PointerEvent, id: string, handle: Handle) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const wrapStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    height: `${el.h}%`,
    transform: `rotate(${el.rotation}deg)`,
    transformOrigin: 'center center',
    opacity: el.opacity,
    zIndex: el.zIndex,
    cursor: editing ? 'default' : 'move',
    boxSizing: 'border-box',
    outline: selected ? '2px solid #7c3aed' : 'none',
    outlineOffset: '1px',
  };

  const textContentStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      el.textAlign === 'left'
        ? 'flex-start'
        : el.textAlign === 'right'
        ? 'flex-end'
        : 'center',
    fontFamily: el.fontFamily ?? 'Arial',
    fontSize: el.fontSize ?? 18,
    fontWeight: el.bold ? 'bold' : 'normal',
    fontStyle: el.italic ? 'italic' : 'normal',
    color: el.color ?? '#111111',
    backgroundColor:
      !el.bgColor || el.bgColor === 'transparent' ? undefined : el.bgColor,
    textAlign: el.textAlign ?? 'center',
    padding: '2px 6px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    boxSizing: 'border-box',
    lineHeight: 1.3,
  };

  return (
    <div
      style={wrapStyle}
      onPointerDown={(e) => onPointerDown(e, el.id)}
      onDoubleClick={() => onDoubleClick(el.id)}
    >
      {/* Text content */}
      {el.kind === 'text' && !editing && (
        <div style={textContentStyle}>{el.text}</div>
      )}

      {/* Inline text editor */}
      {el.kind === 'text' && editing && (
        <textarea
          ref={textareaRef}
          defaultValue={el.text ?? ''}
          onBlur={(e) => onBlurText(el.id, e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'rgba(255,255,255,0.9)',
            fontFamily: el.fontFamily ?? 'Arial',
            fontSize: el.fontSize ?? 18,
            fontWeight: el.bold ? 'bold' : 'normal',
            fontStyle: el.italic ? 'italic' : 'normal',
            color: el.color ?? '#111111',
            textAlign: el.textAlign ?? 'center',
            padding: '2px 6px',
            boxSizing: 'border-box',
            lineHeight: 1.3,
          }}
        />
      )}

      {/* Image */}
      {el.kind === 'image' && el.src && (
        <img
          src={el.src}
          alt=""
          draggable={false}
          crossOrigin="anonymous"
          style={{
            width: '100%',
            height: '100%',
            objectFit: el.objectFit ?? 'cover',
            display: 'block',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Resize handles */}
      {selected &&
        RESIZE_HANDLES.map((h) => (
          <div
            key={h}
            onPointerDown={(e) => {
              e.stopPropagation();
              onPointerDownHandle(e, el.id, h);
            }}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              background: 'white',
              border: '2px solid #7c3aed',
              borderRadius: 2,
              zIndex: 100,
              boxSizing: 'border-box',
              ...HANDLE_STYLES[h],
            }}
          />
        ))}

      {/* Rotation handle */}
      {selected && (
        <>
          {/* Connector line */}
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: 'calc(50% - 0.5px)',
              width: 1,
              height: 20,
              background: '#7c3aed',
              pointerEvents: 'none',
            }}
          />
          {/* Circle handle */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              onPointerDownHandle(e, el.id, 'rotate');
            }}
            style={{
              position: 'absolute',
              zIndex: 100,
              ...HANDLE_STYLES['rotate'],
            }}
          />
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Tiny UI helpers
───────────────────────────────────────── */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function NumInput({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 w-5 shrink-0">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs focus:ring-1 focus:ring-violet-400 outline-none"
      />
    </label>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon} {label}
    </button>
  );
}

/* ─────────────────────────────────────────
   Main PosterEditorModal
───────────────────────────────────────── */
export default function PosterEditorModal({
  backgroundUrl,
  templateTitle,
  initialElements,
  onClose,
  onExport,
}: {
  backgroundUrl: string;
  templateTitle: string;
  initialElements: PosterElement[];
  onClose: () => void;
  onExport: (dataUrl: string) => void;
}) {
  const [elements, setElements] = useState<PosterElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const activeElIdRef = useRef<string | null>(null);
  // Always-current mirror of elements for synchronous reads in pointer handlers
  const elementsRef = useRef<PosterElement[]>(initialElements);
  // snapshot of elements at pointer-down (for move/resize calculations)
  const elSnapshotRef = useRef<Map<string, PosterElement>>(new Map());

  // Keep elementsRef in sync with elements state
  useEffect(() => { elementsRef.current = elements; }, [elements]);

  const selectedEl = elements.find((e) => e.id === selectedId) ?? null;

  /* ── Update helpers ── */
  const updateEl = useCallback((id: string, patch: Partial<PosterElement>) => {
    setElements((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }, []);

  const getCanvasRect = () =>
    canvasRef.current?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
      width: 1,
      height: 1,
    };

  /* ── Pointer down on element body → start move ── */
  const handlePointerDownEl = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      if (editingId === id) return;
      setSelectedId(id);
      setEditingId(null);
      activeElIdRef.current = id;

      // Snapshot current elements synchronously via ref
      const snap = new Map<string, PosterElement>();
      elementsRef.current.forEach((el) => snap.set(el.id, { ...el }));
      elSnapshotRef.current = snap;

      const el = snap.get(id);
      if (!el) return;
      interactionRef.current = {
        type: 'move',
        startX: e.clientX,
        startY: e.clientY,
        origX: el.x,
        origY: el.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [editingId]
  );

  /* ── Pointer down on resize/rotate handle ── */
  const handlePointerDownHandle = useCallback(
    (e: React.PointerEvent, id: string, handle: Handle) => {
      e.stopPropagation();
      activeElIdRef.current = id;

      // Snapshot current elements synchronously via ref
      const snap = new Map<string, PosterElement>();
      elementsRef.current.forEach((el) => snap.set(el.id, { ...el }));
      elSnapshotRef.current = snap;
      const el = snap.get(id);
      if (!el) return;

      if (handle === 'rotate') {
        const rect = getCanvasRect();
        const cx = rect.left + ((el.x + el.w / 2) * rect.width) / 100;
        const cy = rect.top + ((el.y + el.h / 2) * rect.height) / 100;
        const startAngle =
          (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
        interactionRef.current = {
          type: 'rotate',
          cx,
          cy,
          startAngle,
          origRotation: el.rotation,
        };
      } else {
        interactionRef.current = {
          type: 'resize',
          handle: handle as Exclude<Handle, 'rotate'>,
          startX: e.clientX,
          startY: e.clientY,
          orig: { ...el },
        };
      }
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  /* ── Pointer move (on the canvas wrapper) ── */
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const ix = interactionRef.current;
      const id = activeElIdRef.current;
      if (!ix || !id) return;

      const rect = getCanvasRect();

      if (ix.type === 'move') {
        const dx = ((e.clientX - ix.startX) / rect.width) * 100;
        const dy = ((e.clientY - ix.startY) / rect.height) * 100;
        const el = elSnapshotRef.current.get(id);
        if (!el) return;
        updateEl(id, {
          x: Math.max(0, Math.min(100 - el.w, ix.origX + dx)),
          y: Math.max(0, Math.min(100 - el.h, ix.origY + dy)),
        });
      } else if (ix.type === 'resize') {
        const dx = ((e.clientX - ix.startX) / rect.width) * 100;
        const dy = ((e.clientY - ix.startY) / rect.height) * 100;
        const o = ix.orig;
        let { x, y, w, h } = o;
        const h_str = ix.handle;
        if (h_str.includes('e')) w = Math.max(5, o.w + dx);
        if (h_str.includes('w')) {
          x = Math.min(o.x + o.w - 5, o.x + dx);
          w = Math.max(5, o.w - dx);
        }
        if (h_str.includes('s')) h = Math.max(5, o.h + dy);
        if (h_str.includes('n')) {
          y = Math.min(o.y + o.h - 5, o.y + dy);
          h = Math.max(5, o.h - dy);
        }
        updateEl(id, { x, y, w, h });
      } else if (ix.type === 'rotate') {
        const angle =
          (Math.atan2(e.clientY - ix.cy, e.clientX - ix.cx) * 180) / Math.PI;
        const newRot =
          ((ix.origRotation + (angle - ix.startAngle)) % 360 + 360) % 360;
        updateEl(id, { rotation: newRot });
      }
    },
    [updateEl]
  );

  const handlePointerUp = useCallback(() => {
    interactionRef.current = null;
  }, []);

  /* ── Add text ── */
  const addText = useCallback(() => {
    const el: PosterElement = {
      id: eid(),
      kind: 'text',
      x: 20,
      y: 40,
      w: 60,
      h: 14,
      rotation: 0,
      opacity: 1,
      zIndex: elements.length + 10,
      text: 'New Text',
      fontFamily: 'Arial',
      fontSize: 22,
      bold: false,
      italic: false,
      color: '#111111',
      textAlign: 'center',
      bgColor: 'transparent',
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  }, [elements.length]);

  /* ── Duplicate ── */
  const duplicate = useCallback(
    (id: string) => {
      const el = elements.find((e) => e.id === id);
      if (!el) return;
      const neo: PosterElement = {
        ...el,
        id: eid(),
        x: el.x + 3,
        y: el.y + 3,
        zIndex: el.zIndex + 1,
      };
      setElements((prev) => [...prev, neo]);
      setSelectedId(neo.id);
    },
    [elements]
  );

  /* ── Delete ── */
  const deleteEl = useCallback(
    (id: string) => {
      setElements((prev) => prev.filter((e) => e.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    []
  );

  /* ── Z-order ── */
  const bringForward = useCallback(
    (id: string) => {
      const el = elements.find((e) => e.id === id);
      if (el) updateEl(id, { zIndex: el.zIndex + 1 });
    },
    [elements, updateEl]
  );

  const sendBack = useCallback(
    (id: string) => {
      const el = elements.find((e) => e.id === id);
      if (el) updateEl(id, { zIndex: Math.max(0, el.zIndex - 1) });
    },
    [elements, updateEl]
  );

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingId) return;
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedId &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        deleteEl(selectedId);
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setEditingId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, editingId, deleteEl]);

  /* ── Export via html2canvas ── */
  const handleExport = async () => {
    if (!canvasRef.current || exporting) return;
    setSelectedId(null);
    setEditingId(null);
    setExporting(true);
    await new Promise((r) => setTimeout(r, 100)); // wait for deselect to re-render
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: '#ffffff',
      });
      const dataUrl = canvas.toDataURL('image/png');
      onExport(dataUrl);
    } catch (err) {
      console.error('PosterEditorModal: html2canvas export failed', err);
      alert('Export failed. See console for details.');
    } finally {
      setExporting(false);
    }
  };

  /* ─────────────── Properties Panel ─────────────── */
  const PropsPanel = () => {
    if (!selectedEl) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 text-sm p-6 gap-3">
          <Layers className="w-9 h-9 text-gray-300" />
          <p>Click an element on the canvas to select and edit it.</p>
          <button
            type="button"
            onClick={addText}
            className="mt-1 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100"
          >
            <Plus className="w-3.5 h-3.5" /> Add Text Element
          </button>
        </div>
      );
    }

    const id = selectedEl.id;

    return (
      <div className="overflow-y-auto h-full p-3 space-y-4 text-sm">
        {/* Position & Size */}
        <Section label="Position & Size">
          <div className="grid grid-cols-2 gap-2">
            <NumInput
              label="X"
              value={selectedEl.x}
              min={0}
              max={95}
              onChange={(v) => updateEl(id, { x: v })}
            />
            <NumInput
              label="Y"
              value={selectedEl.y}
              min={0}
              max={95}
              onChange={(v) => updateEl(id, { y: v })}
            />
            <NumInput
              label="W"
              value={selectedEl.w}
              min={5}
              max={100}
              onChange={(v) => updateEl(id, { w: v })}
            />
            <NumInput
              label="H"
              value={selectedEl.h}
              min={5}
              max={100}
              onChange={(v) => updateEl(id, { h: v })}
            />
          </div>
        </Section>

        {/* Rotation */}
        <Section label="Rotation">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={359}
              value={Math.round(selectedEl.rotation)}
              onChange={(e) => updateEl(id, { rotation: Number(e.target.value) })}
              className="flex-1 accent-violet-600"
            />
            <span className="text-xs text-gray-500 w-10 text-right">
              {Math.round(selectedEl.rotation)}°
            </span>
            <button
              type="button"
              title="Reset rotation"
              onClick={() => updateEl(id, { rotation: 0 })}
              className="text-gray-400 hover:text-gray-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </Section>

        {/* Opacity */}
        <Section label="Opacity">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(selectedEl.opacity * 100)}
              onChange={(e) =>
                updateEl(id, { opacity: Number(e.target.value) / 100 })
              }
              className="flex-1 accent-violet-600"
            />
            <span className="text-xs text-gray-500 w-10 text-right">
              {Math.round(selectedEl.opacity * 100)}%
            </span>
          </div>
        </Section>

        {/* ── Text-specific ── */}
        {selectedEl.kind === 'text' && (
          <>
            <Section label="Text Content">
              <textarea
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:ring-1 focus:ring-violet-400 resize-none outline-none"
                rows={3}
                value={selectedEl.text ?? ''}
                onChange={(e) => updateEl(id, { text: e.target.value })}
              />
            </Section>

            <Section label="Font">
              <select
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:ring-1 focus:ring-violet-400 mb-2 outline-none"
                value={selectedEl.fontFamily ?? 'Arial'}
                onChange={(e) => updateEl(id, { fontFamily: e.target.value })}
              >
                {FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <NumInput
                  label="px"
                  value={selectedEl.fontSize ?? 18}
                  min={6}
                  max={300}
                  onChange={(v) => updateEl(id, { fontSize: v })}
                />
                <button
                  type="button"
                  title="Bold"
                  onClick={() => updateEl(id, { bold: !selectedEl.bold })}
                  className={`p-1.5 rounded transition-colors ${
                    selectedEl.bold
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Italic"
                  onClick={() => updateEl(id, { italic: !selectedEl.italic })}
                  className={`p-1.5 rounded transition-colors ${
                    selectedEl.italic
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  <Italic className="w-4 h-4" />
                </button>
              </div>
            </Section>

            <Section label="Alignment">
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((align) => {
                  const Icon =
                    align === 'left'
                      ? AlignLeft
                      : align === 'center'
                      ? AlignCenter
                      : AlignRight;
                  return (
                    <button
                      type="button"
                      key={align}
                      onClick={() => updateEl(id, { textAlign: align })}
                      className={`flex-1 flex justify-center p-1.5 rounded transition-colors ${
                        selectedEl.textAlign === align
                          ? 'bg-violet-100 text-violet-700'
                          : 'text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section label="Colors">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Text color</p>
                  <input
                    type="color"
                    value={selectedEl.color ?? '#111111'}
                    onChange={(e) => updateEl(id, { color: e.target.value })}
                    className="w-full h-8 cursor-pointer rounded border border-gray-200"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Background</p>
                  <input
                    type="color"
                    value={
                      !selectedEl.bgColor ||
                      selectedEl.bgColor === 'transparent'
                        ? '#ffffff'
                        : selectedEl.bgColor
                    }
                    onChange={(e) => updateEl(id, { bgColor: e.target.value })}
                    className="w-full h-8 cursor-pointer rounded border border-gray-200"
                  />
                </div>
                <button
                  type="button"
                  title="Remove background"
                  onClick={() => updateEl(id, { bgColor: 'transparent' })}
                  className="text-xs text-gray-400 hover:text-red-500 mt-5"
                >
                  None
                </button>
              </div>
            </Section>
          </>
        )}

        {/* ── Image-specific ── */}
        {selectedEl.kind === 'image' && (
          <Section label="Image Fit">
            <div className="flex gap-1">
              {(['cover', 'contain', 'fill'] as const).map((fit) => (
                <button
                  type="button"
                  key={fit}
                  onClick={() => updateEl(id, { objectFit: fit })}
                  className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors ${
                    selectedEl.objectFit === fit
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {fit[0].toUpperCase() + fit.slice(1)}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Layer & Actions */}
        <Section label="Layer & Actions">
          <div className="flex gap-1 flex-wrap">
            <ActionBtn
              icon={<Copy className="w-3.5 h-3.5" />}
              label="Duplicate"
              onClick={() => duplicate(id)}
            />
            <ActionBtn
              icon={<Plus className="w-3.5 h-3.5" />}
              label="Forward"
              onClick={() => bringForward(id)}
            />
            <ActionBtn
              icon={<Minus className="w-3.5 h-3.5" />}
              label="Back"
              onClick={() => sendBack(id)}
            />
            <ActionBtn
              icon={<Trash2 className="w-3.5 h-3.5" />}
              label="Delete"
              onClick={() => deleteEl(id)}
              danger
            />
          </div>
        </Section>
      </div>
    );
  };

  /* ─────────────── Render ─────────────── */
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-800 border-b border-gray-700 shrink-0">
        <Type className="w-5 h-5 text-violet-400 shrink-0" />
        <span className="text-sm font-semibold text-white flex-1 truncate">
          IDCS Editor — {templateTitle}
        </span>
        <span className="text-xs text-gray-400 hidden sm:block">
          Add text/images on top · Double-click text to edit · Drag to move · Handles to resize/rotate
        </span>
        <button
          type="button"
          onClick={addText}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Text
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-500 disabled:opacity-60 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Exporting…' : 'Export as PNG'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white ml-1 shrink-0"
          title="Close editor"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div
          className="flex-1 overflow-auto bg-gray-700 flex items-center justify-center p-6"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => {
            setSelectedId(null);
            setEditingId(null);
          }}
        >
          {/* The actual canvas — width fixed at 560px, aspect 3:4 */}
          <div
            ref={canvasRef}
            className="relative bg-white shadow-2xl shrink-0 overflow-hidden"
            style={{
              width: 560,
              height: Math.round(560 * (4 / 3)),
              userSelect: 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Generated poster as background */}
            {backgroundUrl && (
              <img
                src={
                  backgroundUrl.startsWith('data:')
                    ? backgroundUrl
                    : `/api/canva/thumbnail-proxy/?url=${encodeURIComponent(backgroundUrl)}`
                }
                alt="generated poster"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                crossOrigin="anonymous"
                draggable={false}
              />
            )}

            {/* Elements */}
            {[...elements]
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((el) => (
                <ElementRenderer
                  key={el.id}
                  el={el}
                  selected={selectedId === el.id}
                  editing={editingId === el.id}
                  onPointerDown={handlePointerDownEl}
                  onDoubleClick={(id) => {
                    if (el.kind === 'text') setEditingId(id);
                  }}
                  onBlurText={(id, text) => {
                    updateEl(id, { text });
                    setEditingId(null);
                  }}
                  onPointerDownHandle={handlePointerDownHandle}
                />
              ))}
          </div>
        </div>

        {/* Properties panel */}
        <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {selectedEl
                ? selectedEl.kind === 'text'
                  ? 'Text Element'
                  : 'Image Element'
                : 'Properties'}
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <PropsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
