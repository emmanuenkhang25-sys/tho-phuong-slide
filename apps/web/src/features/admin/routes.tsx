import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '../../components/RequireAuth';
import { AdminPage } from './AdminPage';

export const adminRoutes: RouteObject[] = [
  {
    path: '/quan-tri',
    element: (
      <RequireAuth>
        <AdminPage />
      </RequireAuth>
    ),
  },
];
