import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '../../components/RequireAuth';
import { OpenLatest } from './OpenLatest';
import { SimpleProgramList } from './SimpleProgramList';
import { SimpleProgramPage } from './SimpleProgramPage';
import { SimpleSectionEditor } from './SimpleSectionEditor';
import { LibraryPage } from './LibraryPage';

/**
 * Luồng đơn giản (mobile-first, nền tối): sau đăng nhập mở ngay chương trình
 * mới nhất (/bat-dau) → chương trình → sửa từng mục. Đây là toàn bộ giao diện
 * chính của ứng dụng.
 */
export const simpleRoutes: RouteObject[] = [
  {
    path: '/bat-dau',
    element: (
      <RequireAuth>
        <OpenLatest />
      </RequireAuth>
    ),
  },
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
  {
    path: '/thu-vien',
    element: (
      <RequireAuth>
        <LibraryPage />
      </RequireAuth>
    ),
  },
];
