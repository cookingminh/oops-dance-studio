import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import SideBar from './components/sidebar/SideBar';
import TopBar from './components/topbar/TopBar';
import TaskBell from './components/topbar/TaskBell';
import Body from './components/body/Body';
import StaffTasksProvider from './tasks/StaffTasksProvider';
import { useStaffTasks } from './tasks/staffTasks';
import { ADMIN_NAV, findAdminPage } from './adminPages';
import WorkspaceShell from './components/common/WorkspaceShell';

// The admin sidebar: staff don't see admin-only pages; to-do counts show as badges.
const AdminSideBar = (props) => {
    const { role } = useAuth();
    const badges = useStaffTasks().data?.counts ?? {};
    const sections = ADMIN_NAV.map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.adminOnly || role === ROLES.admin),
    })).filter((section) => section.items.length > 0);
    return (
        <SideBar
            {...props}
            sections={sections}
            findPage={findAdminPage}
            badges={badges}
            workspaceLabel={`${role === ROLES.admin ? 'Admin' : 'Staff'} workspace`}
            ariaLabel="Admin menu"
        />
    );
};

const Admin = () => (
    <StaffTasksProvider>
        <WorkspaceShell
            renderSideBar={(props) => <AdminSideBar {...props} />}
            renderTopBar={(props) => <TopBar {...props} findPage={findAdminPage} settingsPath="/admin/settings" actions={<TaskBell />} />}
        >
            <Body />
        </WorkspaceShell>
    </StaffTasksProvider>
);

export default Admin;
