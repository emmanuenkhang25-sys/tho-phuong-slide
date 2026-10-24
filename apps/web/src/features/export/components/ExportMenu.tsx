// Nút "Xuất" + menu: PowerPoint (.pptx) / PDF / Sao lưu JSON.
// CONTRACT mục 11 — nhóm editor gắn component này vào toolbar.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Modal, Spinner } from '../../../components/ui';
import type { Program, Section, Slide } from '../../../lib/types';
import { exportPPTX } from '../lib/pptx';
import { exportPDF, PDF_RASTER_NOTE } from '../lib/pdf';
import { downloadBackupJSON } from '../lib/backup';
import { downloadBlob, exportFilename } from '../lib/units';

type BusyKind = 'pptx' | 'pdf' | 'json' | null;

/** Ghi nhật ký xuất file — best effort, không chặn việc tải file khi lỗi. */
async function logExport(program: Program, kind: 'pptx' | 'pdf' | 'json'): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('audit_logs').insert({
      church_id: program.church_id,
      actor_id: user.id,
      action: 'program.export',
      entity: 'program',
      entity_id: program.id,
      detail: { kind, title: program.title },
    });
  } catch {
    /* bỏ qua */
  }
}

export function ExportMenu({
  program,
  sections,
  slides,
}: {
  program: Program;
  sections: Section[];
  slides: Slide[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open ]);

  const hasSlides = slides.length > 0;

  async function run(kind: 'pptx' | 'pdf' | 'json') {
    setBusy(kind);
    setError(null);
    setWarnings(null);
    setProgress(null);
    try {
      if (kind === 'pptx') {
        setProgress('Đang tạo file PowerPoint…');
        const result = await exportPPTX(program, sections, slides);
        downloadBlob(result.blob, exportFilename(program.title, 'pptx'));
        if (result.warnings.length > 0) setWarnings(result.warnings);
      } else if (kind === 'pdf') {
        const blob = await exportPDF(program, slides, (i, n) =>
          setProgress(`Đang xuất PDF — trang ${i + 1}/${n}…`),
        );
        downloadBlob(blob, exportFilename(program.title, 'pdf'));
      } else {
        setProgress('Đang tạo bản sao lưu…');
        downloadBackupJSON(program, sections, slides);
      }
      void logExport(program, kind);
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định.';
      setError(`Xuất thất bại: ${msg}`);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const itemCls =
    'flex w-full flex-col items-start gap-1 rounded-lg px-4 py-3 text-left hover:bg-slate-100 ' +
    'disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800';

  return (
    <div ref={wrapRef} className="relative inline-block">
      <Button onClick={() => setOpen(o => !o)} disabled={busy !== null} aria-haspopup="menu" aria-expanded={open}>
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Spinner /> Đang xuất…
          </span>
        ) : (
          '⬇ Xuất'
        )}
      </Button>

      {open && busy === null && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <button type="button" role="menuitem" className={itemCls} disabled={!hasSlides} onClick={() => void run('pptx')}>
            <span className="font-semibold">📊 Tải PowerPoint (.pptx)</span>
            <span className="text-xs text-slate-500">
              Chữ trong khung vẫn chỉnh sửa được. Giữ thứ tự slide, nội dung và màu nền.
            </span>
          </button>
          <button type="button" role="menuitem" className={itemCls} disabled={!hasSlides} onClick={() => void run('pdf')}>
            <span className="font-semibold">🖨️ Tải PDF</span>
            <span className="text-xs text-slate-500">Ảnh từng trang — chữ tiếng Việt luôn hiển thị đúng.</span>
          </button>
          <button type="button" role="menuitem" className={itemCls} onClick={() => void run('json')}>
            <span className="font-semibold">💾 Sao lưu JSON</span>
            <span className="text-xs text-slate-500">Đầy đủ dữ liệu để khôi phục sau này (.tpsbackup.json).</span>
          </button>
          {!hasSlides && (
            <p className="px-4 py-2 text-xs text-amber-600">
              Chương trình chưa có slide nào — hãy thêm slide trước khi xuất PPTX/PDF.
            </p>
          )}
          <p className="border-t border-slate-200 px-4 pb-1 pt-2 text-[11px] leading-snug text-slate-500 dark:border-slate-700">
            {PDF_RASTER_NOTE}
          </p>
        </div>
      )}

      {progress && <p className="mt-1 text-xs text-slate-500">{progress}</p>}
      {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}

      <Modal open={warnings !== null} onClose={() => setWarnings(null)} title="Xuất xong — một số lưu ý">
        <p className="mb-2 text-sm">
          File đã được tạo, nhưng có vài điểm khác biệt so với bản trên web do giới hạn của định dạng PPTX:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {(warnings ?? []).map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
        <div className="mt-4 text-right">
          <Button onClick={() => setWarnings(null)}>Đã hiểu</Button>
        </div>
      </Modal>
    </div>
  );
}
