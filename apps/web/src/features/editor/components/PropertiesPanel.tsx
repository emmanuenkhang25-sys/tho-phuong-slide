// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// components/PropertiesPanel.tsx — cột thuộc tính bên phải:
// chữ / hình khối / nền slide / lớp / căn chỉnh.
// ============================================================
import type { SlideBackground, SlideObject } from '../../../lib/types';

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'middle' | 'bottom';
export type LayerDir = 'up' | 'down' | 'top' | 'bottom';

export interface PropertiesPanelProps {
  selected: SlideObject[];
  background: SlideBackground;
  onPatchObjects: (patch: Partial<SlideObject>) => void;
  onPatchBackground: (patch: Partial<SlideBackground>) => void;
  onDeleteObjects: () => void;
  onMoveLayer: (dir: LayerDir) => void;
  onAlign: (mode: AlignMode) => void;
  onUploadBackgroundImage: (file: File) => void;
  onRemoveBackgroundImage: () => void;
}

const row = 'flex items-center gap-2 py-1';
const label = 'w-20 shrink-0 text-xs text-slate-500 dark:text-slate-400';
const input =
  'min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 min-h-[36px]';
const miniBtn =
  'inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-40';
const activeBtn = ' !border-sky-500 !bg-sky-100 dark:!bg-sky-900';
const sectionTitle = 'mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-slate-400 first:mt-0';

const FONT_FAMILIES = [
  'Arial, sans-serif',
  "'Times New Roman', serif",
  "'Be Vietnam Pro', Arial, sans-serif",
  'Georgia, serif',
  "'Courier New', monospace",
];

export function PropertiesPanel(p: PropertiesPanelProps) {
  const first = p.selected[0];
  const hasText = p.selected.some((o) => o.type === 'text');
  const hasShape = p.selected.some((o) => o.type === 'shape');
  const bg = p.background;

  const num = (v: number | undefined, fb: number) => (typeof v === 'number' ? v : fb);

  return (
    <div className="h-full overflow-y-auto p-3 text-sm">
      {p.selected.length === 0 && (
        <p className="text-xs text-slate-400">
          Chọn một đối tượng trên slide để chỉnh thuộc tính.<br />
          Nhấp đúp vào hộp chữ để sửa nội dung trực tiếp.
        </p>
      )}

      {p.selected.length > 0 && (
        <>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Đang chọn {p.selected.length} đối tượng
          </p>

          {hasText && (
            <>
              <h4 className={sectionTitle}>Chữ</h4>
              <div className={row}>
                <span className={label}>Phông</span>
                <select
                  className={input}
                  value={first.fontFamily ?? FONT_FAMILIES[0]}
                  onChange={(e) => p.onPatchObjects({ fontFamily: e.target.value })}
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f} value={f}>{f.split(',')[0].replace(/'/g, '')}</option>
                  ))}
                </select>
              </div>
              <div className={row}>
                <span className={label}>Cỡ chữ</span>
                <input
                  type="number" min={8} max={200} className={input}
                  value={num(first.fontSize, 32)}
                  onChange={(e) => p.onPatchObjects({ fontSize: Math.max(8, Number(e.target.value) || 8) })}
                />
                <input
                  type="color" className="h-9 w-11 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                  value={first.color ?? '#ffffff'}
                  onChange={(e) => p.onPatchObjects({ color: e.target.value })}
                  title="Màu chữ"
                />
              </div>
              <div className={row}>
                <span className={label}>Kiểu</span>
                <button className={miniBtn + (first.bold ? activeBtn : '')} title="Đậm" onClick={() => p.onPatchObjects({ bold: !first.bold })}><b>B</b></button>
                <button className={miniBtn + (first.italic ? activeBtn : '')} title="Nghiêng" onClick={() => p.onPatchObjects({ italic: !first.italic })}><i>I</i></button>
              </div>
              <div className={row}>
                <span className={label}>Căn lề</span>
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    className={miniBtn + (first.align === a ? activeBtn : '')}
                    title={a === 'left' ? 'Căn trái' : a === 'center' ? 'Căn giữa' : 'Căn phải'}
                    onClick={() => p.onPatchObjects({ align: a })}
                  >
                    {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
                  </button>
                ))}
              </div>
              <div className={row}>
                <span className={label}>Giãn dòng</span>
                <input
                  type="number" min={1} max={3} step={0.1} className={input}
                  value={num(first.lineHeight, 1.4)}
                  onChange={(e) => p.onPatchObjects({ lineHeight: Number(e.target.value) || 1.4 })}
                />
              </div>
            </>
          )}

          {hasShape && (
            <>
              <h4 className={sectionTitle}>Hình khối</h4>
              <div className={row}>
                <span className={label}>Màu nền</span>
                <input
                  type="color" className="h-9 w-11 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                  value={first.fill ?? '#f59e0b'}
                  onChange={(e) => p.onPatchObjects({ fill: e.target.value })}
                />
                <span className={label}>Viền</span>
                <input
                  type="color" className="h-9 w-11 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                  value={first.stroke ?? '#ffffff'}
                  onChange={(e) => p.onPatchObjects({ stroke: e.target.value })}
                />
              </div>
              <div className={row}>
                <span className={label}>Độ dày viền</span>
                <input
                  type="number" min={0} max={20} className={input}
                  value={num(first.strokeWidth, 2)}
                  onChange={(e) => p.onPatchObjects({ strokeWidth: Math.max(0, Number(e.target.value) || 0) })}
                />
              </div>
              <div className={row}>
                <span className={label}>Độ mờ</span>
                <input
                  type="range" min={0.1} max={1} step={0.05} className="flex-1"
                  value={num(first.opacity, 1)}
                  onChange={(e) => p.onPatchObjects({ opacity: Number(e.target.value) })}
                />
                <span className="w-10 text-right text-xs">{Math.round(num(first.opacity, 1) * 100)}%</span>
              </div>
            </>
          )}

          <h4 className={sectionTitle}>Lớp</h4>
          <div className={row}>
            <button className={miniBtn} title="Đưa lên trên cùng" onClick={() => p.onMoveLayer('top')}>⤒</button>
            <button className={miniBtn} title="Lên một lớp" onClick={() => p.onMoveLayer('up')}>↑</button>
            <button className={miniBtn} title="Xuống một lớp" onClick={() => p.onMoveLayer('down')}>↓</button>
            <button className={miniBtn} title="Đưa xuống dưới cùng" onClick={() => p.onMoveLayer('bottom')}>⤓</button>
            <button className={miniBtn + ' ml-auto !text-red-600'} title="Xóa đối tượng (Delete)" onClick={p.onDeleteObjects}>🗑 Xóa</button>
          </div>

          <h4 className={sectionTitle}>Căn chỉnh (trong slide)</h4>
          <div className={row}>
            <button className={miniBtn} title="Căn trái" onClick={() => p.onAlign('left')}>⇤</button>
            <button className={miniBtn} title="Căn giữa ngang" onClick={() => p.onAlign('centerX')}>⇔</button>
            <button className={miniBtn} title="Căn phải" onClick={() => p.onAlign('right')}>⇥</button>
            <button className={miniBtn} title="Căn trên" onClick={() => p.onAlign('top')}>⇧</button>
            <button className={miniBtn} title="Căn giữa dọc" onClick={() => p.onAlign('middle')}>⇕</button>
            <button className={miniBtn} title="Căn dưới" onClick={() => p.onAlign('bottom')}>⇩</button>
          </div>
        </>
      )}

      <h4 className={sectionTitle}>Nền slide</h4>
      <div className={row}>
        <span className={label}>Kiểu nền</span>
        <select
          className={input}
          value={bg.type}
          onChange={(e) => p.onPatchBackground({ type: e.target.value as SlideBackground['type'] })}
        >
          <option value="color">Màu đơn</option>
          <option value="gradient">Chuyển sắc</option>
          <option value="image">Ảnh nền</option>
        </select>
      </div>
      {bg.type === 'color' && (
        <div className={row}>
          <span className={label}>Màu</span>
          <input
            type="color" className="h-9 w-11 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
            value={bg.color ?? '#1e3a5f'}
            onChange={(e) => p.onPatchBackground({ color: e.target.value })}
          />
          <span className="text-xs text-slate-500">{bg.color ?? '#1e3a5f'}</span>
        </div>
      )}
      {bg.type === 'gradient' && (
        <>
          <div className={row}>
            <span className={label}>Từ</span>
            <input
              type="color" className="h-9 w-11 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
              value={bg.gradient?.from ?? '#1e3a5f'}
              onChange={(e) => p.onPatchBackground({ gradient: { from: e.target.value, to: bg.gradient?.to ?? '#0f172a', angle: bg.gradient?.angle ?? 135 } })}
            />
            <span className={label}>Đến</span>
            <input
              type="color" className="h-9 w-11 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
              value={bg.gradient?.to ?? '#0f172a'}
              onChange={(e) => p.onPatchBackground({ gradient: { from: bg.gradient?.from ?? '#1e3a5f', to: e.target.value, angle: bg.gradient?.angle ?? 135 } })}
            />
          </div>
          <div className={row}>
            <span className={label}>Góc</span>
            <input
              type="number" min={0} max={360} className={input}
              value={bg.gradient?.angle ?? 135}
              onChange={(e) => p.onPatchBackground({ gradient: { from: bg.gradient?.from ?? '#1e3a5f', to: bg.gradient?.to ?? '#0f172a', angle: Number(e.target.value) || 0 } })}
            />
          </div>
        </>
      )}
      {bg.type === 'image' && (
        <div className={row}>
          <label className={miniBtn + ' cursor-pointer'}>
            🖼 Chọn ảnh nền
            <input
              type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) p.onUploadBackgroundImage(f);
                e.target.value = '';
              }}
            />
          </label>
          {bg.image && (
            <button className={miniBtn} onClick={p.onRemoveBackgroundImage}>✕ Gỡ ảnh</button>
          )}
        </div>
      )}
      <div className={row}>
        <span className={label}>Lớp phủ tối</span>
        <input
          type="range" min={0} max={0.8} step={0.05} className="flex-1"
          value={bg.overlayOpacity ?? 0}
          onChange={(e) => p.onPatchBackground({ overlayOpacity: Number(e.target.value) })}
          title="Lớp phủ tối giúp chữ dễ đọc trên nền sáng"
        />
        <span className="w-10 text-right text-xs">{Math.round((bg.overlayOpacity ?? 0) * 100)}%</span>
      </div>
    </div>
  );
}
