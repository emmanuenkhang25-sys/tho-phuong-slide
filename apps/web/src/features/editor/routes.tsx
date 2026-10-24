// ============================================================
// Thờ Phượng Slide — nhóm EDITOR
// routes.tsx — routes của tính năng editor (CONTRACT mục 6).
// COORDINATOR merge vào src/app/router.tsx qua featureRoutes.
// ============================================================
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '../../components/RequireAuth';

// Trình soạn thảo cũ không còn dùng trong giao diện đơn giản — tải lười để
// code của nó (kèm html2canvas) không nằm trong gói chính làm chậm lần mở app.
const EditorPage = lazy(() =>
  import('./EditorPage').then((m) => ({ default: m.EditorPage })),
);

export const editorRoutes: RouteObject[] = [
  {
    path: '/chuong-trinh/:id',
    element: (
      <RequireAuth>
        <Suspense
          fallback={
            <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center bg-[#0e0f11] px-4 text-slate-200">
              Đang tải trình soạn thảo…
            </div>
          }
        >
          <EditorPage />
        </Suspense>
      </RequireAuth>
    ),
  },
];
