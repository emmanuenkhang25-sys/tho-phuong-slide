// Xuất PDF bằng cách render từng slide (SlideRenderer của nhóm editor)
// vào container ẩn → html2canvas → jsPDF.
// LƯU Ý: PDF xuất dưới dạng ẢNH từng trang (raster) — chữ tiếng Việt hiển thị
// chính xác, nhưng không chọn/copy được chữ trong PDF. (CONTRACT mục 7)
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { SlideRenderer } from '../../editor/components/SlideRenderer';
import type { Program, Slide } from '../../../lib/types';
import { layoutForRatio, PDF_RASTER_NOTE } from './units';

export { PDF_RASTER_NOTE };

function waitForPaint(): Promise<void> {
  return (async () => {
    try {
      await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    } catch {
      /* bỏ qua */
    }
    await new Promise<void>(resolve => window.setTimeout(resolve, 150));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  })();
}

export async function exportPDF(
  program: Program,
  slides: Slide[],
  onProgress?: (index: number, total: number) => void,
): Promise<Blob> {
  const ratio = program.aspect_ratio === '4:3' ? '4:3' : '16:9';
  const layout = layoutForRatio(ratio);
  const pxWidth = ratio === '16:9' ? 1280 : 960;
  const ordered = [...slides].sort((a, b) => a.order_index - b.order_index);

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: [layout.width, layout.height] });

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;overflow:hidden;pointer-events:none;';
  document.body.appendChild(host);

  try {
    for (let i = 0; i < ordered.length; i += 1) {
      onProgress?.(i, ordered.length);
      const mount = document.createElement('div');
      host.appendChild(mount);
      const root = createRoot(mount);
      root.render(createElement(SlideRenderer, { slide: ordered[i], width: pxWidth }));
      await waitForPaint();
      const canvas = await html2canvas(mount, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const img = canvas.toDataURL('image/png');
      if (i > 0) pdf.addPage([layout.width, layout.height], 'landscape');
      pdf.addImage(img, 'PNG', 0, 0, layout.width, layout.height, undefined, 'FAST');
      root.unmount();
      mount.remove();
    }
    onProgress?.(ordered.length, ordered.length);
    return pdf.output('blob');
  } finally {
    host.remove();
  }
}
