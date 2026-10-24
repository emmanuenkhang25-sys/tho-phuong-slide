import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';
import type { Profile } from '../lib/types';

/**
 * Store xác thực (CONTRACT mục 5).
 * useAuth() = { user, profile, loading, initialized, signIn, signUp, signOut,
 *   sendPasswordReset, updatePassword, refreshProfile, init }
 */

type AuthResult = { ok: boolean; error?: string };

/** Dịch lỗi Supabase Auth sang tiếng Việt thân thiện. */
export function viAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Sai email hoặc mật khẩu. Vui lòng thử lại.';
  if (m.includes('email not confirmed')) return 'Tài khoản chưa được xác minh. Vui lòng kiểm tra email và bấm link xác minh.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng chức năng quên mật khẩu.';
  if (m.includes('password should be at least')) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (m.includes('unable to validate email address') || m.includes('invalid email'))
    return 'Địa chỉ email không hợp lệ.';
  if (m.includes('email rate limit') || m.includes('too many'))
    return 'Bạn thao tác quá nhanh. Vui lòng đợi vài phút rồi thử lại.';
  if (m.includes('signup is disabled')) return 'Chức năng đăng ký đang tạm tắt. Vui lòng liên hệ quản trị viên.';
  if (m.includes('expired') && m.includes('token')) return 'Link đã hết hạn. Vui lòng yêu cầu gửi lại.';
  if (m.includes('same password')) return 'Mật khẩu mới phải khác mật khẩu cũ.';
  if (!supabaseConfigured) return 'Chưa cấu hình Supabase (thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
  return message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, displayName: string) => Promise<AuthResult & { needsVerification?: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
  /** Đăng ký listener auth; trả về hàm hủy. Idempotent. */
  init: () => () => void;
}

let initDone = false;
let unsubscribe: (() => void) | null = null;

async function ensureProfile(user: User): Promise<Profile | null> {
  // Trigger handle_new_user của DB đã tạo sẵn row profiles; ở đây chỉ đọc + bổ sung tên.
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error || !data) return null;
  const profile = data as Profile;
  const metaName = (user.user_metadata?.display_name as string | undefined)?.trim();
  if (metaName && !profile.display_name) {
    const { data: updated } = await supabase
      .from('profiles')
      .update({ display_name: metaName })
      .eq('id', user.id)
      .select()
      .single();
    if (updated) return updated as Profile;
  }
  return profile;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  init: () => {
    if (initDone) return () => unsubscribe?.();
    initDone = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user ?? null;
      const profile = user ? await ensureProfile(user) : null;
      set({ user, profile, loading: false, initialized: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      const profile = user ? await ensureProfile(user) : null;
      set({ user, profile, loading: false, initialized: true });
    });
    unsubscribe = () => sub.subscription.unsubscribe();
    return () => unsubscribe?.();
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      set({ loading: false });
      return { ok: false, error: viAuthError(error.message) };
    }
    const profile = data.user ? await ensureProfile(data.user) : null;
    set({ user: data.user, profile, loading: false });
    return { ok: true };
  },

  signUp: async (email, password, displayName) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (error) {
      set({ loading: false });
      return { ok: false, error: viAuthError(error.message) };
    }
    // Nếu project bật "Confirm email": session null → user phải bấm link xác minh.
    if (!data.session) {
      set({ loading: false });
      return { ok: true, needsVerification: true };
    }
    const profile = data.user ? await ensureProfile(data.user) : null;
    set({ user: data.user, profile, loading: false });
    return { ok: true };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },

  sendPasswordReset: async (email) => {
    const redirectTo = `${window.location.origin}/dat-lai-mat-khau`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { ok: false, error: viAuthError(error.message) };
    return { ok: true };
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: viAuthError(error.message) };
    return { ok: true };
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    const profile = await ensureProfile(user);
    set({ profile });
  },
}));
