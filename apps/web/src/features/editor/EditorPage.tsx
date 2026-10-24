// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// EditorPage.tsx — trình biên tập slide (/chuong-trinh/:id).
//
// Bố cục 5 vùng: Toolbar trên / Thumbnails trái / Canvas giữa /
// Properties phải / Statusbar dưới.
// Autosave: debounce 2s → Dexie (saveDraft) → push Supabase;
// trước khi push kiểm tra updated_at để phát hiện xung đột.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AspectRatio, Program, Section, Slide, SlideBackground, SlideObject } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { hasRole } from '../../lib/permissions';
import { clearDraft, getDraft, saveDraft } from '../../lib/dexie';
import { useAuth } from '../../stores/auth';
import { useSyncStatus } from '../../stores/sync';
import type { Role } from '../../lib/types';
import { Toolbar } from './components/Toolbar';
import { ThumbnailsPanel } from './components/ThumbnailsPanel';
import { CanvasPanel } from './components/CanvasPanel';
import { PropertiesPanel, type AlignMode, type LayerDir } from './components/PropertiesPanel';
import { StatusBar } from './components/StatusBar';
import { AutoSplitModal } from './components/AutoSplitModal';
import { ProgramInfoPanel } from './components/ProgramInfoPanel';
import type { SlideDraft } from './lib/split';
import {
  blankSlide,
  cloneSlide,
  draftToSlide,
  newImageObject,
  newShapeObject,
  newTextObject,
  renumberSlides,
  SECTION_KINDS,
  uuid,
} from './lib/editorUtils';
import {
  fetchServerUpdatedAt,
  pushAll,
  resolveImageSrc,
  resolveSlideImages,
  restoreFilePaths,
  saveVersionSnapshot,
  type PendingDeletes,
} from './lib/sync';

interface EditorState {
  program: Program;
  sections: Section[];
  slides: Slide[];
}

const AUTOSAVE_DELAY = 2000;

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setStatus } = useSyncStatus();

  const [program, setProgram] = useState<Program | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingDraft, setUsingDraft] = useState(false);
  const [draftNewer, setDraftNewer] = useState(false);
  const [denied, setDenied] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitSectionId, setSplitSectionId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionKind, setNewSectionKind] = useState('custom');
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<{ id: string; file_path: string; url?: string }[]>([]);
  const [histTick, setHistTick] = useState(0);
  void histTick; // chỉ dùng setter để ép re-render khi undo/redo stack đổi

  const stateRef = useRef<EditorState | null>(null);
  const histPast = useRef<string[]>([]);
  const histFuture = useRef<string[]>([]);
  const saveTimer = useRef<number | null>(null);
  const baseUpdatedAt = useRef<string>('');
  const dirtyRef = useRef(false);
  const saveInFlight = useRef(false);
  const pendingSave = useRef(false);
  const deletedIds = useRef<PendingDeletes>({ slides: [], sections: [] });
  const clipboard = useRef<SlideObject[] | null>(null);
  const imgCache = useRef(new Map<string, string>());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSlide = slides.find((s) => s.id === selectedSlideId) ?? null;
  const selectedObjects = selectedSlide
    ? selectedSlide.content.objects.filter((o) => selectedObjectIds.includes(o.id))
    : [];

  // ----------------------------------------------------------
  // Tải dữ liệu
  // ----------------------------------------------------------
  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // RequireAuth đã chặn ở route
    if (!id) {
      setLoadError('Thiếu id chương trình.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: prog, error: pErr } = await supabase
          .from('programs')
          .select('*')
          .eq('id', id)
          .single();
        if (pErr) throw pErr;
        if (!prog || (prog as Program).status === 'deleted') {
          throw new Error('Chương trình không tồn tại hoặc đã bị xóa.');
        }
        const programRow = prog as Program;

        // Kiểm tra quyền: thành viên hội thánh, role >= editor
        const { data: mem } = await supabase
          .from('church_members')
          .select('role')
          .eq('church_id', programRow.church_id)
          .eq('user_id', user.id)
          .maybeSingle();
        const role = (mem?.role as string) ?? 'none';
        if (!hasRole(role as Role, 'editor')) {
          if (!cancelled) {
            setDenied(true);
            setLoading(false);
          }
          return;
        }

        const [{ data: secRows }, { data: sliRows }] = await Promise.all([
          supabase.from('sections').select('*').eq('program_id', id).order('order_index'),
          supabase.from('slides').select('*').eq('program_id', id).order('order_index'),
        ]);
        const secs = (secRows ?? []) as Section[];
        let slis = (sliRows ?? []) as Slide[];
        slis = await resolveSlideImages(supabase, slis, imgCache.current);

        if (cancelled) return;
        const st: EditorState = { program: programRow, sections: secs, slides: slis };
        stateRef.current = st;
        setProgram(programRow);
        setSections(secs);
        setSlides(slis);
        setSelectedSlideId(slis[0]?.id ?? null);
        baseUpdatedAt.current = programRow.updated_at;
        histPast.current = [];
        histFuture.current = [];
        deletedIds.current = { slides: [], sections: [] };
        dirtyRef.current = false;
        setStatus('da-dong-bo', 'Đã tải từ đám mây');

        // Có bản nháp mới hơn trên máy? → hỏi user có muốn dùng không
        const draft = await getDraft(id);
        if (draft?.data && draft.dirty && draft.updatedAt > programRow.updated_at) {
          setDraftNewer(true);
        }
      } catch (e) {
        // Offline / lỗi mạng → dùng bản nháp Dexie
        try {
          const draft = await getDraft(id!);
          if (draft?.data && !cancelled) {
            const st = draft.data as EditorState;
            stateRef.current = st;
            setProgram(st.program);
            setSections(st.sections);
            setSlides(st.slides);
            setSelectedSlideId(st.slides[0]?.id ?? null);
            baseUpdatedAt.current = st.program.updated_at;
            setUsingDraft(true);
            setStatus('ngoai-tuyen', 'Ngoại tuyến — đang dùng bản nháp trên máy');
          } else if (!cancelled) {
            setLoadError('Không tải được chương trình. Kiểm tra mạng rồi thử lại.');
          }
        } catch {
          if (!cancelled) setLoadError('Không tải được chương trình. Kiểm tra mạng rồi thử lại.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authLoading, user?.id]);

  // ----------------------------------------------------------
  // Autosave + đồng bộ
  // ----------------------------------------------------------
  const doSave = useCallback(async () => {
    const st = stateRef.current;
    if (!st || saveInFlight.current) {
      if (st) pendingSave.current = true;
      return;
    }
    saveInFlight.current = true;
    try {
      setStatus('dang-luu', 'Đang lưu…');
      // Lưu trữ: src ảnh luôn là file_path gốc (không bao giờ lưu signed URL tạm)
      const storableSlides = restoreFilePaths(st.slides, imgCache.current);
      await saveDraft({
        programId: st.program.id,
        churchId: st.program.church_id,
        data: { ...st, slides: storableSlides },
        updatedAt: new Date().toISOString(),
        dirty: true,
      });
      dirtyRef.current = true;
      setStatus('da-luu-may', 'Đã lưu trên máy');

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setStatus('ngoai-tuyen', 'Ngoại tuyến — sẽ đồng bộ khi có mạng');
        return;
      }
      // Phát hiện xung đột: server mới hơn bản base local?
      const serverUpdatedAt = await fetchServerUpdatedAt(supabase, st.program.id);
      if (serverUpdatedAt && serverUpdatedAt > baseUpdatedAt.current) {
        await saveVersionSnapshot(supabase, st.program, st.sections, storableSlides, user?.id, 'Tự động lưu trước khi giải quyết xung đột');
        setConflict(true);
        setStatus('loi', 'Xung đột đồng bộ — cần bạn chọn');
        return;
      }
      await pushAll(supabase, st.program, st.sections, storableSlides, deletedIds.current, user?.id);
      deletedIds.current = { slides: [], sections: [] };
      baseUpdatedAt.current = new Date().toISOString();
      dirtyRef.current = false;
      setStatus(
        'da-dong-bo',
        `Đã lưu trên đám mây • ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
      );
    } catch {
      setStatus('loi', 'Lỗi đồng bộ — sẽ thử lại');
      pendingSave.current = true;
    } finally {
      saveInFlight.current = false;
      if (pendingSave.current) {
        pendingSave.current = false;
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => void doSave(), 5000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const scheduleSave = useCallback(
    (delay = AUTOSAVE_DELAY) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void doSave(), delay);
    },
    [doSave],
  );

  // Có mạng trở lại → đồng bộ ngay
  useEffect(() => {
    const onOnline = () => void doSave();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [doSave]);

  // Cảnh báo khi còn thay đổi chưa lưu
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  // ----------------------------------------------------------
  // Nhân (state) + undo/redo
  // ----------------------------------------------------------
  const pushHistory = () => {
    const st = stateRef.current;
    if (!st) return;
    histPast.current.push(JSON.stringify(st));
    if (histPast.current.length > 50) histPast.current.shift();
    histFuture.current = [];
    setHistTick((t) => t + 1);
  };

  const applyState = (next: EditorState, record = true) => {
    if (record) pushHistory();
    stateRef.current = next;
    setProgram(next.program);
    setSections(next.sections);
    setSlides(next.slides);
    scheduleSave();
  };

  const undo = useCallback(() => {
    const past = histPast.current;
    if (past.length === 0 || !stateRef.current) return;
    histFuture.current.push(JSON.stringify(stateRef.current));
    const prev = JSON.parse(past.pop()!) as EditorState;
    stateRef.current = prev;
    setProgram(prev.program);
    setSections(prev.sections);
    setSlides(prev.slides);
    setSelectedObjectIds([]);
    if (!prev.slides.some((s) => s.id === selectedSlideId)) {
      setSelectedSlideId(prev.slides[0]?.id ?? null);
    }
    setHistTick((t) => t + 1);
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlideId, scheduleSave]);

  const redo = useCallback(() => {
    const fut = histFuture.current;
    if (fut.length === 0 || !stateRef.current) return;
    histPast.current.push(JSON.stringify(stateRef.current));
    const next = JSON.parse(fut.pop()!) as EditorState;
    stateRef.current = next;
    setProgram(next.program);
    setSections(next.sections);
    setSlides(next.slides);
    setSelectedObjectIds([]);
    setHistTick((t) => t + 1);
    scheduleSave();
  }, [scheduleSave]);

  // ----------------------------------------------------------
  // Thao tác slide
  // ----------------------------------------------------------
  const defaultSectionForNewSlide = (): string | null => {
    const st = stateRef.current;
    if (!st) return null;
    return selectedSlide?.section_id ?? st.sections[0]?.id ?? null;
  };

  const addSlide = (sectionId?: string | null) => {
    const st = stateRef.current;
    if (!st) return;
    const secId = sectionId !== undefined ? sectionId : defaultSectionForNewSlide();
    const bg: SlideBackground = st.program.design_template?.defaultBackground ?? { type: 'color', color: '#1e3a5f' };
    const slide = blankSlide(st.program.id, secId, 0, bg);
    let insertAt = st.slides.length;
    if (selectedSlideId) {
      const idx = st.slides.findIndex((s) => s.id === selectedSlideId);
      if (idx >= 0) insertAt = idx + 1;
    }
    const next = [...st.slides];
    next.splice(insertAt, 0, slide);
    applyState({ ...st, slides: renumberSlides(next) });
    setSelectedSlideId(slide.id);
    setSelectedObjectIds([]);
  };

  const duplicateSlide = (slideId?: string) => {
    const st = stateRef.current;
    const targetId = slideId ?? selectedSlideId;
    if (!st || !targetId) return;
    const idx = st.slides.findIndex((s) => s.id === targetId);
    if (idx < 0) return;
    const copy = cloneSlide(st.slides[idx]);
    const next = [...st.slides];
    next.splice(idx + 1, 0, copy);
    applyState({ ...st, slides: renumberSlides(next) });
    setSelectedSlideId(copy.id);
    setSelectedObjectIds([]);
  };

  const deleteSlide = (slideId?: string) => {
    const st = stateRef.current;
    const targetId = slideId ?? selectedSlideId;
    if (!st || !targetId) return;
    if (!window.confirm('Xóa slide này?')) return;
    deletedIds.current.slides.push(targetId);
    const idx = st.slides.findIndex((s) => s.id === targetId);
    const next = st.slides.filter((s) => s.id !== targetId);
    applyState({ ...st, slides: renumberSlides(next) });
    const fallback = next[Math.min(idx, next.length - 1)] ?? null;
    setSelectedSlideId(fallback?.id ?? null);
    setSelectedObjectIds([]);
  };

  const moveSlide = (slideId: string, delta: -1 | 1) => {
    const st = stateRef.current;
    if (!st) return;
    const idx = st.slides.findIndex((s) => s.id === slideId);
    const j = idx + delta;
    if (idx < 0 || j < 0 || j >= st.slides.length) return;
    const next = [...st.slides];
    [next[idx], next[j]] = [next[j], next[idx]];
    applyState({ ...st, slides: renumberSlides(next) });
  };

  /** Kéo-thả: chuyển slide tới vị trí destIndex trong mục destSectionId. */
  const dropSlide = (dragId: string, destSectionId: string | null, destIndex: number) => {
    const st = stateRef.current;
    if (!st || dragId == null) return;
    const moving = st.slides.find((s) => s.id === dragId);
    if (!moving) return;
    const without = st.slides.filter((s) => s.id !== dragId);
    const destSlides = without.filter((s) => s.section_id === destSectionId);
    const clampedIdx = Math.max(0, Math.min(destIndex, destSlides.length));
    let insertAt: number;
    if (destSlides.length === 0) {
      // Mục trống: chèn sau slide cuối cùng của các mục đứng trước nó
      const secs = [...st.sections].sort((a, b) => a.order_index - b.order_index);
      const destSec = secs.find((s) => s.id === destSectionId);
      const beforeIds = new Set(
        destSec ? secs.filter((s) => s.order_index <= destSec.order_index).map((s) => s.id) : [],
      );
      insertAt = 0;
      without.forEach((s, i) => {
        if (s.section_id && beforeIds.has(s.section_id)) insertAt = i + 1;
      });
    } else if (clampedIdx >= destSlides.length) {
      insertAt = without.indexOf(destSlides[destSlides.length - 1]) + 1;
    } else {
      insertAt = without.indexOf(destSlides[clampedIdx]);
    }
    const next = [...without];
    next.splice(insertAt, 0, { ...moving, section_id: destSectionId });
    applyState({ ...st, slides: renumberSlides(next) });
  };

  // ----------------------------------------------------------
  // Thao tác mục (section)
  // ----------------------------------------------------------
  const addSection = (title: string, kind: string) => {
    const st = stateRef.current;
    if (!st) return;
    const sec: Section = {
      id: uuid(),
      program_id: st.program.id,
      title: title.trim() || 'Mục mới',
      kind,
      order_index: st.sections.length,
    };
    applyState({ ...st, sections: [...st.sections, sec] });
    setShowAddSection(false);
    setNewSectionTitle('');
    setNewSectionKind('custom');
  };

  const renameSection = (secId: string, title: string) => {
    const st = stateRef.current;
    if (!st) return;
    applyState({
      ...st,
      sections: st.sections.map((s) => (s.id === secId ? { ...s, title } : s)),
    });
  };

  const deleteSection = (secId: string) => {
    const st = stateRef.current;
    if (!st) return;
    const count = st.slides.filter((s) => s.section_id === secId).length;
    if (!window.confirm(`Xóa mục này? ${count} slide trong mục sẽ chuyển về "Chưa phân mục".`)) return;
    deletedIds.current.sections.push(secId);
    applyState({
      ...st,
      sections: st.sections
        .filter((s) => s.id !== secId)
        .map((s, i) => ({ ...s, order_index: i })),
      slides: st.slides.map((s) => (s.section_id === secId ? { ...s, section_id: null } : s)),
    });
  };

  const moveSection = (secId: string, delta: -1 | 1) => {
    const st = stateRef.current;
    if (!st) return;
    const ordered = [...st.sections].sort((a, b) => a.order_index - b.order_index);
    const idx = ordered.findIndex((s) => s.id === secId);
    const j = idx + delta;
    if (idx < 0 || j < 0 || j >= ordered.length) return;
    [ordered[idx], ordered[j]] = [ordered[j], ordered[idx]];
    applyState({ ...st, sections: ordered.map((s, i) => ({ ...s, order_index: i })) });
  };

  /** Kéo-thả đổi thứ tự mục: chuyển dragId tới trước beforeId (null = cuối). */
  const dropSection = (dragId: string, beforeId: string | null) => {
    const st = stateRef.current;
    if (!st || !dragId) return;
    const moving = st.sections.find((s) => s.id === dragId);
    if (!moving) return;
    const ordered = [...st.sections]
      .sort((a, b) => a.order_index - b.order_index)
      .filter((s) => s.id !== dragId);
    let idx = beforeId ? ordered.findIndex((s) => s.id === beforeId) : ordered.length;
    if (idx < 0) idx = ordered.length;
    ordered.splice(idx, 0, moving);
    applyState({ ...st, sections: ordered.map((s, i) => ({ ...s, order_index: i })) });
  };

  // ----------------------------------------------------------
  // Thao tác object trên slide đang chọn
  // ----------------------------------------------------------
  const updateSlideObjects = (slideId: string, objects: SlideObject[]) => {
    const st = stateRef.current;
    if (!st) return;
    applyState({
      ...st,
      slides: st.slides.map((s) =>
        s.id === slideId ? { ...s, content: { ...s.content, objects } } : s,
      ),
    });
  };

  const patchSelectedObjects = (patch: Partial<SlideObject>) => {
    if (!selectedSlide || selectedObjectIds.length === 0) return;
    updateSlideObjects(
      selectedSlide.id,
      selectedSlide.content.objects.map((o) =>
        selectedObjectIds.includes(o.id) ? { ...o, ...patch } : o,
      ),
    );
  };

  const addObjectToSlide = (obj: SlideObject) => {
    if (!selectedSlide) return;
    const maxZ = selectedSlide.content.objects.reduce((m, o) => Math.max(m, o.z ?? 0), 0);
    updateSlideObjects(selectedSlide.id, [...selectedSlide.content.objects, { ...obj, z: maxZ + 1 }]);
    setSelectedObjectIds([obj.id]);
  };

  const deleteSelectedObjects = () => {
    if (!selectedSlide || selectedObjectIds.length === 0) return;
    updateSlideObjects(
      selectedSlide.id,
      selectedSlide.content.objects.filter((o) => !selectedObjectIds.includes(o.id)),
    );
    setSelectedObjectIds([]);
  };

  const moveSelectedObjects = (dxPct: number, dyPct: number) => {
    if (!selectedSlide || selectedObjectIds.length === 0) return;
    updateSlideObjects(
      selectedSlide.id,
      selectedSlide.content.objects.map((o) => {
        if (!selectedObjectIds.includes(o.id)) return o;
        return {
          ...o,
          x: Math.min(100 - o.w, Math.max(0, o.x + dxPct)),
          y: Math.min(100 - o.h, Math.max(0, o.y + dyPct)),
        };
      }),
    );
  };

  const moveLayer = (dir: LayerDir) => {
    if (!selectedSlide || selectedObjectIds.length === 0) return;
    const ids = new Set(selectedObjectIds);
    const ordered = [...selectedSlide.content.objects].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    let next: SlideObject[];
    if (dir === 'top') {
      next = [...ordered.filter((o) => !ids.has(o.id)), ...ordered.filter((o) => ids.has(o.id))];
    } else if (dir === 'bottom') {
      next = [...ordered.filter((o) => ids.has(o.id)), ...ordered.filter((o) => !ids.has(o.id))];
    } else {
      next = [...ordered];
      if (dir === 'up') {
        for (let i = next.length - 2; i >= 0; i--) {
          if (ids.has(next[i].id) && !ids.has(next[i + 1].id)) {
            [next[i], next[i + 1]] = [next[i + 1], next[i]];
          }
        }
      } else {
        for (let i = 1; i < next.length; i++) {
          if (ids.has(next[i].id) && !ids.has(next[i - 1].id)) {
            [next[i], next[i - 1]] = [next[i - 1], next[i]];
          }
        }
      }
    }
    updateSlideObjects(
      selectedSlide.id,
      next.map((o, i) => ({ ...o, z: i })),
    );
  };

  const alignObjects = (mode: AlignMode) => {
    if (!selectedSlide || selectedObjectIds.length === 0) return;
    updateSlideObjects(
      selectedSlide.id,
      selectedSlide.content.objects.map((o) => {
        if (!selectedObjectIds.includes(o.id)) return o;
        switch (mode) {
          case 'left': return { ...o, x: 0 };
          case 'centerX': return { ...o, x: (100 - o.w) / 2 };
          case 'right': return { ...o, x: 100 - o.w };
          case 'top': return { ...o, y: 0 };
          case 'middle': return { ...o, y: (100 - o.h) / 2 };
          case 'bottom': return { ...o, y: 100 - o.h };
        }
      }),
    );
  };

  const patchBackground = (patch: Partial<SlideBackground>) => {
    if (!selectedSlide) return;
    const st = stateRef.current;
    if (!st) return;
    applyState({
      ...st,
      slides: st.slides.map((s) =>
        s.id === selectedSlide.id
          ? { ...s, background: { ...s.background, ...patch } }
          : s,
      ),
    });
  };

  const copyObjects = () => {
    if (selectedObjects.length === 0) return;
    clipboard.current = selectedObjects.map((o) => ({ ...o }));
  };

  const pasteObjects = () => {
    if (!selectedSlide || !clipboard.current || clipboard.current.length === 0) return;
    const copies = clipboard.current.map((o) => ({
      ...o,
      id: uuid(),
      x: Math.min(100 - o.w, o.x + 3),
      y: Math.min(100 - o.h, o.y + 3),
    }));
    const maxZ = selectedSlide.content.objects.reduce((m, o) => Math.max(m, o.z ?? 0), 0);
    updateSlideObjects(
      selectedSlide.id,
      [...selectedSlide.content.objects, ...copies.map((c, i) => ({ ...c, z: maxZ + 1 + i }))],
    );
    setSelectedObjectIds(copies.map((c) => c.id));
  };

  const duplicateSelectedObjects = () => {
    if (selectedObjects.length === 0) return;
    copyObjects();
    pasteObjects();
  };

  // ----------------------------------------------------------
  // Ảnh: upload + thư viện hội thánh
  // ----------------------------------------------------------
  const addImageObject = (src: string) => {
    addObjectToSlide(newImageObject(src));
  };

  const handleImageFile = async (file: File, asBackground: boolean) => {
    const st = stateRef.current;
    if (!st) return;
    setStatus('dang-luu', 'Đang tải ảnh lên…');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = `${st.program.church_id}/${st.program.id}/${uuid()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('program-images').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      await supabase.from('program_assets').insert({
        church_id: st.program.church_id,
        program_id: st.program.id,
        kind: 'image',
        file_path: path,
        mime: file.type,
        file_size: file.size,
        uploaded_by: user?.id ?? null,
      });
      const url = await resolveImageSrc(supabase, path, imgCache.current);
      const src = url ?? path;
      if (asBackground) {
        patchBackground({ type: 'image', image: src });
      } else {
        addImageObject(src);
      }
      scheduleSave();
    } catch (e) {
      setStatus('loi', 'Tải ảnh thất bại');
      window.alert(`Tải ảnh thất bại: ${(e as Error).message}`);
      scheduleSave();
    }
  };

  const openLibrary = async () => {
    const st = stateRef.current;
    if (!st) return;
    setShowLibrary(true);
    try {
      const { data, error } = await supabase
        .from('program_assets')
        .select('id, file_path, file_url')
        .eq('church_id', st.program.church_id)
        .eq('kind', 'image')
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      const assets = await Promise.all(
        ((data ?? []) as { id: string; file_path: string; file_url: string | null }[]).map(
          async (a) => ({
            id: a.id,
            file_path: a.file_path,
            url: a.file_url ?? (await resolveImageSrc(supabase, a.file_path, imgCache.current)),
          }),
        ),
      );
      setLibraryAssets(assets);
    } catch {
      setLibraryAssets([]);
    }
  };

  // ----------------------------------------------------------
  // Chèn slide từ AutoSplitModal
  // ----------------------------------------------------------
  const insertDrafts = (drafts: SlideDraft[], sectionId: string | null) => {
    const st = stateRef.current;
    if (!st || drafts.length === 0) return;
    const targetSec = sectionId ?? selectedSlide?.section_id ?? st.sections[0]?.id ?? null;
    let insertAt = st.slides.length;
    if (targetSec) {
      st.slides.forEach((s, i) => {
        if (s.section_id === targetSec) insertAt = i + 1;
      });
    }
    const newSlides = drafts.map((d) => draftToSlide(d, st.program.id, targetSec, 0));
    const next = [...st.slides];
    next.splice(insertAt, 0, ...newSlides);
    applyState({ ...st, slides: renumberSlides(next) });
    setSelectedSlideId(newSlides[0]?.id ?? null);
    setSelectedObjectIds([]);
    setShowSplit(false);
  };

  // ----------------------------------------------------------
  // Thông tin chương trình: lưu / nhân bản / yêu thích / lưu trữ / xóa
  // ----------------------------------------------------------
  const saveProgramInfo = (patch: Partial<Program>) => {
    const st = stateRef.current;
    if (!st) return;
    applyState({ ...st, program: { ...st.program, ...patch } });
  };

  const cloneProgram = async () => {
    const st = stateRef.current;
    if (!st) return;
    if (!window.confirm(`Nhân bản toàn bộ chương trình "${st.program.title}"?`)) return;
    setStatus('dang-luu', 'Đang nhân bản…');
    try {
      const newProgramId = uuid();
      const { error: pErr } = await supabase.from('programs').insert({
        id: newProgramId,
        church_id: st.program.church_id,
        title: `${st.program.title} (bản sao)`,
        event_date: st.program.event_date,
        start_time: st.program.start_time,
        leader: st.program.leader,
        theme: st.program.theme,
        theme_verse: st.program.theme_verse,
        notes: st.program.notes,
        design_template: st.program.design_template,
        aspect_ratio: st.program.aspect_ratio,
        status: 'draft',
        is_favorite: false,
        created_by: user?.id ?? null,
      });
      if (pErr) throw pErr;
      const secIdMap = new Map<string, string>();
      const newSections = st.sections.map((s) => {
        const nid = uuid();
        secIdMap.set(s.id, nid);
        return { id: nid, program_id: newProgramId, title: s.title, kind: s.kind, order_index: s.order_index };
      });
      if (newSections.length > 0) {
        const { error } = await supabase.from('sections').insert(newSections);
        if (error) throw error;
      }
      const newSlides = restoreFilePaths(st.slides, imgCache.current).map((s) => ({
        id: uuid(),
        program_id: newProgramId,
        section_id: s.section_id ? (secIdMap.get(s.section_id) ?? null) : null,
        order_index: s.order_index,
        content: s.content,
        background: s.background,
      }));
      if (newSlides.length > 0) {
        const { error } = await supabase.from('slides').insert(newSlides);
        if (error) throw error;
      }
      await clearDraft(st.program.id).catch(() => undefined);
      navigate(`/chuong-trinh/${newProgramId}`);
    } catch (e) {
      window.alert(`Nhân bản thất bại: ${(e as Error).message}`);
      scheduleSave();
    }
  };

  const setProgramStatus = async (patch: Partial<Program>, goHome: boolean) => {
    const st = stateRef.current;
    if (!st) return;
    try {
      const { error } = await supabase.from('programs').update(patch).eq('id', st.program.id);
      if (error) throw error;
      await clearDraft(st.program.id).catch(() => undefined);
      dirtyRef.current = false;
      if (goHome) navigate('/dashboard');
      else applyState({ ...st, program: { ...st.program, ...patch } });
    } catch (e) {
      window.alert(`Thao tác thất bại: ${(e as Error).message}`);
    }
  };

  // ----------------------------------------------------------
  // Xung đột
  // ----------------------------------------------------------
  const resolveConflict = async (keepMine: boolean) => {
    const st = stateRef.current;
    if (!st) return;
    setConflict(false);
    if (keepMine) {
      // Ghi đè server bằng bản local (src ảnh đã trả về file_path gốc)
      setStatus('dang-luu', 'Đang ghi đè bản máy chủ…');
      try {
        const storableSlides = restoreFilePaths(st.slides, imgCache.current);
        await pushAll(supabase, st.program, st.sections, storableSlides, deletedIds.current, user?.id);
        deletedIds.current = { slides: [], sections: [] };
        baseUpdatedAt.current = new Date().toISOString();
        dirtyRef.current = false;
        setStatus('da-dong-bo', 'Đã giữ bản của bạn trên đám mây');
      } catch {
        setStatus('loi', 'Lỗi đồng bộ — sẽ thử lại');
      }
    } else {
      // Lấy bản server (đã lưu snapshot bản local trước khi hiện banner)
      setStatus('dang-luu', 'Đang tải bản máy chủ…');
      try {
        const { data: prog } = await supabase.from('programs').select('*').eq('id', st.program.id).single();
        const [{ data: secRows }, { data: sliRows }] = await Promise.all([
          supabase.from('sections').select('*').eq('program_id', st.program.id).order('order_index'),
          supabase.from('slides').select('*').eq('program_id', st.program.id).order('order_index'),
        ]);
        const slis = await resolveSlideImages(supabase, ((sliRows ?? []) as Slide[]), imgCache.current);
        const next: EditorState = {
          program: prog as Program,
          sections: (secRows ?? []) as Section[],
          slides: slis,
        };
        histPast.current = [];
        histFuture.current = [];
        deletedIds.current = { slides: [], sections: [] };
        stateRef.current = next;
        setProgram(next.program);
        setSections(next.sections);
        setSlides(next.slides);
        setSelectedSlideId(next.slides[0]?.id ?? null);
        setSelectedObjectIds([]);
        baseUpdatedAt.current = (prog as Program).updated_at;
        dirtyRef.current = false;
        await clearDraft(st.program.id).catch(() => undefined);
        setStatus('da-dong-bo', 'Đã lấy bản máy chủ');
      } catch {
        setStatus('loi', 'Không tải được bản máy chủ');
      }
    }
  };

  const useLocalDraft = async () => {
    if (!id) return;
    const draft = await getDraft(id);
    if (draft?.data) {
      const st = draft.data as EditorState;
      histPast.current = [];
      histFuture.current = [];
      stateRef.current = st;
      setProgram(st.program);
      setSections(st.sections);
      setSlides(st.slides);
      setSelectedSlideId(st.slides[0]?.id ?? null);
      dirtyRef.current = true;
      scheduleSave(500);
    }
    setDraftNewer(false);
  };

  // ----------------------------------------------------------
  // Phím tắt
  // ----------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        } else if (k === 's') {
          e.preventDefault();
          void doSave();
        } else if (k === 'd' && !typing) {
          e.preventDefault();
          if (selectedObjectIds.length > 0) duplicateSelectedObjects();
          else duplicateSlide();
        } else if (k === 'c' && !typing) {
          copyObjects();
        } else if (k === 'v' && !typing) {
          e.preventDefault();
          pasteObjects();
        }
        return;
      }
      if (typing) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          deleteSelectedObjects();
        }
      } else if (e.key.startsWith('Arrow')) {
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 1.04 : 0.21; // ≈ 10px / 2px trên slide 960px
          if (e.key === 'ArrowLeft') moveSelectedObjects(-step, 0);
          if (e.key === 'ArrowRight') moveSelectedObjects(step, 0);
          if (e.key === 'ArrowUp') moveSelectedObjects(0, -step);
          if (e.key === 'ArrowDown') moveSelectedObjects(0, step);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, doSave, selectedObjectIds, selectedSlideId]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-slate-500">Đang tải trình biên tập…</p>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-4 dark:bg-slate-950">
        <p className="text-lg font-semibold">Bạn không có quyền chỉnh sửa</p>
        <p className="text-sm text-slate-500">Chỉ thành viên có vai trò Biên tập viên trở lên mới sửa được chương trình này.</p>
        <button
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white min-h-[40px]"
          onClick={() => navigate('/dashboard')}
        >
          ← Quay lại
        </button>
      </div>
    );
  }

  if (loadError || !program) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-4 dark:bg-slate-950">
        <p className="text-lg font-semibold">Không mở được trình biên tập</p>
        <p className="text-sm text-slate-500">{loadError ?? 'Lỗi không xác định.'}</p>
        <div className="flex gap-2">
          <button
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white min-h-[40px]"
            onClick={() => window.location.reload()}
          >
            Thử lại
          </button>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm min-h-[40px]"
            onClick={() => navigate('/dashboard')}
          >
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  const aspect: AspectRatio = program.aspect_ratio;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Banner xung đột */}
      {conflict && (
        <div className="flex flex-wrap items-center gap-2 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          <span className="font-medium">⚠ Phát hiện xung đột:</span>
          <span>máy chủ có bản mới hơn. Bản của bạn đã được lưu an toàn vào lịch sử phiên bản.</span>
          <span className="ml-auto flex gap-2">
            <button
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white min-h-[36px]"
              onClick={() => void resolveConflict(true)}
            >
              Giữ bản của tôi
            </button>
            <button
              className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm min-h-[36px] dark:bg-slate-800"
              onClick={() => void resolveConflict(false)}
            >
              Lấy bản máy chủ
            </button>
          </span>
        </div>
      )}

      {/* Banner bản nháp mới hơn */}
      {draftNewer && !usingDraft && (
        <div className="flex flex-wrap items-center gap-2 bg-sky-100 px-3 py-2 text-sm text-sky-900 dark:bg-sky-900 dark:text-sky-100">
          <span>💾 Trên máy này có bản nháp mới hơn bản trên đám mây.</span>
          <span className="ml-auto flex gap-2">
            <button
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white min-h-[36px]"
              onClick={() => void useLocalDraft()}
            >
              Dùng bản nháp
            </button>
            <button
              className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-sm min-h-[36px] dark:bg-slate-800"
              onClick={() => setDraftNewer(false)}
            >
              Bỏ qua
            </button>
          </span>
        </div>
      )}

      {usingDraft && (
        <div className="bg-slate-200 px-3 py-1.5 text-center text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Đang dùng bản nháp trên máy — sẽ đồng bộ khi có mạng.
        </div>
      )}

      {/* 1. Toolbar trên */}
      <Toolbar
        program={program}
        sections={sections}
        slides={slides}
        onAddSlide={() => addSlide()}
        onDuplicateSlide={() => duplicateSlide()}
        onDeleteSlide={() => deleteSlide()}
        onAddSection={() => setShowAddSection(true)}
        onOpenSplit={() => setShowSplit(true)}
        onUndo={undo}
        onRedo={redo}
        canUndo={histPast.current.length > 0}
        canRedo={histFuture.current.length > 0}
        onAddText={() => addObjectToSlide(newTextObject())}
        onAddShape={(s) => addObjectToSlide(newShapeObject(s))}
        onAddImage={() => fileInputRef.current?.click()}
        onOpenLibrary={() => void openLibrary()}
        aspect={aspect}
        onAspectChange={(a) => saveProgramInfo({ aspect_ratio: a })}
        onPresent={() => navigate(`/trinh-chieu/${program.id}`)}
        onOpenInfo={() => setShowInfo(true)}
        onSyncNow={() => void doSave()}
      />
      {/* COORDINATOR: ExportMenu sẽ được gắn trong Toolbar (đã để sẵn comment) */}

      {/* 2-4. Thumbnails | Canvas | Properties */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-44 shrink-0 overflow-hidden border-r border-slate-200 bg-white sm:block dark:border-slate-700 dark:bg-slate-900">
          <ThumbnailsPanel
            sections={sections}
            slides={slides}
            selectedSlideId={selectedSlideId}
            aspect={aspect}
            onSelectSlide={(sid) => {
              setSelectedSlideId(sid);
              setSelectedObjectIds([]);
            }}
            onAddSlide={(secId) => addSlide(secId)}
            onDuplicateSlide={(sid) => duplicateSlide(sid)}
            onDeleteSlide={(sid) => deleteSlide(sid)}
            onMoveSlideUp={(sid) => moveSlide(sid, -1)}
            onMoveSlideDown={(sid) => moveSlide(sid, 1)}
            onDropSlide={dropSlide}
            onDropSection={dropSection}
            onRenameSection={renameSection}
            onDeleteSection={deleteSection}
            onMoveSectionUp={(sid) => moveSection(sid, -1)}
            onMoveSectionDown={(sid) => moveSection(sid, 1)}
            onOpenSplitForSection={(sid) => { setSplitSectionId(sid); setShowSplit(true); }}
          />
        </aside>

        <main className="min-w-0 flex-1 bg-slate-200 dark:bg-slate-950">
          {selectedSlide ? (
            <CanvasPanel
              slide={selectedSlide}
              aspect={aspect}
              selectedIds={selectedObjectIds}
              onSelect={setSelectedObjectIds}
              onObjectsChange={(objects) => updateSlideObjects(selectedSlide.id, objects)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
              Chưa có slide nào.<br />
              <button
                className="mt-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white min-h-[40px]"
                onClick={() => addSlide()}
              >
                ＋ Thêm slide đầu tiên
              </button>
            </div>
          )}
        </main>

        <aside className="hidden w-64 shrink-0 overflow-hidden border-l border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-slate-900">
          {selectedSlide && (
            <PropertiesPanel
              selected={selectedObjects}
              background={selectedSlide.background}
              onPatchObjects={patchSelectedObjects}
              onPatchBackground={patchBackground}
              onDeleteObjects={deleteSelectedObjects}
              onMoveLayer={moveLayer}
              onAlign={alignObjects}
              onUploadBackgroundImage={(f) => void handleImageFile(f, true)}
              onRemoveBackgroundImage={() => patchBackground({ type: 'color', color: '#1e3a5f', image: undefined })}
            />
          )}
        </aside>
      </div>

      {/* Mobile: thumbnails + properties dạng drawer đơn giản */}
      <details className="border-t border-slate-200 bg-white sm:hidden dark:border-slate-700 dark:bg-slate-900">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">🖼 Danh sách slide ({slides.length})</summary>
        <div className="max-h-64 overflow-y-auto">
          <ThumbnailsPanel
            sections={sections}
            slides={slides}
            selectedSlideId={selectedSlideId}
            aspect={aspect}
            onSelectSlide={(sid) => {
              setSelectedSlideId(sid);
              setSelectedObjectIds([]);
            }}
            onAddSlide={(secId) => addSlide(secId)}
            onDuplicateSlide={(sid) => duplicateSlide(sid)}
            onDeleteSlide={(sid) => deleteSlide(sid)}
            onMoveSlideUp={(sid) => moveSlide(sid, -1)}
            onMoveSlideDown={(sid) => moveSlide(sid, 1)}
            onDropSlide={dropSlide}
            onDropSection={dropSection}
            onRenameSection={renameSection}
            onDeleteSection={deleteSection}
            onMoveSectionUp={(sid) => moveSection(sid, -1)}
            onMoveSectionDown={(sid) => moveSection(sid, 1)}
            onOpenSplitForSection={(sid) => { setSplitSectionId(sid); setShowSplit(true); }}
          />
        </div>
      </details>

      {/* 5. Statusbar dưới */}
      <StatusBar
        slideCount={slides.length}
        objectCount={selectedSlide?.content.objects.length ?? 0}
        aspect={aspect}
        selectedSlideIndex={selectedSlide ? slides.findIndex((s) => s.id === selectedSlide.id) : -1}
      />

      {/* Input file ẩn: thêm ảnh object */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImageFile(f, false);
          e.target.value = '';
        }}
      />
      {/* Modal thêm mục */}
      {showAddSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2" role="dialog" aria-modal="true" aria-label="Thêm mục">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-2xl dark:bg-slate-900">
            <h2 className="mb-3 text-base font-bold">＋ Thêm mục</h2>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Tên mục</label>
            <input
              autoFocus
              className="mb-3 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 min-h-[40px]"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="VD: Hát thờ phượng"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addSection(newSectionTitle, newSectionKind);
              }}
            />
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Loại mục</label>
            <select
              className="mb-4 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 min-h-[40px]"
              value={newSectionKind}
              onChange={(e) => setNewSectionKind(e.target.value)}
            >
              {SECTION_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[40px] dark:border-slate-600"
                onClick={() => setShowAddSection(false)}
              >
                Hủy
              </button>
              <button
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white min-h-[40px]"
                onClick={() => addSection(newSectionTitle, newSectionKind)}
              >
                Thêm mục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal thư viện ảnh hội thánh */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2" role="dialog" aria-modal="true" aria-label="Thư viện ảnh">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4 shadow-2xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">🗂 Thư viện ảnh hội thánh</h2>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm min-h-[36px] dark:border-slate-600"
                onClick={() => setShowLibrary(false)}
              >
                ✕ Đóng
              </button>
            </div>
            {libraryAssets.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Chưa có ảnh nào trong thư viện.<br />Hãy tải ảnh lên bằng nút “🖼 Ảnh” — ảnh sẽ tự lưu vào thư viện.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {libraryAssets.map((a) => (
                  <button
                    key={a.id}
                    className="overflow-hidden rounded-md border border-slate-200 hover:border-sky-500 dark:border-slate-700"
                    title="Chèn ảnh này vào slide"
                    onClick={() => {
                      if (a.url) addImageObject(a.url);
                      setShowLibrary(false);
                    }}
                  >
                    {a.url ? (
                      <img src={a.url} alt="" className="h-24 w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-24 items-center justify-center text-xs text-slate-400">Không xem được</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal tự động chia bài hát / Kinh Thánh */}
      <AutoSplitModal
        open={showSplit}
        onClose={() => { setShowSplit(false); setSplitSectionId(null); }}
        sections={sections}
        initialSectionId={splitSectionId}
        churchId={program.church_id}
        defaultBackground={
          (program.design_template?.defaultBackground as SlideBackground | undefined) ?? { type: 'color', color: '#1e3a5f' }
        }
        aspect={aspect}
        onInsert={insertDrafts}
      />

      {/* Panel thông tin chương trình */}
      <ProgramInfoPanel
        open={showInfo}
        onClose={() => setShowInfo(false)}
        program={program}
        onSave={saveProgramInfo}
        onClone={() => void cloneProgram()}
        onToggleFavorite={() => saveProgramInfo({ is_favorite: !program.is_favorite })}
        onArchive={() => void setProgramStatus({ status: 'archived' }, true)}
        onDelete={() =>
          void setProgramStatus({ status: 'deleted', deleted_at: new Date().toISOString() }, true)
        }
      />
    </div>
  );
}
