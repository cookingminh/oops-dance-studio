import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import '../../admin.scss';

// Full-screen app shell shared by /admin and /profile: a sidebar (a drawer below 1024px), a
// sticky top bar and the scrolling page. A new page starts at the top with the drawer closed.
//   renderSideBar({ open, onClose })   renderTopBar({ onOpenMenu })
const WorkspaceShell = ({ renderSideBar, renderTopBar, className = '', children }) => {
    const { pathname } = useLocation();
    const mainRef = useRef(null);
    const [menuOpen, setMenuOpen] = useState(false);

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
            <div className={`adminShell ${className}`}>
                {renderSideBar({ open: menuOpen, onClose: () => setMenuOpen(false) })}
                <div className="adminMain" ref={mainRef}>
                    {renderTopBar({ onOpenMenu: () => setMenuOpen(true) })}
                    {children}
                </div>
            </div>
        </MotionConfig>
    );
};

export default WorkspaceShell;
