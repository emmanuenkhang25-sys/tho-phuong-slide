// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// components/SlideRenderer.tsx — HỢP ĐỒNG LIÊN-NHÓM (CONTRACT mục 11).
//
//   export function SlideRenderer({ slide, width }: { slide: Slide; width: number })
//
// Render THUẦN TÚY một slide đúng tỉ lệ (không side-effect, không đọc
// editor state) để nhóm export dùng html2canvas chụp và nhóm presenter
// dùng trình chiếu. Nhóm khác CHỈ import, KHÔNG sửa file này.
//
// Lưu ý: Slide không mang aspect_ratio (nằm ở Program), nên nhận thêm
// prop tùy chọn `aspect` (mặc định '16:9'); signature bắt buộc giữ nguyên.
// Prop `highlightChorus` (mặc định false): khi true, object text có cờ
// `chorus: true` (do split.ts tạo) được tô nền vàng nhạt để phân biệt.
// Prop tùy chọn `textDrag`: khi có, object text trong slide nháp kéo được
// trực tiếp bằng tay (chạm vào chữ rồi di chuyển) — chỉ màn sửa mục dùng;
// các nơi khác không truyền prop này nên chữ không kéo được.
// ============================================================
import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { AspectRatio, Slide, SlideBackground, SlideObject } from '../../../lib/types';

/** Kéo chữ trực tiếp trong slide nháp: ghi vị trí + kích thước mới (%, đã ôm sát chữ). */
export interface TextDragHandlers {
  onTextMove: (objId: string, patch: { x: number; y: number; w: number; h: number }) => void;
}

export interface SlideRendererProps {
  slide: Slide;
  width: number;
  /** Tỉ lệ khung hình của chương trình. Mặc định '16:9'. */
  aspect?: AspectRatio;
  /** Tô nổi bật các object text điệp khúc (cờ chorus). Mặc định false. */
  highlightChorus?: boolean;
  /** Khi có, chữ trong slide kéo được trực tiếp bằng tay. Mặc định không kéo. */
  textDrag?: TextDragHandlers;
}

const BASE_W = 960; // fontSize trong SlideObject tính theo slide rộng 960px

/** Làm tròn 1 chữ số thập phân (tọa độ %). */
const round1 = (n: number) => Math.round(n * 10) / 10;

function backgroundStyle(bg: SlideBackground | undefined | null): CSSProperties {
  if (!bg) return { backgroundColor: '#000000' };
  if (bg.type === 'gradient' && bg.gradient) {
    const { from, to, angle } = bg.gradient;
    return { background: `linear-gradient(${angle ?? 135}deg, ${from}, ${to})` };
  }
  if (bg.type === 'image' && bg.image) {
    return {
      backgroundImage: `url("${bg.image}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#111827',
    };
  }
  return { backgroundColor: bg.color ?? '#000000' };
}

function ObjectView({
  obj,
  scale,
  highlightChorus,
  textDrag,
}: {
  obj: SlideObject;
  scale: number;
  highlightChorus: boolean;
  textDrag?: TextDragHandlers;
}) {
  // Trạng thái kéo của riêng object này (mỗi object một instance).
  const dragRef = useRef<{ grabX: number; grabY: number; w: number; h: number } | null>(null);

  const box: CSSProperties = {
    position: 'absolute',
    left: `${obj.x}%`,
    top: `${obj.y}%`,
    width: `${obj.w}%`,
    height: `${obj.h}%`,
    zIndex: obj.z ?? 0,
    opacity: obj.opacity ?? 1,
  };

  if (obj.type === 'text') {
    const isChorus = highlightChorus && (obj as SlideObject & { chorus?: boolean }).chorus === true;
    const draggable = !!textDrag && !!obj.text;

    /**
     * Đo khung ôm sát chữ thật (không phải khung box lưu sẵn): khung box có
     * thể to gần cả slide trong khi chữ chỉ có vài ký tự nằm trên cùng —
     * kéo cả khung đó thì chữ không bao giờ tới góc được. Dùng Range để lấy
     * rect từng dòng chữ hiển thị rồi hợp lại thành khung sát chữ.
     */
    const measureTight = (el: HTMLElement) => {
      const slideEl = el.parentElement;
      if (!slideEl) return null;
      const slideRect = slideEl.getBoundingClientRect();
      if (slideRect.width === 0 || slideRect.height === 0) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects());
      if (rects.length === 0) return null;
      let l = Infinity;
      let t = Infinity;
      let r = -Infinity;
      let b = -Infinity;
      for (const rc of rects) {
        l = Math.min(l, rc.left);
        t = Math.min(t, rc.top);
        r = Math.max(r, rc.right);
        b = Math.max(b, rc.bottom);
      }
      const w = Math.min(100, Math.max(0, ((r - l) / slideRect.width) * 100 + 0.2));
      const h = Math.min(100, Math.max(0, ((b - t) / slideRect.height) * 100 + 0.2));
      const x = Math.min(
        Math.max(0, ((l - slideRect.left) / slideRect.width) * 100),
        Math.max(0, 100 - w),
      );
      const y = Math.min(
        Math.max(0, ((t - slideRect.top) / slideRect.height) * 100),
        Math.max(0, 100 - h),
      );
      return { slideRect, x, y, w, h };
    };

    const onPointerDown = (e: ReactPointerEvent) => {
      if (!textDrag || !obj.text) return;
      const el = e.currentTarget as HTMLElement;
      const m = measureTight(el);
      if (!m) return;
      const px = ((e.clientX - m.slideRect.left) / m.slideRect.width) * 100;
      const py = ((e.clientY - m.slideRect.top) / m.slideRect.height) * 100;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* không bắt được pointer thì vẫn kéo chừng nào ngón tay còn trên chữ */
      }
      // Giữ nguyên khoảng cách ngón tay — mép khung sát chữ để chữ không nhảy.
      dragRef.current = { grabX: px - m.x, grabY: py - m.y, w: m.w, h: m.h };
    };
    const onPointerMove = (e: ReactPointerEvent) => {
      const st = dragRef.current;
      if (!st || !textDrag) return;
      const slideEl = (e.currentTarget as HTMLElement).parentElement;
      if (!slideEl) return;
      const slideRect = slideEl.getBoundingClientRect();
      const px = ((e.clientX - slideRect.left) / slideRect.width) * 100;
      const py = ((e.clientY - slideRect.top) / slideRect.height) * 100;
      const nx = Math.min(Math.max(0, px - st.grabX), Math.max(0, 100 - st.w));
      const ny = Math.min(Math.max(0, py - st.grabY), Math.max(0, 100 - st.h));
      textDrag.onTextMove(obj.id, { x: round1(nx), y: round1(ny), w: round1(st.w), h: round1(st.h) });
    };
    const onPointerEnd = () => {
      dragRef.current = null;
    };

    return (
      <div
        onPointerDown={draggable ? onPointerDown : undefined}
        onPointerMove={draggable ? onPointerMove : undefined}
        onPointerUp={draggable ? onPointerEnd : undefined}
        onPointerCancel={draggable ? onPointerEnd : undefined}
        style={{
          ...box,
          fontFamily: obj.fontFamily ?? 'Arial, sans-serif',
          fontSize: (obj.fontSize ?? 32) * scale,
          color: obj.color ?? '#ffffff',
          fontWeight: obj.bold ? 700 : 400,
          fontStyle: obj.italic ? 'italic' : 'normal',
          textAlign: obj.align ?? 'center',
          lineHeight: obj.lineHeight ?? 1.4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflow: 'hidden',
          touchAction: draggable ? 'none' : undefined,
          cursor: draggable ? 'grab' : undefined,
          ...(isChorus
            ? { backgroundColor: 'rgba(253, 230, 138, 0.14)', borderRadius: 4 * scale }
            : null),
        }}
      >
        {obj.text ?? ''}
      </div>
    );
  }

  if (obj.type === 'image') {
    return (
      <div style={box}>
        {obj.src ? (
          <img
            src={obj.src}
            alt=""
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
          />
        ) : null}
      </div>
    );
  }

  // video — phát trong trình chiếu, bấm để phát/dừng trong bản xem trước
  if (obj.type === 'video') {
    return (
      <div style={box}>
        {obj.src ? (
          <video
            src={obj.src}
            controls
            playsInline
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', backgroundColor: '#000000' }}
          />
        ) : null}
      </div>
    );
  }

  // shape
  if (obj.shape === 'line') {
    return (
      <div style={box}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke={obj.stroke ?? '#ffffff'}
            strokeWidth={Math.max(1, obj.strokeWidth ?? 3)}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }
  return (
    <div
      style={{
        ...box,
        backgroundColor: obj.fill ?? '#f59e0b',
        border: `${obj.strokeWidth ?? 0}px solid ${obj.stroke ?? 'transparent'}`,
        borderRadius: obj.shape === 'ellipse' ? '50%' : 0,
      }}
    />
  );
}

export function SlideRenderer({
  slide,
  width,
  aspect = '16:9',
  highlightChorus = false,
  textDrag,
}: SlideRendererProps) {
  const height = aspect === '16:9' ? (width * 9) / 16 : (width * 3) / 4;
  const scale = width / BASE_W;
  const objects = [...(slide.content?.objects ?? [])].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const bg = slide.background;

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        userSelect: 'none',
        ...backgroundStyle(bg),
      }}
    >
      {objects.map((o) => (
        <ObjectView key={o.id} obj={o} scale={scale} highlightChorus={highlightChorus} textDrag={textDrag} />
      ))}
      {bg?.overlayOpacity ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#000000',
            opacity: bg.overlayOpacity,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
}
