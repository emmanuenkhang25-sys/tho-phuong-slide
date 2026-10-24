import { Link } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui';

export function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <EmptyState
        icon="🔍"
        title="Không tìm thấy trang"
        message="Địa chỉ bạn truy cập không tồn tại hoặc đã bị di chuyển."
        action={
          <Link to="/dashboard">
            <Button>Về trang Tổng quan</Button>
          </Link>
        }
      />
    </div>
  );
}

export default NotFound;
