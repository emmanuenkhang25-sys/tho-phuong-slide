import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../stores/auth';
import { useChurch } from '../stores/church';
import { supabase } from '../lib/supabase';
import type { Church, Invitation, Role } from '../lib/types';
import { ROLE_LABELS, canManageChurch, canManageMembers, isOwner } from '../lib/permissions';
import { formatDateTime } from '../lib/format';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  TextArea,
  useToast,
} from '../components/ui';

const INVITABLE_ROLES: Role[] = ['admin', 'editor', 'presenter', 'viewer'];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

export function HoiThanh() {
  const { user } = useAuth();
  const {
    churches,
    currentChurch,
    setCurrentChurch,
    members,
    myRole,
    loading,
    refresh,
    refreshMembersOnly,
  } = useChurch();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newLogo, setNewLogo] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('viewer');
  const [inviting, setInviting] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [transferTo, setTransferTo] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const adminPlus = canManageMembers(myRole);
  const ownerOnly = isOwner(myRole);

  // Tải lời mời đang chờ của hội thánh hiện tại (admin+ mới đọc được qua RLS)
  useEffect(() => {
    if (!currentChurch || !adminPlus) {
      setInvitations([]);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from('invitations')
        .select('*')
        .eq('church_id', currentChurch.id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });
      setInvitations((data ?? []) as Invitation[]);
    };
    void load();
  }, [currentChurch?.id, adminPlus]);

  /* ------------------------- Tạo hội thánh mới ------------------------- */
  const createChurch = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newName.trim()) {
      toast('Vui lòng nhập tên hội thánh.', 'error');
      return;
    }
    // 1. Xác thực phiên đăng nhập với server trước khi ghi (tránh token hết hạn)
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      toast('Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất rồi đăng nhập lại.', 'error');
      return;
    }
    setCreating(true);
    // 2. Tạo id ở máy khách và INSERT không kèm .select() (không dùng RETURNING):
    //    tránh lỗi RLS ở bước đọc-lại-ngay-sau-ghi (trigger thêm owner chạy trong
    //    lúc insert; đọc lại riêng sau đó sẽ thấy quyền owner đầy đủ).
    const churchId = crypto.randomUUID();
    const { error } = await supabase.from('churches').insert({
      id: churchId,
      name: newName.trim(),
      contact_info: newContact.trim() || null,
      created_by: userData.user.id,
    });
    if (error) {
      setCreating(false);
      toast(`Tạo hội thánh lỗi: ${error.message}`, 'error');
      return;
    }

    // Upload logo (nếu có) lên bucket church-logos/<church_id>/...
    if (newLogo) {
      const ext = newLogo.name.split('.').pop() || 'png';
      const path = `${churchId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from('church-logos').upload(path, newLogo, {
        upsert: true,
        contentType: newLogo.type,
      });
      if (upErr) {
        toast(`Tạo hội thánh xong, nhưng tải logo lỗi: ${upErr.message}`, 'error');
      } else {
        const { data: pub } = supabase.storage.from('church-logos').getPublicUrl(path);
        await supabase.from('churches').update({ logo_url: pub.publicUrl }).eq('id', churchId);
      }
    }

    setCreating(false);
    setShowCreate(false);
    setNewName('');
    setNewContact('');
    setNewLogo(null);
    toast('Đã tạo hội thánh mới. Bạn là Chủ sở hữu.', 'success');
    await refresh();
    setCurrentChurch(churchId);
  };

  /* ------------------------------ Mời ------------------------------ */
  const sendInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentChurch || !user) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast('Vui lòng nhập email người được mời.', 'error');
      return;
    }
    setInviting(true);
    const { data, error } = await supabase
      .from('invitations')
      .insert({ church_id: currentChurch.id, email, role: inviteRole, invited_by: user.id })
      .select('*')
      .single();
    setInviting(false);
    if (error || !data) {
      toast(`Tạo lời mời lỗi: ${error?.message ?? 'không rõ'}`, 'error');
      return;
    }
    setInvitations((xs) => [data as Invitation, ...xs]);
    setInviteEmail('');
    toast('Đã tạo lời mời. Hãy gửi link cho người được mời.', 'success');
  };

  const inviteLink = (token: string) => `${window.location.origin}/loi-moi?token=${token}`;

  const copyInviteLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      toast('Đã copy link lời mời.', 'success');
    } catch {
      toast('Không copy được — hãy copy thủ công từ ô bên dưới.', 'error');
    }
  };

  // Admin thêm trực tiếp người được mời vào hội thánh (vì RLS chặn tự chấp nhận)
  const addInvitedMember = async (inv: Invitation) => {
    setBusy(true);
    // Tìm user_id theo email
    const { data: prof } = await supabase.from('profiles').select('id').eq('email', inv.email).single();
    if (!prof) {
      setBusy(false);
      toast('Người này chưa đăng ký tài khoản. Hãy nhắc họ đăng ký đúng email được mời trước.', 'error');
      return;
    }
    const userId = (prof as { id: string }).id;
    const { error: insErr } = await supabase
      .from('church_members')
      .insert({ church_id: inv.church_id, user_id: userId, role: inv.role, invited_by: inv.invited_by });
    if (insErr) {
      setBusy(false);
      toast(`Thêm thành viên lỗi: ${insErr.message}`, 'error');
      return;
    }
    await supabase.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('id', inv.id);
    setBusy(false);
    setInvitations((xs) => xs.filter((x) => x.id !== inv.id));
    toast(`Đã thêm ${inv.email} vào hội thánh.`, 'success');
    await refreshMembersOnly();
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from('invitations').delete().eq('id', id);
    if (error) {
      toast(`Thu hồi lỗi: ${error.message}`, 'error');
      return;
    }
    setInvitations((xs) => xs.filter((x) => x.id !== id));
    toast('Đã thu hồi lời mời.', 'success');
  };

  /* ------------------------- Thành viên ------------------------- */
  const changeRole = async (memberId: string, role: Role) => {
    const { error } = await supabase.from('church_members').update({ role }).eq('id', memberId);
    if (error) {
      toast(`Đổi vai trò lỗi: ${error.message}`, 'error');
      return;
    }
    toast('Đã cập nhật vai trò.', 'success');
    await refreshMembersOnly();
  };

  const removeMember = async (memberId: string, email: string) => {
    const { error } = await supabase.from('church_members').delete().eq('id', memberId);
    if (error) {
      toast(`Thu hồi lỗi: ${error.message}`, 'error');
      return;
    }
    toast(`Đã xóa ${email} khỏi hội thánh.`, 'success');
    await refresh();
  };

  const leaveChurch = async () => {
    if (!currentChurch || !user) return;
    if (ownerOnly) {
      const owners = members.filter((m) => m.role === 'owner');
      if (owners.length <= 1) {
        toast('Bạn là chủ sở hữu duy nhất. Hãy chuyển quyền sở hữu cho người khác trước khi rời.', 'error');
        return;
      }
    }
    setBusy(true);
    const { error } = await supabase
      .from('church_members')
      .delete()
      .eq('church_id', currentChurch.id)
      .eq('user_id', user.id);
    setBusy(false);
    setLeaving(false);
    if (error) {
      toast(`Rời hội thánh lỗi: ${error.message}`, 'error');
      return;
    }
    toast('Bạn đã rời khỏi hội thánh.', 'info');
    await refresh();
  };

  const transferOwnership = async () => {
    if (!currentChurch || !transferTo) return;
    setBusy(true);
    // Người nhận → owner
    const { error: e1 } = await supabase.from('church_members').update({ role: 'owner' }).eq('id', transferTo);
    // Mình → admin
    const mine = members.find((m) => m.user_id === user?.id);
    const { error: e2 } = mine
      ? await supabase.from('church_members').update({ role: 'admin' }).eq('id', mine.id)
      : { error: null };
    setBusy(false);
    setShowTransfer(false);
    if (e1 || e2) {
      toast(`Chuyển quyền lỗi: ${e1?.message ?? e2?.message}`, 'error');
      return;
    }
    toast('Đã chuyển quyền sở hữu hội thánh.', 'success');
    await refresh();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">⛪ Hội thánh</h1>

      {/* Danh sách hội thánh của tôi */}
      <SectionCard title="Hội thánh của tôi">
        {churches.length === 0 ? (
          <EmptyState
            icon="⛪"
            title="Bạn chưa thuộc hội thánh nào"
            message="Tạo hội thánh mới cho nhóm của bạn, hoặc nhờ quản trị viên gửi link lời mời."
            action={<Button onClick={() => setShowCreate(true)}>➕ Tạo hội thánh mới</Button>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {churches.map((c: Church) => (
              <div
                key={c.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  c.id === currentChurch?.id
                    ? 'border-church-500 bg-church-50 dark:bg-church-900/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {c.logo_url ? (
                  <img src={c.logo_url} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-church-100 text-xl dark:bg-church-900">
                    ⛪
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Vai trò của bạn: {myRole && c.id === currentChurch?.id ? ROLE_LABELS[myRole] : '—'}
                  </p>
                </div>
                {c.id === currentChurch?.id ? (
                  <span className="rounded-full bg-church-100 px-3 py-1 text-xs font-semibold text-church-800 dark:bg-church-900 dark:text-church-200">
                    Đang dùng
                  </span>
                ) : (
                  <Button variant="secondary" onClick={() => setCurrentChurch(c.id)}>
                    Chuyển
                  </Button>
                )}
              </div>
            ))}
            <Button variant="ghost" onClick={() => setShowCreate(true)} className="self-start">
              ➕ Tạo hội thánh mới
            </Button>
          </div>
        )}
      </SectionCard>

      {currentChurch && (
        <>
          {/* Thành viên */}
          <SectionCard title={`Thành viên — ${currentChurch.name}`}>
            <ul className="flex flex-col gap-2">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-lg dark:bg-slate-700" aria-hidden>
                    👤
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {m.profile?.display_name || m.profile?.email || m.user_id}
                      {m.user_id === user?.id && <span className="ml-2 text-xs text-slate-500">(bạn)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{m.profile?.email}</p>
                  </div>
                  {adminPlus && m.user_id !== user?.id && m.role !== 'owner' ? (
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Vai trò của ${m.profile?.email}`}
                        value={m.role}
                        onChange={(e) => void changeRole(m.id, e.target.value as Role)}
                        className="min-h-touch rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                      >
                        {(Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== 'owner').map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => void removeMember(m.id, m.profile?.email ?? '')}
                        aria-label={`Xóa ${m.profile?.email}`}
                        className="flex min-h-touch min-w-touch items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        🗑️
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {ROLE_LABELS[m.role]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* Mời thành viên */}
          {adminPlus && (
            <SectionCard title="✉️ Mời thành viên">
              <form onSubmit={sendInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Email người được mời"
                    type="email"
                    placeholder="vidu@email.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="sm:w-48">
                  <Select label="Vai trò" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                    {INVITABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" loading={inviting}>
                  Tạo lời mời
                </Button>
              </form>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Người được mời cần <strong>đăng ký tài khoản đúng email này</strong>, sau đó bấm link lời mời
                để tham gia hội thánh.
              </p>

              {invitations.length > 0 && (
                <div className="mt-4 flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Lời mời đang chờ ({invitations.length})</h3>
                  {invitations.map((inv) => (
                    <div key={inv.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{inv.email}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {ROLE_LABELS[inv.role]} · hết hạn {formatDateTime(inv.expires_at)}
                          </p>
                        </div>
                        <Button variant="secondary" onClick={() => void copyInviteLink(inv.token)}>
                          📋 Copy link
                        </Button>
                        <Button variant="secondary" loading={busy} onClick={() => void addInvitedMember(inv)}>
                          ✅ Thêm vào hội thánh
                        </Button>
                        <Button variant="ghost" onClick={() => void revokeInvite(inv.id)}>
                          Thu hồi
                        </Button>
                      </div>
                      <p className="mt-2 break-all rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {inviteLink(inv.token)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Quản trị hội thánh */}
          {(canManageChurch(myRole) || ownerOnly) && (
            <SectionCard title="🛠️ Quản trị hội thánh">
              <div className="flex flex-col gap-3">
                {ownerOnly && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Chuyển quyền sở hữu cho:</span>
                    <select
                      aria-label="Chọn người nhận quyền sở hữu"
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      className="min-h-touch rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="">— Chọn thành viên —</option>
                      {members
                        .filter((m) => m.user_id !== user?.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.profile?.display_name || m.profile?.email} ({ROLE_LABELS[m.role]})
                          </option>
                        ))}
                    </select>
                    <Button variant="secondary" disabled={!transferTo} onClick={() => setShowTransfer(true)}>
                      Chuyển quyền sở hữu
                    </Button>
                  </div>
                )}
                <div>
                  <Button variant="danger" onClick={() => setLeaving(true)}>
                    🚪 Rời khỏi hội thánh
                  </Button>
                </div>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Modal tạo hội thánh */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo hội thánh mới">
        <form onSubmit={createChurch} className="flex flex-col gap-4">
          <Input label="Tên hội thánh *" placeholder="VD: Hội Thánh Tin Lành Tân Dĩnh" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <TextArea label="Thông tin liên hệ" rows={2} placeholder="Địa chỉ, số điện thoại…" value={newContact} onChange={(e) => setNewContact(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Logo hội thánh (tùy chọn)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewLogo(e.target.files?.[0] ?? null)}
              className="min-h-touch text-sm text-slate-600 dark:text-slate-300"
            />
          </div>
          <Button type="submit" loading={creating}>
            Tạo hội thánh
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        onConfirm={transferOwnership}
        title="Chuyển quyền sở hữu?"
        message="Bạn sẽ chuyển quyền Chủ sở hữu hội thánh cho người này và trở thành Quản trị viên. Hành động này rất quan trọng — hãy chắc chắn."
        confirmLabel="Chuyển quyền sở hữu"
        danger
        loading={busy}
      />

      <ConfirmDialog
        open={leaving}
        onClose={() => setLeaving(false)}
        onConfirm={leaveChurch}
        title="Rời khỏi hội thánh?"
        message="Bạn sẽ không còn truy cập chương trình và tài nguyên của hội thánh này nữa."
        confirmLabel="Rời hội thánh"
        danger
        loading={busy}
      />
    </div>
  );
}

export default HoiThanh;
