// Trang Sao lưu & khôi phục (/sao-luu) — quyền editor+.
// - Tải / nhập bản sao lưu JSON (ghi đè có xác nhận, snapshot trước)
// - Lịch sử phiên bản: xem trước, khôi phục (snapshot trước)
// - Đồng bộ ngay + xử lý xung đột
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useChurch } from '../../stores/church';
import { hasRole } from '../../lib/permissions';
import { Button, ConfirmDialog, Input, Modal, Select, Spinner } from '../../components/ui';
import { SlideRenderer } from '../editor/components/SlideRenderer';
import { syncNow, resolveConflict, type SyncConflict, type SyncResult } from './sync';
import {
  downloadBackupJSON,
  parseBackupFile,
  type BackupAssetManifest,
  type ParsedBackup,
} from '../export/lib/backup';
import type { Program, Section, Slide } from '../../lib/types';

interface ProgramVersion {
  id: string;
  program_id: string;
  snapshot: { program?: Program; sections?: Section[]; slides?: Slide[] };
  created_by: string | null;
  note: string | null;
  created_at: string;
  creator_name?: string;
}

interface Msg {
  type: 'ok' | 'error';
  text: string;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { hour12: false });
  } catch {
    return iso;
  }
}

export function BackupPage() {
  const { currentChurch, myRole } = useChurch();
  const canManage = hasRole(myRole ?? 'viewer', 'editor');
  const canDelete = hasRole(myRole ?? 'viewer', 'admin'); // xóa sections/slides cần admin+ (RLS)

  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState('');
  const [program, setProgram] = useState<Program | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [assetsManifest, setAssetsManifest] = useState<BackupAssetManifest[]>([]);
  const [versions, setVersions] = useState<ProgramVersion[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);

  const [pendingImport, setPendingImport] = useState<ParsedBackup | null>(null);
  const [previewVersion, setPreviewVersion] = useState<ProgramVersion | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ProgramVersion | null>(null);

  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // ---- tải danh sách chương trình ----
  useEffect(() => {
    if (!currentChurch) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('programs')
        .select('*')
        .eq('church_id', currentChurch.id)
        .neq('status', 'deleted')
        .order('updated_at', { ascending: false });
      const list = (data ?? []) as Program[];
      setPrograms(list);
      if (list.length > 0 && !programId) setProgramId(list[0].id);
      setLoading(false);
    })();
  }, [currentChurch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData(pid: string) {
    setBusy('load');
    try {
      const { data: p } = await supabase.from('programs').select('*').eq('id', pid).single();
      const { data: secs } = await supabase.from('sections').select('*').eq('program_id', pid).order('order_index');
      const { data: slds } = await supabase.from('slides').select('*').eq('program_id', pid).order('order_index');
      const { data: assets } = await supabase.from('program_assets').select('file_path, program_id').eq('program_id', pid);
      setProgram((p ?? null) as Program | null);
      setSections((secs ?? []) as Section[]);
      setSlides((slds ?? []) as Slide[]);
      setAssetsManifest(
        ((assets ?? []) as { file_path: string; program_id: string | null }[]).map(a => ({
          path: a.file_path,
          programId: a.program_id,
        })),
      );
      await loadVersions(pid);
    } finally {
      setBusy(null);
    }
  }

  async function loadVersions(pid: string) {
    const { data } = await supabase
      .from('program_versions')
      .select('*')
      .eq('program_id', pid)
      .order('created_at', { ascending: false })
      .limit(30);
    const list = (data ?? []) as ProgramVersion[];
    // Tên người tạo (best effort — RLS có thể chặn)
    try {
      const ids = [...new Set(list.map(v => v.created_by).filter(Boolean))] as string[];
      if (ids.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', ids);
        const map = new Map(((profs ?? []) as { id: string; display_name: string | null; email: string }[]).map(p => [p.id, p.display_name || p.email]));
        list.forEach(v => {
          v.creator_name = (v.created_by && map.get(v.created_by)) || '—';
        });
      }
    } catch {
      /* bỏ qua */
    }
    setVersions(list);
  }

  useEffect(() => {
    if (programId) void loadData(programId);
  }, [programId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- snapshot phiên bản dự phòng ----
  async function saveVersion(note: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !program) return;
    const { error } = await supabase.from('program_versions').insert({
      program_id: program.id,
      snapshot: { program, sections, slides },
      created_by: user.id,
      note,
    });
    if (error) throw new Error('Không lưu được phiên bản dự phòng: ' + error.message);
  }

  // ---- ghi dữ liệu (upsert + dọn phần thừa) ----
  async function cleanupExtras(pid: string, keepSections: Set<string>, keepSlides: Set<string>) {
    // RLS: xóa sections/slides cần quyền admin+ — editor chỉ upsert.
    if (!canDelete) return;
    const { data: curSecs } = await supabase.from('sections').select('id').eq('program_id', pid);
    const { data: curSlds } = await supabase.from('slides').select('id').eq('program_id', pid);
    for (const row of (curSlds ?? []) as { id: string }[]) {
      if (!keepSlides.has(row.id)) await supabase.from('slides').delete().eq('id', row.id);
    }
    for (const row of (curSecs ?? []) as { id: string }[]) {
      if (!keepSections.has(row.id)) await supabase.from('sections').delete().eq('id', row.id);
    }
  }

  async function upsertSnapshot(pid: string, snap: { program: Program; sections: Section[]; slides: Slide[] }, userId: string) {
    const now = new Date().toISOString();
    const { error: e1 } = await supabase.from('programs').upsert({
      ...snap.program,
      id: pid,
      church_id: currentChurch!.id,
      updated_by: userId,
      updated_at: now,
    });
    if (e1) throw new Error('Không ghi được chương trình: ' + e1.message);
    const secs = snap.sections.map(s => ({ ...s, program_id: pid }));
    const slds = snap.slides.map(s => ({ ...s, program_id: pid }));
    if (secs.length > 0) {
      const { error } = await supabase.from('sections').upsert(secs);
      if (error) throw new Error('Không ghi được các mục: ' + error.message);
    }
    if (slds.length > 0) {
      const { error } = await supabase.from('slides').upsert(slds);
      if (error) throw new Error('Không ghi được các slide: ' + error.message);
    }
    await cleanupExtras(pid, new Set(secs.map(s => s.id)), new Set(slds.map(s => s.id)));
  }

  // ---- nhập file sao lưu ----
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    parseBackupFile(f)
      .then(setPendingImport)
      .catch(err => setMsg({ type: 'error', text: err instanceof Error ? err.message : 'File không hợp lệ.' }));
  }

  async function doImport() {
    if (!pendingImport || !currentChurch) return;
    const imp = pendingImport;
    setBusy('import');
    setMsg(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Bạn cần đăng nhập để nhập bản sao lưu.');
      if (program) await saveVersion('Tự động lưu trước khi nhập bản sao lưu JSON');

      let targetId: string;
      if (imp.program.church_id === currentChurch.id) {
        // Cùng hội thánh → ghi đè đúng chương trình đó (upsert theo id gốc).
        targetId = imp.program.id;
        await upsertSnapshot(targetId, imp, user.id);
        if (!programs.some(p => p.id === targetId)) {
          const { data } = await supabase.from('programs').select('*').eq('id', targetId).single();
          if (data) setPrograms(prev => [data as Program, ...prev]);
        }
      } else {
        // Khác hội thánh → tạo chương trình MỚI trong hội thánh hiện tại, ánh xạ id mới.
        targetId = crypto.randomUUID();
        const now = new Date().toISOString();
        const { error: e1 } = await supabase.from('programs').insert({
          ...imp.program,
          id: targetId,
          church_id: currentChurch.id,
          created_by: user.id,
          updated_by: user.id,
          created_at: now,
          updated_at: now,
        });
        if (e1) throw new Error('Không tạo được chương trình mới: ' + e1.message);
        const secMap = new Map<string, string>();
        const secs = imp.sections.map(s => {
          const nid = crypto.randomUUID();
          secMap.set(s.id, nid);
          return { ...s, id: nid, program_id: targetId };
        });
        const slds = imp.slides.map(s => ({
          ...s,
          id: crypto.randomUUID(),
          program_id: targetId,
          section_id: s.section_id ? secMap.get(s.section_id) ?? null : null,
        }));
        if (secs.length > 0) {
          const { error } = await supabase.from('sections').insert(secs);
          if (error) throw new Error('Không ghi được các mục: ' + error.message);
        }
        if (slds.length > 0) {
          const { error } = await supabase.from('slides').insert(slds);
          if (error) throw new Error('Không ghi được các slide: ' + error.message);
        }
        const { data } = await supabase.from('programs').select('*').eq('id', targetId).single();
        if (data) setPrograms(prev => [data as Program, ...prev]);
      }
      setProgramId(targetId);
      await loadData(targetId);
      setPendingImport(null);
      setMsg({
        type: 'ok',
        text:
          'Nhập bản sao lưu thành công.' +
          (imp.warnings.length > 0 ? ' Lưu ý: ' + imp.warnings.join(' ') : ''),
      });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Nhập thất bại.' });
    } finally {
      setBusy(null);
    }
  }

  // ---- khôi phục phiên bản ----
  async function doRestore() {
    if (!restoreTarget || !program || !currentChurch) return;
    const v = restoreTarget;
    setBusy('restore');
    setMsg(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Bạn cần đăng nhập.');
      await saveVersion('Tự động lưu trước khi khôi phục phiên bản');
      const snap = v.snapshot;
      if (!snap.program) throw new Error('Phiên bản này không có dữ liệu chương trình.');
      await upsertSnapshot(program.id, {
        program: snap.program,
        sections: snap.sections ?? [],
        slides: snap.slides ?? [],
      }, user.id);
      await loadData(program.id);
      setRestoreTarget(null);
      setMsg({ type: 'ok', text: 'Đã khôi phục phiên bản. Bản trước đó đã được lưu vào lịch sử.' });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Khôi phục thất bại.' });
    } finally {
      setBusy(null);
    }
  }

  // ---- đồng bộ ----
  async function doSync() {
    if (!currentChurch) return;
    setBusy('sync');
    setSyncMsg(null);
    try {
      const res = await syncNow(currentChurch.id, setSyncMsg);
      setLastSync(res);
      setConflicts(res.conflicts);
      if (programId) await loadData(programId);
      if (res.conflicts.length === 0) setSyncMsg('Đồng bộ xong — không có xung đột.');
    } catch (err) {
      setSyncMsg(err instanceof Error ? `Đồng bộ thất bại: ${err.message}` : 'Đồng bộ thất bại.');
    } finally {
      setBusy(null);
    }
  }

  async function handleConflict(c: SyncConflict, choice: 'mine' | 'theirs') {
    setBusy('conflict');
    try {
      await resolveConflict(c.programId, choice);
      setConflicts(prev => prev.filter(x => x.programId !== c.programId));
      if (programId) await loadData(programId);
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Xử lý xung đột thất bại.' });
    } finally {
      setBusy(null);
    }
  }

  if (!currentChurch) {
    return <p className="p-6">Hãy chọn một Hội thánh để sử dụng tính năng sao lưu.</p>;
  }
  if (!canManage) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Sao lưu &amp; khôi phục</h1>
        <p className="mt-2 text-slate-600">Bạn cần quyền Biên tập viên trở lên để sao lưu và khôi phục dữ liệu.</p>
      </div>
    );
  }

  const previewSlides = [...(previewVersion?.snapshot.slides ?? [])].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">💾 Sao lưu &amp; khôi phục</h1>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="inline-flex items-center gap-1 text-sm text-slate-500">
              <Spinner /> Đang tải…
            </span>
          )}
          <Select value={programId} onChange={e => setProgramId(e.target.value)} aria-label="Chọn chương trình">
            {programs.map(p => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          <Button onClick={() => void doSync()} disabled={busy === 'sync'}>
            {busy === 'sync' ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Đang đồng bộ…
              </span>
            ) : (
              '🔄 Đồng bộ ngay'
            )}
          </Button>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            msg.type === 'ok'
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      {syncMsg && <p className="text-sm text-slate-600">🔄 {syncMsg}</p>}
      {lastSync && (
        <p className="text-sm text-slate-600">
          Kết quả đồng bộ: đã đẩy {lastSync.pushed}, đã kéo {lastSync.pulled}, xung đột {lastSync.conflicts.length}.
        </p>
      )}

      {conflicts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">⚠️ Xung đột đồng bộ ({conflicts.length})</h2>
          <p className="mt-1 text-sm text-amber-800">
            Chương trình bị sửa ở cả hai nơi. Bản bị thay thế sẽ <b>luôn được lưu</b> vào lịch sử phiên bản trước khi
            ghi đè — không mất dữ liệu.
          </p>
          <ul className="mt-3 space-y-2">
            {conflicts.map(c => (
              <li key={c.programId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3">
                <div className="text-sm">
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-slate-500">
                    Máy bạn: {fmtTime(c.localUpdatedAt)} · Máy chủ: {fmtTime(c.serverUpdatedAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void handleConflict(c, 'mine')} disabled={busy === 'conflict'}>
                    Giữ bản của tôi
                  </Button>
                  <Button onClick={() => void handleConflict(c, 'theirs')} disabled={busy === 'conflict'}>
                    Lấy bản máy chủ
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Bản sao lưu JSON</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tải toàn bộ chương trình (mục + slide) thành file <code>.tpsbackup.json</code> để cất giữ hoặc chuyển sang
            hội thánh khác.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={!program || busy !== null}
              onClick={() => program && downloadBackupJSON(program, sections, slides, assetsManifest)}
            >
              ⬇ Tải bản sao lưu JSON
            </Button>
            <Button disabled={busy !== null} onClick={() => fileRef.current?.click()}>
              ⬆ Nhập bản sao lưu
            </Button>
            <Input
              ref={fileRef}
              type="file"
              accept=".json,.tpsbackup.json,application/json"
              className="hidden"
              onChange={onPickFile}
              aria-label="Chọn file sao lưu"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Khi nhập: file được kiểm tra định dạng trước; nếu ghi đè, bản hiện tại sẽ tự động lưu vào lịch sử phiên
            bản. File của hội thánh khác sẽ được nhập thành <b>chương trình mới</b> trong hội thánh hiện tại.
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Hướng dẫn nhanh</h2>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Định kỳ tải bản sao lưu JSON, cất ở nơi an toàn (máy tính, USB).</li>
            <li>Trước mỗi lần sửa lớn, lịch sử phiên bản bên dưới đã tự lưu — có thể khôi phục bất cứ lúc nào.</li>
            <li>Mất mạng khi đang sửa: bản nháp vẫn lưu trên máy, có mạng sẽ tự đồng bộ.</li>
            <li>Nếu hai người cùng sửa: trang này báo xung đột để bạn chọn bản giữ lại.</li>
          </ol>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <h2 className="font-semibold">🕘 Lịch sử phiên bản</h2>
        {busy === 'load' ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Đang tải…
          </p>
        ) : versions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Chưa có phiên bản nào. Phiên bản sẽ tự động lưu trước mỗi lần nhập/khôi phục hoặc xử lý xung đột.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {versions.map(v => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <div className="text-sm">
                  <div className="font-medium">{fmtTime(v.created_at)}</div>
                  <div className="text-xs text-slate-500">
                    {v.creator_name && v.creator_name !== '—' ? `bởi ${v.creator_name} · ` : ''}
                    {v.note || 'Phiên bản đã lưu'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setPreviewVersion(v)}>👁 Xem trước</Button>
                  <Button onClick={() => setRestoreTarget(v)} disabled={busy === 'restore'}>
                    ↩ Khôi phục
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Lưu ý: file ảnh trong slide được lưu riêng trên kho ảnh của hội thánh — bản sao lưu JSON chỉ ghi lại đường
        dẫn ảnh (assets_manifest), không kèm dữ liệu ảnh gốc.
      </p>

      {/* Xem trước phiên bản */}
      <Modal open={previewVersion !== null} onClose={() => setPreviewVersion(null)} title="Xem trước phiên bản">
        {previewSlides.length > 0 ? (
          <div className="overflow-x-auto">
            <p className="mb-2 text-sm text-slate-600">
              Slide đầu tiên của phiên bản lúc {previewVersion && fmtTime(previewVersion.created_at)}:
            </p>
            <SlideRenderer slide={previewSlides[0]} width={640} />
            <p className="mt-2 text-xs text-slate-500">
              Phiên bản gồm {(previewVersion?.snapshot.sections ?? []).length} mục và {previewSlides.length} slide.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Phiên bản này không có slide nào.</p>
        )}
        <div className="mt-4 text-right">
          <Button onClick={() => setPreviewVersion(null)}>Đóng</Button>
        </div>
      </Modal>

      {/* Xác nhận nhập file */}
      <ConfirmDialog
        open={pendingImport !== null}
        title="Nhập bản sao lưu?"
        message={
          pendingImport
            ? `File: "${pendingImport.program.title}" — ${pendingImport.sections.length} mục, ${pendingImport.slides.length} slide` +
              (pendingImport.program.church_id === currentChurch.id
                ? '. Bản hiện tại sẽ được lưu vào lịch sử trước khi ghi đè.'
                : '. File thuộc hội thánh khác — sẽ tạo thành chương trình MỚI trong hội thánh hiện tại.') +
              (pendingImport.warnings.length > 0 ? ' Lưu ý: ' + pendingImport.warnings.join(' ') : '')
            : ''
        }
        confirmText="Nhập"
        cancelText="Hủy"
        onConfirm={() => void doImport()}
        onCancel={() => setPendingImport(null)}
      />

      {/* Xác nhận khôi phục */}
      <ConfirmDialog
        open={restoreTarget !== null}
        title="Khôi phục phiên bản này?"
        message={
          restoreTarget
            ? `Chương trình hiện tại sẽ được lưu vào lịch sử, rồi ghi đè bằng phiên bản lúc ${fmtTime(restoreTarget.created_at)}.`
            : ''
        }
        confirmText="Khôi phục"
        cancelText="Hủy"
        onConfirm={() => void doRestore()}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
}
