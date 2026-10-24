import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '../../components/RequireAuth';
import { BackupPage } from './BackupPage';

export const backupRoutes: RouteObject[] = [
  {
    path: '/sao-luu',
    element: (
      <RequireAuth>
        <BackupPage />
      </RequireAuth>
    ),
  },
];
