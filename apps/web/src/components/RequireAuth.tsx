import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { Spinner } from './ui';

/**
 * Bảo vệ route riêng tư (CONTRACT mục 11).
 * Chưa đăng nhập → chuyển về /dang-nhap (giữ lại đường dẫn để quay lại sau khi login).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, initialized } = useAuth();
  const location = useLocation();

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/dang-nhap" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

export default RequireAuth;
