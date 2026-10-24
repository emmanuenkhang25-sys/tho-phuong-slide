import type { RouteObject } from 'react-router-dom';

// COORDINATOR merge routes của các nhóm tính năng (CONTRACT mục 5 + 11).
// Trình biên tập nâng cao (/chuong-trinh/:id) và thư viện mẫu (/mau-slide)
// đã gỡ khỏi giao diện — luồng chính là màn hình đơn giản nền tối (/bat-dau).
import { presentRoutes } from '../features/present/routes';
import { remoteRoutes } from '../features/remote/routes';
import { backupRoutes } from '../features/backup/routes';
import { adminRoutes } from '../features/admin/routes';
import { helpRoutes } from '../features/help/routes';
import { simpleRoutes } from '../features/simple/simpleRoutes';

/**
 * Mọi routes tính năng được hợp nhất tại đây.
 * `src/app/router.tsx` dùng mảng này để dựng router chính.
 */
export const featureRoutes: RouteObject[] = [
  ...presentRoutes,
  ...remoteRoutes,
  ...backupRoutes,
  ...adminRoutes,
  ...helpRoutes,
  ...simpleRoutes,
];
