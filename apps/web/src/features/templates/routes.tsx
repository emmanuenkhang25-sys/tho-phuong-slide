import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '../../components/RequireAuth';
import { TemplatesPage } from './TemplatesPage';

export const templateRoutes: RouteObject[] = [
  {
    path: '/mau-slide',
    element: (
      <RequireAuth>
        <TemplatesPage />
      </RequireAuth>
    ),
  },
];
