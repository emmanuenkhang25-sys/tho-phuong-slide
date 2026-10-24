import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '../../components/RequireAuth';
import { RemotePage } from './RemotePage';

export const remoteRoutes: RouteObject[] = [
  {
    path: '/dieu-khien',
    element: (
      <RequireAuth>
        <RemotePage />
      </RequireAuth>
    ),
  },
];
