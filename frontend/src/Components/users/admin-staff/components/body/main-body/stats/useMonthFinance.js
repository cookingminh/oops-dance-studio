import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { useAsync } from '@/hooks/useAsync';
import { getFinanceMonthly } from '@/services/finance';
import { getStudioToday } from '@/services/studio';

// Admins only (the finance report is admin-only): this month's finance_monthly row so far
// ({ revenue, profit, … }), as a useAsync state. Null for staff.
export function useMonthFinance() {
    const { role } = useAuth();
    const isAdmin = role === ROLES.admin;
    const state = useAsync(async () => {
        if (!isAdmin) return null;
        const month = `${(await getStudioToday()).slice(0, 7)}-01`;
        const [row] = await getFinanceMonthly(month, month);
        return row ?? null;
    }, [isAdmin]);
    return isAdmin ? state : null;
}
