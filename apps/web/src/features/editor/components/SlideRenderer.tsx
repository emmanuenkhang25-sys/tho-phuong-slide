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
// ============================================================
import type { CSSProperties } from 'react';
import type { AspectRatio, Slide, SlideBackground, SlideObject } from '../../../lib/types';

export interface SlideRendererProps {
  slide: Slide;
  width: number;
  /** Tỉ lệ khung hình của chương trình. Mặc định '16:9'. */
  aspect?: AspectRatio;
  /** Tô nổi bật các object text điệp khúc (cờ chorus). Mặc định false. */
  highlightChorus?: boolean;
}

const BASE_W = 960; // fontSize trong SlideObject tính theo slide rộng 960px

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
}: {
  obj: SlideObject;
  scale: number;
  highlightChorus: boolean;
}) {
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
    return (
      <div
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

export function SlideRenderer({ slide, width, aspect = '16:9', highlightChorus = false }: SlideRendererProps) {
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
        <ObjectView key={o.id} obj={o} scale={scale} highlightChorus={highlightChorus} />
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
