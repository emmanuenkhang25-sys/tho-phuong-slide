// Helpers thuần cho export — không phụ thuộc DOM, test được bằng node.

export interface SlideLayout {
  name: string;
  width: number; // inch
  height: number; // inch
}

/** Layout PPTX/PDF theo tỉ lệ khung hình (CONTRACT mục 7). */
export function layoutForRatio(aspect: string): SlideLayout {
  if (aspect === '4:3') return { name: 'TPS_43', width: 10, height: 7.5 };
  return { name: 'WIDESCREEN', width: 10, height: 5.625 };
}

/** % (0–100) → inch trên khổ slide. */
export function pctToIn(pct: number, totalIn: number): number {
  if (!Number.isFinite(pct)) return 0;
  return (pct / 100) * totalIn;
}

/** px (thiết kế ở slide 960px) → pt cho PowerPoint. */
export function pxToPt(px: number): number {
  if (!Number.isFinite(px) || px <= 0) return 24;
  return (px * 72) / 96;
}

/** '#1e3a5f' → '1E3A5F' (định dạng màu PptxGenJS). Trả về undefined nếu không hợp lệ. */
export function stripHash(color?: string | null): string | undefined {
  if (!color) return undefined;
  let c = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(c)) c = c.split('').map(ch => ch + ch).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return undefined;
  return c.toUpperCase();
}

/** Tên file an toàn: bỏ dấu tiếng Việt, chỉ giữ a-z0-9 và gạch ngang. */
export function sanitizeFilename(name: string): string {
  const slug = (name || 'chuong-trinh')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'chuong-trinh';
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** 'bai-giang-20261024-1930.pptx'. */
export function exportFilename(title: string, ext: string): string {
  const d = new Date();
  const stamp =
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  return `${sanitizeFilename(title)}-${stamp}.${ext}`;
}

/** Tải Blob về máy (chạy trên browser). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Thông báo hiển thị trong UI mỗi khi xuất PDF (CONTRACT mục 7). */
export const PDF_RASTER_NOTE =
  'PDF được xuất dưới dạng ảnh từng trang (raster) — chữ tiếng Việt hiển thị chính xác, nhưng không chọn/copy được chữ trong PDF.';

/** '1.5 MB' — hiển thị dung lượng thân thiện. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
