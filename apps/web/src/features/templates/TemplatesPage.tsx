import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Program, Slide, SlideBackground, SlideObject } from '../../lib/types';
import { roleRank } from '../../lib/permissions';
import { useChurch } from '../../stores/church';
import { SlideRenderer } from '../editor/components/SlideRenderer';
import {
  TEMPLATES,
  TEMPLATE_GROUPS,
  churchTemplateToSlideTemplate,
  deleteChurchTemplate,
  getChurchTemplates,
  saveChurchTemplate,
  type ChurchTemplate,
  type SlideTemplate,
} from './templates';

type Tab = 'library' | 'church';

// Slide tối thiểu để SlideRenderer preview mẫu
function templatePreviewSlide(t: SlideTemplate): Slide {
  return {
    id: `preview-${t.id}`,
    program_id: '',
    section_id: null,
    order_index: 0,
    content: { objects: t.sampleObjects },
    background: t.background,
  };
}

export function TemplatesPage() {
  const { currentChurch, myRole } = useChurch();
  const [tab, setTab] = useState<Tab>('library');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [churchTemplates, setChurchTemplates] = useState<ChurchTemplate[]>([]);

  const [applyTarget, setApplyTarget] = useState<SlideTemplate | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState('');
  const [slidesOfProgram, setSlidesOfProgram] = useState<Slide[]>([]);
  const [targetMode, setTargetMode] = useState<'all' | 'one'>('all');
  const [targetSlideId, setTargetSlideId] = useState('');
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newFrom, setNewFrom] = useState('#1e3a5f');
  const [newTo, setNewTo] = useState('#3b82f6');
  const [newAngle, setNewAngle] = useState(135);
  const [newTextColor, setNewTextColor] = useState('#ffffff');
  const [churchMsg, setChurchMsg] = useState<string | null>(null);

  const canEdit = roleRank(myRole) >= 3;

  useEffect(() => {
    if (currentChurch) setChurchTemplates(getChurchTemplates(currentChurch.id));
  }, [currentChurch, tab]);

  const visibleTemplates = useMemo(() => {
    if (groupFilter === 'all') return TEMPLATES;
    return TEMPLATES.filter((t) => t.group === groupFilter);
  }, [groupFilter]);

  const groupName = (id: string) => TEMPLATE_GROUPS.find((g) => g.id === id)?.name ?? id;

  // ---------- mở dialog áp dụng ----------
  const openApply = async (t: SlideTemplate) => {
    setApplyTarget(t);
    setApplyMsg(null);
    setTargetMode('all');
    setTargetSlideId('');
    setProgramId('');
    setSlidesOfProgram([]);
    if (!currentChurch) return;
    const { data } = await supabase
      .from('programs')
      .select('*')
      .eq('church_id', currentChurch.id)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(30);
    setPrograms((data ?? []) as Program[]);
  };

  const onProgramChange = async (pid: string) => {
    setProgramId(pid);
    setSlidesOfProgram([]);
    setTargetSlideId('');
    if (!pid) return;
    const { data } = await supabase
      .from('slides')
      .select('*')
      .eq('program_id', pid)
      .order('order_index', { ascending: true });
    setSlidesOfProgram((data ?? []) as Slide[]);
  };

  // ---------- áp dụng mẫu ----------
  const doApply = async () => {
    if (!applyTarget || !programId) return;
    if (!canEdit) {
      setApplyMsg('Bạn không có quyền sửa chương trình (cần vai trò Biên tập viên trở lên).');
      return;
    }
    const targets =
      targetMode === 'all'
        ? slidesOfProgram
        : slidesOfProgram.filter((s) => s.id === targetSlideId);
    if (targets.length === 0) {
      setApplyMsg('Chưa chọn slide nào để áp dụng.');
      return;
    }
    setApplyBusy(true);
    setApplyMsg(null);
    try {
      const tpl = applyTarget;
      let ok = 0;
      for (const s of targets) {
        const objects: SlideObject[] = (s.content?.objects ?? []).map((o) =>
          o.type === 'text' ? { ...o, color: tpl.textColor } : o,
        );
        const { error } = await supabase
          .from('slides')
          .update({ background: tpl.background, content: { objects } })
          .eq('id', s.id);
        if (!error) ok++;
      }
      setApplyMsg(
        ok === targets.length
          ? `Đã áp dụng mẫu "${tpl.name}" cho ${ok} slide.`
          : `Đã áp dụng cho ${ok}/${targets.length} slide (một số slide lỗi — kiểm tra lại quyền).`,
      );
    } finally {
      setApplyBusy(false);
    }
  };

  // ---------- mẫu hội thánh ----------
  const createChurchTemplate = () => {
    if (!currentChurch) return;
    const background: SlideBackground = {
      type: 'gradient',
      gradient: { from: newFrom, to: newTo, angle: newAngle },
    };
    const sampleObjects: SlideObject[] = [
      {
        id: `ct-${Date.now()}-title`, type: 'text', x: 8, y: 36, w: 84, h: 20,
        text: 'TIÊU ĐỀ MẪU', fontSize: 64, bold: true, align: 'center',
        color: newTextColor, lineHeight: 1.25,
      },
      {
        id: `ct-${Date.now()}-sub`, type: 'text', x: 8, y: 58, w: 84, h: 20,
        text: 'Dòng phụ mẫu — thay nội dung của bạn tại đây', fontSize: 30,
        align: 'center', color: newTextColor, lineHeight: 1.25,
      },
    ];
    saveChurchTemplate(currentChurch.id, newName, { background, textColor: newTextColor, sampleObjects });
    setChurchTemplates(getChurchTemplates(currentChurch.id));
    setNewName('');
    setChurchMsg('Đã lưu mẫu. Lưu ý: mẫu riêng lưu trên máy này (localStorage), chưa đồng bộ đám mây.');
  };

  const removeChurchTemplate = (id: string) => {
    if (!currentChurch) return;
    if (!window.confirm('Xóa mẫu này khỏi máy?')) return;
    deleteChurchTemplate(currentChurch.id, id);
    setChurchTemplates(getChurchTemplates(currentChurch.id));
  };

  if (!currentChurch) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-6 text-center max-w-sm">
          <p className="font-semibold mb-2">Chưa chọn Hội thánh</p>
          <p className="text-sm text-slate-500 mb-4">Hãy chọn Hội thánh để xem thư viện mẫu.</p>
          <Link to="/dashboard" className="px-4 py-2 rounded-lg bg-blue-600 text-white inline-block">
            Về trang tổng quan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold">Thư viện mẫu slide</h1>
        <p className="text-sm text-slate-500 mt-1">
          Mẫu dùng gradient tự vẽ bằng CSS — không dùng ảnh ngoài.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setTab('library')}
            className={`px-4 py-2 rounded-lg font-semibold min-h-[44px] ${tab === 'library' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
          >
            Thư viện mẫu
          </button>
          <button
            onClick={() => setTab('church')}
            className={`px-4 py-2 rounded-lg font-semibold min-h-[44px] ${tab === 'church' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
          >
            Mẫu của Hội thánh ({churchTemplates.length})
          </button>
        </div>

        {tab === 'library' && (
          <>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setGroupFilter('all')}
                className={`shrink-0 px-3 py-2 rounded-full text-sm font-semibold min-h-[40px] ${groupFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}
              >
                Tất cả
              </button>
              {TEMPLATE_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGroupFilter(g.id)}
                  title={g.description}
                  className={`shrink-0 px-3 py-2 rounded-full text-sm font-semibold min-h-[40px] ${groupFilter === g.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}
                >
                  {g.name}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleTemplates.map((t) => (
                <div key={t.id} className="bg-white rounded-xl shadow overflow-hidden">
                  <div className="relative">
                    <SlideRenderer slide={templatePreviewSlide(t)} width={400} />
                    <span className="absolute top-2 left-2 text-[11px] font-bold bg-black/60 text-white rounded px-2 py-0.5">
                      {t.aspect}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="font-bold">{t.name}</p>
                    <p className="text-xs text-slate-500">{groupName(t.group)}</p>
                    <button
                      onClick={() => void openApply(t)}
                      className="mt-2 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold min-h-[44px]"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'church' && (
          <div className="mt-4">
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="font-bold mb-1">Tạo mẫu mới</h2>
              <p className="text-xs text-slate-500 mb-3">
                Mẫu riêng lưu trên máy này (localStorage), chưa đồng bộ đám mây — máy khác sẽ không thấy.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <label className="col-span-2 text-sm">
                  Tên mẫu
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="VD: Mẫu Chúa nhật của Hội thánh"
                    className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[44px]"
                  />
                </label>
                <label className="text-sm">
                  Màu đầu
                  <input type="color" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} className="mt-1 w-full h-[44px] rounded-lg" />
                </label>
                <label className="text-sm">
                  Màu cuối
                  <input type="color" value={newTo} onChange={(e) => setNewTo(e.target.value)} className="mt-1 w-full h-[44px] rounded-lg" />
                </label>
                <label className="text-sm">
                  Màu chữ
                  <input type="color" value={newTextColor} onChange={(e) => setNewTextColor(e.target.value)} className="mt-1 w-full h-[44px] rounded-lg" />
                </label>
              </div>
              <label className="block text-sm mt-3">
                Góc gradient: {newAngle}°
                <input
                  type="range" min={0} max={360} value={newAngle}
                  onChange={(e) => setNewAngle(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <button
                onClick={createChurchTemplate}
                className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold min-h-[44px]"
              >
                💾 Lưu làm mẫu của Hội thánh
              </button>
              {churchMsg && <p className="mt-2 text-sm text-emerald-700">{churchMsg}</p>}
            </div>

            {churchTemplates.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 text-center py-8">
                Chưa có mẫu riêng. Tạo mẫu mới ở trên, hoặc nhóm biên tập có thể lưu thiết kế hiện tại làm mẫu từ trang soạn slide.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {churchTemplates.map((ct) => {
                  const t = churchTemplateToSlideTemplate(ct);
                  return (
                    <div key={ct.id} className="bg-white rounded-xl shadow overflow-hidden">
                      <SlideRenderer slide={templatePreviewSlide(t)} width={400} />
                      <div className="p-3">
                        <p className="font-bold">{ct.name}</p>
                        <p className="text-xs text-slate-500">
                          Tạo {new Date(ct.createdAt).toLocaleDateString('vi-VN')} • chỉ trên máy này
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => void openApply(t)}
                            className="py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold min-h-[44px]"
                          >
                            Áp dụng
                          </button>
                          <button
                            onClick={() => removeChurchTemplate(ct.id)}
                            className="py-2 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold min-h-[44px]"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* dialog áp dụng mẫu */}
      {applyTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setApplyTarget(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Áp dụng mẫu "{applyTarget.name}"</h2>
            <p className="text-sm text-slate-500 mt-1">
              Sẽ cập nhật nền (background) và màu chữ các slide được chọn. Cần quyền Biên tập viên trở lên.
            </p>

            <label className="block text-sm font-semibold mt-4">
              Chương trình (của {currentChurch.name})
              <select
                value={programId}
                onChange={(e) => void onProgramChange(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[44px]"
              >
                <option value="">— Chọn chương trình —</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>

            {programId && (
              <div className="mt-3 text-sm">
                <label className="flex items-center gap-2 py-1">
                  <input type="radio" checked={targetMode === 'all'} onChange={() => setTargetMode('all')} />
                  Tất cả slide ({slidesOfProgram.length})
                </label>
                <label className="flex items-center gap-2 py-1">
                  <input type="radio" checked={targetMode === 'one'} onChange={() => setTargetMode('one')} />
                  Một slide cụ thể
                </label>
                {targetMode === 'one' && (
                  <select
                    value={targetSlideId}
                    onChange={(e) => setTargetSlideId(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[44px]"
                  >
                    <option value="">— Chọn slide —</option>
                    {slidesOfProgram.map((s, i) => (
                      <option key={s.id} value={s.id}>
                        Slide {i + 1}{s.content?.objects?.[0]?.text ? ` — ${String(s.content.objects[0].text).slice(0, 40)}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {applyMsg && <p className="mt-3 text-sm text-blue-700">{applyMsg}</p>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setApplyTarget(null)}
                className="py-2 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold min-h-[44px]"
              >
                Đóng
              </button>
              <button
                onClick={() => void doApply()}
                disabled={applyBusy || !programId}
                className="py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold min-h-[44px] disabled:opacity-50"
              >
                {applyBusy ? 'Đang áp dụng…' : 'Áp dụng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
