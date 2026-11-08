import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { StaffTasksContext, loadStaffTasks } from './staffTasks';

const REFRESH_EVERY_MS = 60_000;

// Loads the staff to-do list, refreshes it on every page change and once a minute, and lets
// pages refresh it right after an action (approve, mark attendance, …).
const StaffTasksProvider = ({ children }) => {
    const { pathname } = useLocation();
    const tasks = useAsync(loadStaffTasks, [pathname]);
    const { reload } = tasks;

    useEffect(() => {
        const timer = setInterval(reload, REFRESH_EVERY_MS);
        return () => clearInterval(timer);
    }, [reload]);

    return (
        <StaffTasksContext.Provider value={{ data: tasks.data, loading: tasks.loading, error: tasks.error, refresh: reload }}>
            {children}
        </StaffTasksContext.Provider>
    );
};

export default StaffTasksProvider;
