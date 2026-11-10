import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { useRoleLabel } from '@/hooks/useRoleLabel';
import WorkspaceShell from '../admin-staff/components/common/WorkspaceShell';
import SideBar from '../admin-staff/components/sidebar/SideBar';
import TopBar from '../admin-staff/components/topbar/TopBar';
import Body from './components/body/Body';
import { PROFILE_NAV, findProfilePage } from './profilePages';

// /profile for instructors and guests, in the same workspace shell as /admin.
const Instructor = () => {
    const { role } = useAuth();
    const roleLabel = useRoleLabel();
    const findPage = (pathname) => findProfilePage(role, pathname);

    return (
        <WorkspaceShell
            className="profileShell"
            renderSideBar={(props) => (
                <SideBar
                    {...props}
                    sections={PROFILE_NAV[role] ?? []}
                    findPage={findPage}
                    workspaceLabel={role === ROLES.instructor ? 'Instructor space' : `${roleLabel} space`}
                    ariaLabel="Profile menu"
                />
            )}
            renderTopBar={(props) => <TopBar {...props} findPage={findPage} settingsPath="/profile/my-profile" />}
        >
            <Body />
        </WorkspaceShell>
    );
};

export default Instructor;
