import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { StaffTasksContext, loadStaffTasks } from './staffTasks';

const REFRESH_EVERY_MS = 60_000;

// Loads the staff to-do list, refreshes it on every page change, once a minute and when the tab
// comes back into view (a bank transfer may have arrived meanwhile), and lets pages refresh it
// right after an action (approve, mark attendance, record a payment, …).
const StaffTasksProvider = ({ children }) => {
    const { pathname } = useLocation();
    const tasks = useAsync(loadStaffTasks, [pathname]);
    const { reload } = tasks;
    const { data } = tasks;

    useEffect(() => {
        const timer = setInterval(reload, REFRESH_EVERY_MS);
        const onVisible = () => document.visibilityState === 'visible' && reload();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [reload]);

    return (
        <StaffTasksContext.Provider value={{ data, loading: tasks.loading, error: tasks.error, refresh: reload }}>
            {children}
        </StaffTasksContext.Provider>
    );
};

export default StaffTasksProvider;
