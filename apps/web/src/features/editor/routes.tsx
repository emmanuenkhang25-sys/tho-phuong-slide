// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// routes.tsx — routes của tính năng editor (CONTRACT mục 6).
// COORDINATOR merge vào src/app/router.tsx qua featureRoutes.
// ============================================================
import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '../../components/RequireAuth';
import { EditorPage } from './EditorPage';

export const editorRoutes: RouteObject[] = [
  {
    path: '/chuong-trinh/:id',
    element: (
      <RequireAuth>
        <EditorPage />
      </RequireAuth>
    ),
  },
];
