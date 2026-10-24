import { BrowserRouter, useRoutes, type RouteObject } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Layout } from '../components/Layout';
import { RequireAuth } from '../components/RequireAuth';
import { Landing } from '../pages/Landing';
import { DangNhap } from '../pages/DangNhap';
import { DangKy } from '../pages/DangKy';
import { QuenMatKhau } from '../pages/QuenMatKhau';
import { DatLaiMatKhau } from '../pages/DatLaiMatKhau';
import { LoiMoi } from '../pages/LoiMoi';
import { HoiThanh } from '../pages/HoiThanh';
import { CaiDat } from '../pages/CaiDat';
import { NotFound } from '../pages/NotFound';
import { featureRoutes } from './featureRoutes';

function inLayout(el: ReactNode): RouteObject {
  return {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [{ index: true, element: el }],
  };
}

const coreRoutes: RouteObject[] = [
  { path: '/', element: <Landing /> },
  { path: '/dang-nhap', element: <DangNhap /> },
  { path: '/dang-ky', element: <DangKy /> },
  { path: '/quen-mat-khau', element: <QuenMatKhau /> },
  { path: '/dat-lai-mat-khau', element: <DatLaiMatKhau /> },
  { path: '/loi-moi', element: <LoiMoi /> },
  { path: '/hoi-thanh', ...inLayout(<HoiThanh />) },
  { path: '/cai-dat', ...inLayout(<CaiDat />) },
  { path: '*', element: <NotFound /> },
];

function AppRoutes() {
  // featureRoutes đã được COORDINATOR merge: editor, present, remote, templates, backup, admin, help.
  return useRoutes([...coreRoutes, ...featureRoutes]);
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
