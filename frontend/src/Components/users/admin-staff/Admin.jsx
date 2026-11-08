import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import SideBar from './components/sidebar/SideBar';
import TopBar from './components/topbar/TopBar';
import Body from './components/body/Body';
import StaffTasksProvider from './tasks/StaffTasksProvider';
import './admin.scss';

const Admin = () => {
    const { pathname } = useLocation();
    const mainRef = useRef(null);
    const [menuOpen, setMenuOpen] = useState(false);

    // A new page starts at the top, with the mobile menu closed.
    useEffect(() => {
        setMenuOpen(false);
        mainRef.current?.scrollTo({ top: 0 });
    }, [pathname]);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const onKeyDown = (event) => event.key === 'Escape' && setMenuOpen(false);
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [menuOpen]);

    return (
        <MotionConfig reducedMotion="user">
            <StaffTasksProvider>
                <div className="adminShell">
                    <SideBar open={menuOpen} onClose={() => setMenuOpen(false)} />
                    <div className="adminMain" ref={mainRef}>
                        <TopBar onOpenMenu={() => setMenuOpen(true)} />
                        <Body />
                    </div>
                </div>
            </StaffTasksProvider>
        </MotionConfig>
    );
};

export default Admin;
