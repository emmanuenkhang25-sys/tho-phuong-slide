import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';
import type { Church, ChurchMember, Profile, Role } from '../lib/types';

/**
 * Store hội thánh (CONTRACT mục 5).
 * useChurch() = { churches, memberships, currentChurch, setCurrentChurch,
 *   members, myRole, loading, refresh }
 * Hội thánh đang dùng được lưu localStorage key `tps:church`.
 */

const STORAGE_KEY = 'tps:church';

interface ChurchState {
  churches: Church[];
  /** role của user trong từng hội thánh: { [churchId]: Role } */
  memberships: Record<string, Role>;
  currentChurch: Church | null;
  members: ChurchMember[];
  myRole: Role | null;
  loading: boolean;
  setCurrentChurch: (id: string) => void;
  refresh: () => Promise<void>;
  /** Tải lại danh sách thành viên của hội thánh đang dùng. */
  refreshMembersOnly: () => Promise<void>;
}

function readStoredChurchId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export const useChurch = create<ChurchState>((set, get) => ({
  churches: [],
  memberships: {},
  currentChurch: null,
  members: [],
  myRole: null,
  loading: true,

  setCurrentChurch: (id) => {
    const church = get().churches.find((c) => c.id === id) ?? null;
    try {
      if (church) localStorage.setItem(STORAGE_KEY, church.id);
    } catch {
      /* bỏ qua */
    }
    set({ currentChurch: church, myRole: church ? get().memberships[church.id] ?? null : null });
    // Tải lại danh sách thành viên của hội thánh mới chọn
    void get().refreshMembersOnly();
  },

  refresh: async () => {
    const user = useAuth.getState().user;
    if (!user) {
      set({ churches: [], memberships: {}, currentChurch: null, members: [], myRole: null, loading: false });
      return;
    }
    set({ loading: true });
    // Tải memberships kèm thông tin hội thánh (join qua FK church_members.church_id)
    const { data, error } = await supabase
      .from('church_members')
      .select('role, church_id, churches (id, name, logo_url, avatar_url, contact_info, settings, created_by)')
      .eq('user_id', user.id);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[church] refresh lỗi:', error.message);
      set({ loading: false });
      return;
    }

    const churches: Church[] = [];
    const memberships: Record<string, Role> = {};
    interface ChurchRow {
      role: Role;
      church_id: string;
      churches: Church | Church[] | null;
    }
    for (const row of (data ?? []) as ChurchRow[]) {
      // Supabase trả về object cho quan hệ to-one; client chưa typed có thể suy ra mảng — chuẩn hóa cả 2.
      const joined = Array.isArray(row.churches) ? row.churches[0] : row.churches;
      if (!joined) continue;
      churches.push(joined);
      memberships[row.church_id] = row.role;
    }

    const stored = readStoredChurchId();
    const current = churches.find((c) => c.id === stored) ?? churches[0] ?? null;

    set({
      churches,
      memberships,
      currentChurch: current,
      myRole: current ? memberships[current.id] ?? null : null,
      loading: false,
    });

    // Tải thành viên của hội thánh đang dùng
    await get().refreshMembersOnly();
  },

  // (nội bộ) tải members của currentChurch
  refreshMembersOnly: async () => {
    const { currentChurch } = get();
    if (!currentChurch) {
      set({ members: [] });
      return;
    }
    const { data, error } = await supabase
      .from('church_members')
      .select('id, church_id, user_id, role, joined_at, profile:profiles (id, email, display_name, avatar_url, is_platform_admin)')
      .eq('church_id', currentChurch.id)
      .order('joined_at', { ascending: true });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[church] tải thành viên lỗi:', error.message);
      return;
    }
    const members = ((data ?? []) as Array<Omit<ChurchMember, 'profile'> & { profile: Profile | Profile[] | null }>).map(
      (m) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] ?? undefined : m.profile ?? undefined,
      }),
    );
    set({ members });
  },
}));

/** Helper: đảm bảo store church đã refresh sau khi đăng nhập (gọi từ pages). */
export async function ensureChurchLoaded(): Promise<void> {
  const { churches, loading, refresh } = useChurch.getState();
  if (loading || churches.length === 0) {
    await refresh();
  }
}
