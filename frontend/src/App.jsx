import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { NextUIProvider } from '@nextui-org/react';
import { AuthProvider } from '@/auth/AuthProvider';
import RequireRole from '@/auth/RequireRole';
import PublicOnly from '@/auth/PublicOnly';
import { DASHBOARD_ROLES, PROFILE_ROLES } from '@/auth/roles';
import { ToastProvider } from '@/ui/feedback/ToastProvider';
import { Loading } from '@/ui/feedback/AsyncState';
import DemoBanner from '@/ui/DemoBanner';
import HomePage from './Components/HomePage/HomePage';

// The homepage loads eagerly; the other areas are split into their own chunks.
const Login = lazy(() => import('./Components/Login/Login'));
const Register = lazy(() => import('./Components/Register/Register'));
const ResetPassword = lazy(() => import('./Components/ResetPassword/ResetPassword'));
const Admin = lazy(() => import('./Components/users/admin-staff/Admin'));
const Instructor = lazy(() => import('./Components/users/instructor-guest/Instructor'));

const PageLoading = () => (
    <div className="min-h-screen flex items-center">
        <Loading />
    </div>
);

const AppRoutes = () => (
    <Suspense fallback={<PageLoading />}>
        <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route element={<PublicOnly />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
            </Route>
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route
                path="/admin/*"
                element={
                    <RequireRole roles={DASHBOARD_ROLES}>
                        <Admin />
                    </RequireRole>
                }
            />
            <Route
                path="/profile/*"
                element={
                    <RequireRole roles={PROFILE_ROLES}>
                        <Instructor />
                    </RequireRole>
                }
            />
            <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
    </Suspense>
);

// NextUI links (e.g. DropdownItem href) navigate through React Router instead of reloading the page.
const RouterAwareUI = ({ children }) => {
    const navigate = useNavigate();
    return (
        <NextUIProvider navigate={navigate}>
            {children}
        </NextUIProvider>
    );
};

const App = () => (
    <BrowserRouter>
        <RouterAwareUI>
            <ToastProvider>
                <AuthProvider>
                    <AppRoutes />
                    <DemoBanner />
                </AuthProvider>
            </ToastProvider>
        </RouterAwareUI>
    </BrowserRouter>
);

export default App;
