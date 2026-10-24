// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// components/CanvasPanel.tsx — canvas chỉnh sửa ở giữa.
// Render SlideRenderer (thuần túy) + lớp tương tác phủ bên trên:
// click chọn object, kéo di chuyển, kéo góc resize, nhấp đúp sửa chữ.
// Hỗ trợ cảm ứng cơ bản (1 ngón tay kéo object).
// ============================================================
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AspectRatio, Slide, SlideObject } from '../../../lib/types';
import { SlideRenderer } from './SlideRenderer';
import { clamp } from '../lib/editorUtils';

export interface CanvasPanelProps {
  slide: Slide;
  aspect: AspectRatio;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onObjectsChange: (objects: SlideObject[]) => void;
}

const MIN_SIZE = 2; // % tối thiểu khi resize
type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

interface DragState {
  mode: 'move' | 'resize';
  handle?: Handle;
  startPct: { x: number; y: number };
  orig: Map<string, SlideObject>;
  movedIds: string[];
  resizeId?: string;
}

export function CanvasPanel({ slide, aspect, selectedIds, onSelect, onObjectsChange }: CanvasPanelProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(720);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const dragRef = useRef<DragState | null>(null);

  // Refs trỏ tới giá trị mới nhất cho window listeners (tránh stale closure)
  const objectsRef = useRef(slide.content.objects);
  objectsRef.current = slide.content.objects;
  const onObjectsChangeRef = useRef(onObjectsChange);
  onObjectsChangeRef.current = onObjectsChange;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setCanvasWidth(w);
    });
    ro.observe(el);
    setCanvasWidth(el.clientWidth || 720);
    return () => ro.disconnect();
  }, []);

  // Khi đổi slide đang sửa → thoát chế độ sửa chữ
  useEffect(() => {
    setEditingId(null);
    dragRef.current = null;
  }, [slide.id]);

  const canvasHeight = aspect === '16:9' ? (canvasWidth * 9) / 16 : (canvasWidth * 3) / 4;

  const toPercent = (clientX: number, clientY: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / canvasHeight) * 100,
    };
  };

  const hitTest = (px: number, py: number): SlideObject | null => {
    const objs = [...objectsRef.current].sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
    return objs.find((o) => px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h) ?? null;
  };

  const beginMove = (p: { x: number; y: number }, hit: SlideObject, additive: boolean) => {
    const sel = selectedRef.current;
    let ids: string[];
    if (additive) {
      ids = sel.includes(hit.id) ? sel.filter((id) => id !== hit.id) : [...sel, hit.id];
    } else {
      ids = sel.includes(hit.id) ? sel : [hit.id];
    }
    onSelectRef.current(ids);
    dragRef.current = {
      mode: 'move',
      startPct: p,
      orig: new Map(objectsRef.current.map((o) => [o.id, { ...o }])),
      movedIds: ids,
    };
  };

  const beginResize = (p: { x: number; y: number }, handle: Handle, objId: string) => {
    dragRef.current = {
      mode: 'resize',
      handle,
      startPct: p,
      orig: new Map(objectsRef.current.map((o) => [o.id, { ...o }])),
      movedIds: [],
      resizeId: objId,
    };
  };

  // ---- window listeners cho kéo (chuột + cảm ứng gom chung) ----
  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const h = aspect === '16:9' ? rect.width * 9 / 16 : rect.width * 3 / 4;
      const px = ((clientX - rect.left) / rect.width) * 100;
      const py = ((clientY - rect.top) / h) * 100;
      const dx = px - drag.startPct.x;
      const dy = py - drag.startPct.y;

      if (drag.mode === 'move') {
        const next = objectsRef.current.map((o) => {
          if (!drag.movedIds.includes(o.id)) return o;
          const orig = drag.orig.get(o.id)!;
          return {
            ...o,
            x: clamp(orig.x + dx, 0, 100 - orig.w),
            y: clamp(orig.y + dy, 0, 100 - orig.h),
          };
        });
        onObjectsChangeRef.current(next);
      } else if (drag.mode === 'resize' && drag.resizeId && drag.handle) {
        const orig = drag.orig.get(drag.resizeId);
        if (!orig) return;
        const hd = drag.handle;
        let { x, y, w, h: oh } = orig;
        if (hd.includes('e')) w = clamp(orig.w + dx, MIN_SIZE, 100 - orig.x);
        if (hd.includes('s')) oh = clamp(orig.h + dy, MIN_SIZE, 100 - orig.y);
        if (hd.includes('w')) {
          const nw = clamp(orig.w - dx, MIN_SIZE, orig.x + orig.w);
          x = orig.x + (orig.w - nw);
          w = nw;
        }
        if (hd.includes('n')) {
          const nh = clamp(orig.h - dy, MIN_SIZE, orig.y + orig.h);
          y = orig.y + (orig.h - nh);
          oh = nh;
        }
        const next = objectsRef.current.map((o) =>
          o.id === drag.resizeId ? { ...o, x, y, w, h: oh } : o,
        );
        onObjectsChangeRef.current(next);
      }
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
        if (dragRef.current) e.preventDefault();
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [aspect]);

  const commitEdit = () => {
    if (!editingId) return;
    const next = objectsRef.current.map((o) =>
      o.id === editingId ? { ...o, text: editValue } : o,
    );
    onObjectsChange(next);
    setEditingId(null);
  };

  const objects = slide.content.objects;
  const selected = objects.filter((o) => selectedIds.includes(o.id));
  const editingObj = editingId ? objects.find((o) => o.id === editingId) ?? null : null;

  const handles: { key: Handle; style: CSSProperties; cursor: string }[] = [
    { key: 'nw', style: { left: -7, top: -7 }, cursor: 'nwse-resize' },
    { key: 'ne', style: { right: -7, top: -7 }, cursor: 'nesw-resize' },
    { key: 'sw', style: { left: -7, bottom: -7 }, cursor: 'nesw-resize' },
    { key: 'se', style: { right: -7, bottom: -7 }, cursor: 'nwse-resize' },
    { key: 'n', style: { left: '50%', top: -7, marginLeft: -7 }, cursor: 'ns-resize' },
    { key: 's', style: { left: '50%', bottom: -7, marginLeft: -7 }, cursor: 'ns-resize' },
    { key: 'w', style: { left: -7, top: '50%', marginTop: -7 }, cursor: 'ew-resize' },
    { key: 'e', style: { right: -7, top: '50%', marginTop: -7 }, cursor: 'ew-resize' },
  ];

  return (
    <div className="flex h-full items-start justify-center overflow-auto p-4">
      <div
        ref={wrapRef}
        className="relative w-full max-w-[960px] shadow-2xl"
        style={{ touchAction: 'none' }}
      >
        {/* Lớp render thuần túy (không nhận sự kiện) */}
        <div style={{ pointerEvents: 'none' }}>
          <SlideRenderer slide={slide} width={canvasWidth} aspect={aspect} />
        </div>

        {/* Lớp tương tác phủ bên trên */}
        <div
          className="absolute inset-0"
          onMouseDown={(e) => {
            if (editingId) return;
            if (e.button !== 0) return;
            const p = toPercent(e.clientX, e.clientY);
            const hit = hitTest(p.x, p.y);
            if (!hit) {
              onSelect([]);
              return;
            }
            beginMove(p, hit, e.shiftKey);
          }}
          onTouchStart={(e) => {
            if (editingId || e.touches.length !== 1) return;
            const t = e.touches[0];
            const p = toPercent(t.clientX, t.clientY);
            const hit = hitTest(p.x, p.y);
            if (!hit) {
              onSelect([]);
              return;
            }
            beginMove(p, hit, false);
          }}
          onDoubleClick={(e) => {
            const p = toPercent(e.clientX, e.clientY);
            const hit = hitTest(p.x, p.y);
            if (hit && hit.type === 'text') {
              onSelect([hit.id]);
              setEditValue(hit.text ?? '');
              setEditingId(hit.id);
            }
          }}
        >
          {/* Khung chọn + tay nắm resize */}
          {selected.map((o) => (
            <div
              key={o.id}
              className="pointer-events-none absolute border-2 border-dashed border-sky-400"
              style={{
                left: `${o.x}%`,
                top: `${o.y}%`,
                width: `${o.w}%`,
                height: `${o.h}%`,
                zIndex: 100,
              }}
            >
              {selected.length === 1 &&
                handles.map((hd) => (
                  <span
                    key={hd.key}
                    className="pointer-events-auto absolute h-3.5 w-3.5 rounded-sm border border-sky-600 bg-white"
                    style={{ ...hd.style, cursor: hd.cursor, touchAction: 'none' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (e.button !== 0) return;
                      beginResize(toPercent(e.clientX, e.clientY), hd.key, o.id);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      if (e.touches.length !== 1) return;
                      const t = e.touches[0];
                      beginResize(toPercent(t.clientX, t.clientY), hd.key, o.id);
                    }}
                  />
                ))}
            </div>
          ))}
        </div>

        {/* Overlay sửa chữ trực tiếp */}
        {editingObj && (
          <textarea
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditingId(null);
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label="Sửa nội dung chữ"
            style={{
              position: 'absolute',
              left: `${editingObj.x}%`,
              top: `${editingObj.y}%`,
              width: `${editingObj.w}%`,
              height: `${Math.max(editingObj.h, 12)}%`,
              zIndex: 200,
              fontFamily: editingObj.fontFamily,
              fontSize: (editingObj.fontSize ?? 32) * (canvasWidth / 960),
              color: editingObj.color ?? '#fff',
              fontWeight: editingObj.bold ? 700 : 400,
              fontStyle: editingObj.italic ? 'italic' : 'normal',
              textAlign: editingObj.align ?? 'center',
              lineHeight: editingObj.lineHeight ?? 1.4,
              background: 'rgba(255,255,255,0.92)',
              border: '2px solid #38bdf8',
              borderRadius: 4,
              padding: 4,
              resize: 'none',
              whiteSpace: 'pre-wrap',
            }}
          />
        )}
      </div>
    </div>
  );
}
