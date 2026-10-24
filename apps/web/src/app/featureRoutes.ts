import type { RouteObject } from 'react-router-dom';

// COORDINATOR merge routes của các nhóm tính năng (CONTRACT mục 5 + 11).
import { editorRoutes } from '../features/editor/routes';
import { presentRoutes } from '../features/present/routes';
import { remoteRoutes } from '../features/remote/routes';
import { templateRoutes } from '../features/templates/routes';
import { backupRoutes } from '../features/backup/routes';
import { adminRoutes } from '../features/admin/routes';
import { helpRoutes } from '../features/help/routes';
import { simpleRoutes } from '../features/simple/simpleRoutes';

/**
 * Mọi routes tính năng được hợp nhất tại đây.
 * `src/app/router.tsx` dùng mảng này để dựng router chính.
 * Chú ý: nhóm templates export `templateRoutes` (không phải `templatesRoutes`).
 */
export const featureRoutes: RouteObject[] = [
  ...editorRoutes,
  ...presentRoutes,
  ...remoteRoutes,
  ...templateRoutes,
  ...backupRoutes,
  ...adminRoutes,
  ...helpRoutes,
  ...simpleRoutes,
];
