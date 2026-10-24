// Xuất PowerPoint (.pptx) bằng PptxGenJS — CONTRACT mục 7.
// - Layout: 16:9 → 10×5.625in, 4:3 → 10×7.5in
// - Textbox CHỈNH SỬA ĐƯỢC (addText, không phải ảnh)
// - Tọa độ % → inch; fontSize px(@960) → pt
import PptxGenJS from 'pptxgenjs';
import { supabase } from '../../../lib/supabase';
import type { Program, Section, Slide, SlideObject } from '../../../lib/types';
import { orderProgramSlides } from '../../../lib/slideOrder';
import { asPptxBlob, layoutForRatio, pctToIn, pxToPt, stripHash } from './units';

export interface PptxExportResult {
  blob: Blob;
  warnings: string[];
}

type PptxSlide = ReturnType<PptxGenJS['addSlide']>;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Không đọc được dữ liệu ảnh.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Ảnh trong slide lưu `src` là dataURL hoặc đường dẫn storage.
 * dataURL → dùng trực tiếp; storage path → thử tải qua bucket `program-images`;
 * URL http(s) → thử fetch. Thất bại → null (slide bỏ qua ảnh + ghi warning).
 */
async function resolveImageDataUrl(src: string, churchId?: string): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith('data:')) return src;
  if (churchId && !/^https?:\/\//i.test(src)) {
    try {
      const { data, error } = await supabase.storage.from('program-images').download(src);
      if (!error && data) return await blobToDataUrl(data);
    } catch {
      /* thử cách khác bên dưới */
    }
  }
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

async function applyBackground(
  slide: PptxSlide,
  data: Slide,
  layout: { width: number; height: number },
  warnings: string[],
  churchId?: string,
): Promise<void> {
  const bg = data.background ?? { type: 'color' as const };
  if (bg.type === 'color' || !bg.type) {
    slide.background = { color: stripHash(bg.color) ?? 'FFFFFF' };
    return;
  }
  if (bg.type === 'gradient') {
    // PptxGenJS không hỗ trợ gradient cho nền slide → giữ màu bắt đầu + ghi chú rõ.
    slide.background = { color: stripHash(bg.gradient?.from) ?? 'FFFFFF' };
    warnings.push('Nền chuyển màu (gradient): file PPTX chỉ giữ lại màu bắt đầu của gradient.');
    return;
  }
  if (bg.type === 'image' && bg.image) {
    const url = await resolveImageDataUrl(bg.image, churchId);
    if (url) {
      slide.addImage({ path: url, x: 0, y: 0, w: layout.width, h: layout.height });
      warnings.push('Ảnh nền được nhúng phủ kín slide — tỉ lệ co/kéo có thể hơi khác bản gốc.');
    } else {
      slide.background = { color: '1E3A5F' };
      warnings.push('Không tải được ảnh nền — đã thay bằng nền màu xanh đậm.');
    }
    return;
  }
  slide.background = { color: 'FFFFFF' };
}

function addShapeObject(
  pptx: PptxGenJS,
  slide: PptxSlide,
  obj: SlideObject,
  box: Box,
): void {
  const fill = stripHash(obj.fill);
  const stroke = stripHash(obj.stroke);
  const base = {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fill: fill ? { color: fill } : undefined,
    line: stroke ? { color: stroke, width: Math.max(0.5, (obj.strokeWidth ?? 1) * 0.75) } : undefined,
  };
  if (obj.shape === 'ellipse') {
    slide.addShape(pptx.ShapeType.ellipse, base);
  } else if (obj.shape === 'line') {
    slide.addShape(pptx.ShapeType.line, { ...base, line: { color: stroke ?? '000000', width: 1.5 } });
  } else {
    slide.addShape(pptx.ShapeType.rect, base);
  }
}

export async function exportPPTX(
  program: Program,
  sections: Section[],
  slides: Slide[],
): Promise<PptxExportResult> {
  // Thứ tự slide phải theo thứ tự MỤC rồi mới tới thứ tự slide trong mục
  // (order_index của slide chỉ có nghĩa trong từng mục — sắp riêng nó sẽ
  // làm các mục xen kẽ nhau).
  const ordered = orderProgramSlides(sections, slides);
  const warnings: string[] = [];
  const pptx = new PptxGenJS();
  pptx.title = program.title || 'Chương trình thờ phượng';
  pptx.author = 'Thờ Phượng Slide';

  const layout = layoutForRatio(program.aspect_ratio === '4:3' ? '4:3' : '16:9');
  pptx.defineLayout({ name: layout.name, width: layout.width, height: layout.height });
  pptx.layout = layout.name;

  let slideNo = 0;
  for (const data of ordered) {
    slideNo += 1;
    const slide = pptx.addSlide();
    await applyBackground(slide, data, layout, warnings, program.church_id);

    const objects = [...(data.content?.objects ?? [])].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    for (const obj of objects) {
      const box: Box = {
        x: pctToIn(obj.x, layout.width),
        y: pctToIn(obj.y, layout.height),
        w: pctToIn(obj.w, layout.width),
        h: pctToIn(obj.h, layout.height),
      };
      if (box.w <= 0 || box.h <= 0) continue;

      if (obj.type === 'text') {
        slide.addText(obj.text ?? '', {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          fontSize: pxToPt(obj.fontSize ?? 32),
          fontFace: obj.fontFamily || 'Arial',
          color: stripHash(obj.color) ?? '000000',
          bold: !!obj.bold,
          italic: !!obj.italic,
          align: obj.align ?? 'center',
          valign: 'middle',
          lineSpacingMultiple: obj.lineHeight ?? 1.2,
          fit: 'shrink',
          isTextBox: true, // textbox chỉnh sửa được
        });
      } else if (obj.type === 'shape') {
        addShapeObject(pptx, slide, obj, box);
      } else if (obj.type === 'image' && obj.src) {
        const url = await resolveImageDataUrl(obj.src, program.church_id);
        if (url) {
          slide.addImage({ path: url, x: box.x, y: box.y, w: box.w, h: box.h });
        } else {
          warnings.push(`Slide ${slideNo}: bỏ qua một ảnh vì không tải được dữ liệu ảnh.`);
        }
      }
    }
  }

  // PptxGenJS trả blob dạng application/zip — gói lại đúng MIME PowerPoint
  // để Android mở bằng app PowerPoint thay vì hiểu nhầm thành file nén.
  const blob = asPptxBlob((await pptx.write({ outputType: 'blob' })) as unknown as Blob);
  // Gộp warning trùng lặp để UI gọn.
  return { blob, warnings: [...new Set(warnings)] };
}
