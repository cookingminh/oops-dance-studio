import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { NextUIProvider } from '@nextui-org/react';
import { useI18n } from '@/i18n/i18nContext';
import { AuthProvider } from '@/auth/AuthProvider';
import RequireRole from '@/auth/RequireRole';
import PublicOnly from '@/auth/PublicOnly';
import { DASHBOARD_ROLES, PROFILE_ROLES } from '@/auth/roles';
import { ToastProvider } from '@/ui/feedback/ToastProvider';
import { Loading } from '@/ui/feedback/AsyncState';
import DemoBanner from '@/ui/DemoBanner';
import { I18nProvider } from '@/i18n/I18nProvider';
import PublicLayout from './Components/HomePage/PublicLayout';
import HomeLanding from './Components/HomePage/pages/HomeLanding';

// The public landing page loads eagerly; the other pages and areas are split into their own chunks.
const ClassesPage = lazy(() => import('./Components/HomePage/pages/ClassesPage'));
const RoomsPage = lazy(() => import('./Components/HomePage/pages/RoomsPage'));
const AboutPage = lazy(() => import('./Components/HomePage/pages/AboutPage'));
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
            <Route element={<PublicLayout />}>
                <Route path="/home" element={<HomeLanding />} />
                <Route path="/classes" element={<ClassesPage />} />
                <Route path="/rooms" element={<RoomsPage />} />
                <Route path="/about" element={<AboutPage />} />
            </Route>
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

// NextUI links (e.g. DropdownItem href) navigate through React Router instead of reloading the page;
// date inputs follow the chosen language (dd/mm/yyyy, not the browser's US order).
const RouterAwareUI = ({ children }) => {
    const navigate = useNavigate();
    const { intl } = useI18n();
    return (
        <NextUIProvider navigate={navigate} locale={intl}>
            {children}
        </NextUIProvider>
    );
};

const App = () => (
    <I18nProvider>
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
    </I18nProvider>
);

export default App;
