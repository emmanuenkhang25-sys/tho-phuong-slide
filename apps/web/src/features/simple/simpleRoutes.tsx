import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '../../components/RequireAuth';
import { SimpleProgramList } from './SimpleProgramList';
import { SimpleProgramPage } from './SimpleProgramPage';
import { SimpleSectionEditor } from './SimpleSectionEditor';

/**
 * Luồng đơn giản (mobile-first): danh sách chương trình → chương trình →
 * sửa từng mục. Đây là luồng chính sau khi đăng nhập.
 * Trình biên tập nâng cao vẫn ở /chuong-trinh/:id.
 */
export const simpleRoutes: RouteObject[] = [
  {
    path: '/p',
    element: (
      <RequireAuth>
        <SimpleProgramList />
      </RequireAuth>
    ),
  },
  {
    path: '/p/:id',
    element: (
      <RequireAuth>
        <SimpleProgramPage />
      </RequireAuth>
    ),
  },
  {
    path: '/p/:id/muc/:sectionId',
    element: (
      <RequireAuth>
        <SimpleSectionEditor />
      </RequireAuth>
    ),
  },
];
