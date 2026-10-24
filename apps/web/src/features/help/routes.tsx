import type { RouteObject } from 'react-router-dom';
import { HelpPage } from './HelpPage';

// Trang public — không cần đăng nhập.
export const helpRoutes: RouteObject[] = [{ path: '/huong-dan', element: <HelpPage /> }];
