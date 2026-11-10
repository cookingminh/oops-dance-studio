import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { useRoleLabel } from '@/hooks/useRoleLabel';
import WorkspaceShell from '../admin-staff/components/common/WorkspaceShell';
import SideBar from '../admin-staff/components/sidebar/SideBar';
import TopBar from '../admin-staff/components/topbar/TopBar';
import Body from './components/body/Body';
import { PROFILE_NAV, findProfilePage } from './profilePages';
import MyDuesProvider from './dues/MyDuesProvider';
import { useMyDues } from './dues/myDuesContext';
import DuesBell from './dues/DuesBell';
import PayNudge from './dues/PayNudge';

// /profile for instructors and guests, in the same workspace shell as /admin. What they still have to
// pay (tuition, room bookings) shows as a bell in the top bar, badges in the menu and a daily reminder.
const ProfileShell = () => {
    const { role } = useAuth();
    const roleLabel = useRoleLabel();
    const badges = useMyDues().data?.counts ?? {};
    const findPage = (pathname) => findProfilePage(role, pathname);

    return (
        <WorkspaceShell
            className="profileShell"
            renderSideBar={(props) => (
                <SideBar
                    {...props}
                    sections={PROFILE_NAV[role] ?? []}
                    findPage={findPage}
                    badges={badges}
                    workspaceLabel={role === ROLES.instructor ? 'Instructor space' : `${roleLabel} space`}
                    ariaLabel="Profile menu"
                />
            )}
            renderTopBar={(props) => <TopBar {...props} findPage={findPage} settingsPath="/profile/my-profile" actions={<DuesBell />} />}
        >
            <Body />
            <PayNudge />
        </WorkspaceShell>
    );
};

const Instructor = () => (
    <MyDuesProvider>
        <ProfileShell />
    </MyDuesProvider>
);

export default Instructor;
