import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../stores/auth';
import { useChurch } from '../stores/church';
import { supabase } from '../lib/supabase';
import { canManageChurch } from '../lib/permissions';
import { Button, Input, TextArea, Spinner, useToast } from '../components/ui';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

export function CaiDat() {
  const { user, profile, updatePassword, refreshProfile } = useAuth();
  const { currentChurch, myRole, refresh } = useChurch();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [churchName, setChurchName] = useState('');
  const [churchContact, setChurchContact] = useState('');
  const [churchSettings, setChurchSettings] = useState('');
  const [churchLogo, setChurchLogo] = useState<File | null>(null);
  const [savingChurch, setSavingChurch] = useState(false);

  const [deleteReason, setDeleteReason] = useState('');
  const [requestingDelete, setRequestingDelete] = useState(false);

  const adminPlus = canManageChurch(myRole);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
  }, [profile?.display_name]);

  useEffect(() => {
    setChurchName(currentChurch?.name ?? '');
    setChurchContact(currentChurch?.contact_info ?? '');
    setChurchSettings(JSON.stringify(currentChurch?.settings ?? {}, null, 2));
  }, [currentChurch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------- Hồ sơ cá nhân ------------------------- */
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!displayName.trim()) {
      toast('Tên hiển thị không được để trống.', 'error');
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', user.id);
    setSavingProfile(false);
    if (error) {
      toast(`Lưu lỗi: ${error.message}`, 'error');
      return;
    }
    await refreshProfile();
    toast('Đã cập nhật tên hiển thị.', 'success');
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pw1.length < 6) {
      toast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
      return;
    }
    if (pw1 !== pw2) {
      toast('Mật khẩu nhập lại chưa khớp.', 'error');
      return;
    }
    setSavingPw(true);
    const r = await updatePassword(pw1);
    setSavingPw(false);
    if (!r.ok) {
      toast(r.error ?? 'Đổi mật khẩu thất bại.', 'error');
      return;
    }
    setPw1('');
    setPw2('');
    toast('Đổi mật khẩu thành công.', 'success');
  };

  /* ------------------------- Cài đặt hội thánh ------------------------- */
  const saveChurch = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentChurch) return;
    let settings: Record<string, unknown>;
    try {
      settings = churchSettings.trim() ? JSON.parse(churchSettings) : {};
    } catch {
      toast('Cài đặt JSON chưa đúng định dạng. Vui lòng kiểm tra lại.', 'error');
      return;
    }
    setSavingChurch(true);
    let logoUrl: string | null | undefined;
    if (churchLogo) {
      const ext = churchLogo.name.split('.').pop() || 'png';
      const path = `${currentChurch.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from('church-logos').upload(path, churchLogo, {
        upsert: true,
        contentType: churchLogo.type,
      });
      if (upErr) {
        setSavingChurch(false);
        toast(`Tải logo lỗi: ${upErr.message}`, 'error');
        return;
      }
      logoUrl = supabase.storage.from('church-logos').getPublicUrl(path).data.publicUrl;
    }
    const payload: Record<string, unknown> = {
      name: churchName.trim() || currentChurch.name,
      contact_info: churchContact.trim() || null,
      settings,
    };
    if (logoUrl) payload.logo_url = logoUrl;
    const { error } = await supabase.from('churches').update(payload).eq('id', currentChurch.id);
    setSavingChurch(false);
    setChurchLogo(null);
    if (error) {
      toast(`Lưu lỗi: ${error.message}`, 'error');
      return;
    }
    toast('Đã lưu cài đặt hội thánh.', 'success');
    await refresh();
  };

  /* ------------------------- Yêu cầu xóa tài khoản ------------------------- */
  const requestDeleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!currentChurch) {
      toast('Bạn cần thuộc một hội thánh để gửi yêu cầu (yêu cầu được ghi vào nhật ký hội thánh).', 'error');
      return;
    }
    setRequestingDelete(true);
    const { error } = await supabase.from('audit_logs').insert({
      church_id: currentChurch.id,
      actor_id: user.id,
      action: 'account.delete_requested',
      entity: 'profiles',
      entity_id: user.id,
      detail: { reason: deleteReason.trim(), requested_at: new Date().toISOString() },
    });
    setRequestingDelete(false);
    if (error) {
      toast(`Gửi yêu cầu lỗi: ${error.message}`, 'error');
      return;
    }
    setDeleteReason('');
    toast('Đã ghi nhận yêu cầu xóa tài khoản. Quản trị viên sẽ liên hệ với bạn.', 'success');
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">⚙️ Cài đặt</h1>

      <SectionCard title="👤 Hồ sơ cá nhân">
        <form onSubmit={saveProfile} className="flex max-w-md flex-col gap-4">
          <Input label="Email" type="email" value={profile?.email ?? ''} disabled hint="Email đăng nhập không thể thay đổi." />
          <Input label="Tên hiển thị" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="VD: Anh Tuấn" />
          <Button type="submit" loading={savingProfile} className="self-start">
            Lưu thay đổi
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="🔐 Đổi mật khẩu">
        <form onSubmit={changePassword} className="flex max-w-md flex-col gap-4">
          <Input label="Mật khẩu mới" type="password" autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Ít nhất 6 ký tự" />
          <Input label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <Button type="submit" loading={savingPw} className="self-start">
            Đổi mật khẩu
          </Button>
        </form>
      </SectionCard>

      {currentChurch ? (
        adminPlus ? (
          <SectionCard title={`⛪ Cài đặt hội thánh — ${currentChurch.name}`}>
            <form onSubmit={saveChurch} className="flex max-w-2xl flex-col gap-4">
              <Input label="Tên hội thánh" value={churchName} onChange={(e) => setChurchName(e.target.value)} />
              <TextArea label="Thông tin liên hệ" rows={2} value={churchContact} onChange={(e) => setChurchContact(e.target.value)} placeholder="Địa chỉ, số điện thoại…" />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Logo hội thánh</label>
                <div className="flex items-center gap-3">
                  {currentChurch.logo_url && <img src={currentChurch.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setChurchLogo(e.target.files?.[0] ?? null)}
                    className="min-h-touch text-sm text-slate-600 dark:text-slate-300"
                  />
                </div>
              </div>
              <TextArea
                label="Cài đặt trình chiếu (JSON)"
                rows={6}
                value={churchSettings}
                onChange={(e) => setChurchSettings(e.target.value)}
                hint="VD: {&quot;default_aspect&quot;: &quot;16:9&quot;, &quot;remote_enabled&quot;: true}. Sai định dạng sẽ không lưu được."
                className="font-mono text-xs"
              />
              <Button type="submit" loading={savingChurch} className="self-start">
                Lưu cài đặt hội thánh
              </Button>
            </form>
          </SectionCard>
        ) : (
          <SectionCard title="⛪ Hội thánh">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Chỉ <strong>Quản trị viên</strong> trở lên mới được thay đổi cài đặt của{' '}
              <strong>{currentChurch.name}</strong>.
            </p>
          </SectionCard>
        )
      ) : null}

      <SectionCard title="🗑️ Xóa tài khoản">
        <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Vì lý do an toàn, bạn <strong>không thể tự xóa tài khoản</strong> ngay tại đây. Hãy gửi yêu cầu bên
          dưới — yêu cầu sẽ được ghi vào nhật ký của hội thánh và <strong>quản trị viên sẽ liên hệ</strong>{' '}
          để xác nhận trước khi xử lý.
        </p>
        <form onSubmit={requestDeleteAccount} className="flex max-w-md flex-col gap-4">
          <TextArea
            label="Lý do muốn xóa tài khoản (tùy chọn)"
            rows={3}
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="VD: Tôi không còn tham gia ban thờ phượng…"
          />
          <Button type="submit" variant="danger" loading={requestingDelete} className="self-start">
            Gửi yêu cầu xóa tài khoản
          </Button>
        </form>
      </SectionCard>

      {!user && (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      )}
    </div>
  );
}

export default CaiDat;
