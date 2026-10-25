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
import { memo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
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

/** Ngưỡng hút vào giữa slide khi kéo chữ (đơn vị %). */
const SNAP_PCT = 2;

/**
 * Đo độ rộng tự nhiên (không ngắt dòng) của dòng dài nhất trong text, bằng
 * canvas — dùng để khôi phục khung chữ đã bị thu hẹp bất thường (VD slide
 * "Nhạc dạo" bị ngắt thành "Nhạ / c / dạo"): khung kéo sẽ rộng lại bằng dòng
 * dài nhất để chữ không bao giờ phải ngắt giữa từ.
 */
let measureCtx: CanvasRenderingContext2D | null | undefined;
function naturalLineWidthPx(text: string, font: string): number {
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement('canvas').getContext('2d');
    } catch {
      measureCtx = null;
    }
  }
  if (!measureCtx) return 0;
  measureCtx.font = font;
  let max = 0;
  for (const seg of text.split('\n')) {
    if (!seg) continue;
    max = Math.max(max, measureCtx.measureText(seg).width);
  }
  return max;
}

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
  onDragGuide,
}: {
  obj: SlideObject;
  scale: number;
  highlightChorus: boolean;
  textDrag?: TextDragHandlers;
  /** Báo tâm khung chữ đang kéo (null = không kéo) để vẽ đường gióng giữa slide. */
  onDragGuide?: (g: { cx: number; cy: number } | null) => void;
}) {
  // Trạng thái kéo của riêng object này (mỗi object một instance). Chỉ dùng
  // cho tính toán — trong lúc kéo KHÔNG qua React state: vị trí đổi trực
  // tiếp trên DOM để không re-render cả trang mỗi lần di chuột; thả tay mới
  // commit một lần qua onTextMove (xem onPointerEnd).
  const dragRef = useRef<{
    grabX: number;
    grabY: number;
    w: number;
    h: number;
    /** Khoảng từ mép trên khung tới mép trên glyph (nửa giãn dòng đầu) — để hút giữa theo tâm glyph thật. */
    insetY: number;
    lastX: number;
    lastY: number;
  } | null>(null);

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
      // Khôi phục độ rộng tự nhiên: khung đang hẹp hơn dòng dài nhất (do kéo
      // trước đó hoặc đổi cỡ chữ) thì rộng lại bằng dòng dài nhất, neo theo
      // căn lề — chữ không còn bị ngắt giữa từ nữa.
      let nx = m.x;
      let nw = m.w;
      const font = `${obj.italic ? 'italic ' : ''}${obj.bold ? '700' : '400'} ${(obj.fontSize ?? 32) * scale}px ${obj.fontFamily ?? 'Arial, sans-serif'}`;
      const natPx = naturalLineWidthPx(obj.text, font);
      const natPct = natPx > 0 ? (natPx / m.slideRect.width) * 100 + 0.2 : 0;
      if (natPct > m.w) {
        nw = Math.min(100, natPct);
        const align = obj.align ?? 'center';
        if (align === 'left') nx = m.x;
        else if (align === 'right') nx = m.x + m.w - nw;
        else nx = m.x + m.w / 2 - nw / 2;
        nx = Math.min(Math.max(0, nx), Math.max(0, 100 - nw));
      }
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* không bắt được pointer thì vẫn kéo chừng nào ngón tay còn trên chữ */
      }
      // Giữ nguyên khoảng cách ngón tay — mép khung sát chữ để chữ không nhảy.
      // LƯU Ý: top khung giữ nguyên vị trí hiện tại (elTop), KHÔNG nhảy về m.y
      // (mép glyph): trước đây khung nhảy xuống một khoảng nửa giãn dòng mỗi lần
      // chạm, khiến tâm khung lệch khỏi tâm slide đúng khoảng đó khi chữ to.
      // grabY tính từ mép khung (elTop) để vị trí ngón tay khớp với khung thấy được;
      // insetY riêng để đường gióng/hút giữa vẫn tính theo tâm glyph thật.
      const elTop = Math.min(
        Math.max(0, ((el.getBoundingClientRect().top - m.slideRect.top) / m.slideRect.height) * 100),
        Math.max(0, 100 - m.h),
      );
      const insetY = Math.max(0, m.y - elTop);
      // Đổi trực tiếp trên DOM (không qua state) để kéo mượt, không re-render.
      el.style.left = `${nx}%`;
      el.style.top = `${elTop}%`;
      el.style.width = `${nw}%`;
      el.style.height = `${m.h}%`;
      dragRef.current = { grabX: px - nx, grabY: py - elTop, w: nw, h: m.h, insetY, lastX: nx, lastY: elTop };
      onDragGuide?.({ cx: nx + nw / 2, cy: elTop + insetY + m.h / 2 });
    };
    const onPointerMove = (e: ReactPointerEvent) => {
      const st = dragRef.current;
      if (!st || !textDrag) return;
      const slideEl = (e.currentTarget as HTMLElement).parentElement;
      if (!slideEl) return;
      const slideRect = slideEl.getBoundingClientRect();
      const px = ((e.clientX - slideRect.left) / slideRect.width) * 100;
      const py = ((e.clientY - slideRect.top) / slideRect.height) * 100;
      let nx = Math.min(Math.max(0, px - st.grabX), Math.max(0, 100 - st.w));
      // Kẹp theo hộp glyph thật (mép glyph không ra ngoài slide), không theo mép khung.
      let ny = Math.min(
        Math.max(-st.insetY, py - st.grabY),
        Math.max(-st.insetY, 100 - st.insetY - st.h),
      );
      // Hút vào chính giữa slide khi đã gần giữa — đường gióng sẽ đậm lên.
      // Tâm glyph thật = top khung + insetY + nửa chiều cao glyph.
      let cx = nx + st.w / 2;
      let cy = ny + st.insetY + st.h / 2;
      if (Math.abs(cx - 50) <= SNAP_PCT) {
        nx = 50 - st.w / 2;
        cx = 50;
      }
      if (Math.abs(cy - 50) <= SNAP_PCT) {
        ny = 50 - st.insetY - st.h / 2;
        cy = 50;
      }
      // Chỉ đổi DOM, không setState — thả tay mới lưu (onPointerEnd).
      const el = e.currentTarget as HTMLElement;
      el.style.left = `${nx}%`;
      el.style.top = `${ny}%`;
      st.lastX = nx;
      st.lastY = ny;
      onDragGuide?.({ cx, cy });
    };
    const onPointerEnd = () => {
      const st = dragRef.current;
      dragRef.current = null;
      onDragGuide?.(null);
      // Commit một lần duy nhất — đây mới là lần re-render duy nhất của cả
      // lần kéo (trước đây mỗi lần di chuột đều re-render toàn bộ trang).
      if (st && textDrag) {
        textDrag.onTextMove(obj.id, {
          x: round1(st.lastX),
          y: round1(st.lastY),
          w: round1(st.w),
          h: round1(st.h),
        });
      }
    };

    return (
      <div
        onPointerDown={draggable ? onPointerDown : undefined}
        onPointerMove={draggable ? onPointerMove : undefined}
        onPointerUp={draggable ? onPointerEnd : undefined}
        onPointerCancel={draggable ? onPointerEnd : undefined}
        style={{
          ...box,
          // Khung cao tự giãn theo chữ (giữ chiều cao cũ làm tối thiểu): chữ
          // phóng to chỉ cao thêm xuống dưới, không bao giờ bị cắt mất.
          height: 'auto',
          minHeight: box.height,
          fontFamily: obj.fontFamily ?? 'Arial, sans-serif',
          fontSize: (obj.fontSize ?? 32) * scale,
          color: obj.color ?? '#ffffff',
          fontWeight: obj.bold ? 700 : 400,
          fontStyle: obj.italic ? 'italic' : 'normal',
          textAlign: obj.align ?? 'center',
          lineHeight: obj.lineHeight ?? 1.4,
          whiteSpace: 'pre-wrap',
          // Chỉ ngắt dòng ở khoảng trắng — không ngắt giữa từ (VD "Nhạc dạo"
          // không còn thành "Nhạ / c / dạo"); chỉ từ đơn quá dài mới ngắt.
          wordBreak: 'normal',
          overflowWrap: 'break-word',
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

function SlideRendererInner({
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
  // Đường gióng đổi trực tiếp trên DOM (không qua state) để kéo không
  // re-render: hai div luôn nằm sẵn trong slide, ẩn/hiện bằng style.
  const guideVRef = useRef<HTMLDivElement>(null);
  const guideHRef = useRef<HTMLDivElement>(null);
  const setGuideDom = (g: { cx: number; cy: number } | null) => {
    const v = guideVRef.current;
    const h = guideHRef.current;
    if (!v || !h) return;
    if (!g) {
      v.style.display = 'none';
      h.style.display = 'none';
      return;
    }
    v.style.display = 'block';
    h.style.display = 'block';
    v.style.borderLeft =
      Math.abs(g.cx - 50) < 0.6 ? '2px solid #f472b6' : '1px dashed rgba(255,255,255,0.55)';
    h.style.borderTop =
      Math.abs(g.cy - 50) < 0.6 ? '2px solid #f472b6' : '1px dashed rgba(255,255,255,0.55)';
  };

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
        <ObjectView
          key={o.id}
          obj={o}
          scale={scale}
          highlightChorus={highlightChorus}
          textDrag={textDrag}
          onDragGuide={setGuideDom}
        />
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
      {/* Đường gióng giữa slide khi đang kéo chữ: nét đứt = chưa giữa, nét
          liền hồng = đã hút vào chính giữa (cân trên-dưới, trái-phải). */}
      <div
        ref={guideVRef}
        data-tps-guide="v"
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          display: 'none',
          borderLeft: '1px dashed rgba(255,255,255,0.55)',
          pointerEvents: 'none',
          zIndex: 999,
        }}
      />
      <div
        ref={guideHRef}
        data-tps-guide="h"
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          display: 'none',
          borderTop: '1px dashed rgba(255,255,255,0.55)',
          pointerEvents: 'none',
          zIndex: 999,
        }}
      />
    </div>
  );
}

/**
 * Memo: một slide chỉ vẽ lại khi đúng slide đó đổi (props đổi). Nhờ vậy đổi
 * cỡ/màu/kéo một slide không bắt cả 21 slide vẽ lại theo.
 */
export const SlideRenderer = memo(SlideRendererInner);
