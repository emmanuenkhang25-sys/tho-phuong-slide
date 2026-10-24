import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '../../components/RequireAuth';
import { PresenterPage } from './PresenterPage';

export const presentRoutes: RouteObject[] = [
  {
    path: '/trinh-chieu/:id',
    element: (
      <RequireAuth>
        <PresenterPage />
      </RequireAuth>
    ),
  },
];
