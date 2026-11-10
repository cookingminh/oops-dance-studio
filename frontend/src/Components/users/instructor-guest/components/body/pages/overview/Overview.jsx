import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import GuestOverview from './GuestOverview';
import InstructorOverview from './InstructorOverview';

// /profile: the instructor's teaching day or the student's dance week.
const Overview = () => {
    const { role } = useAuth();
    return role === ROLES.instructor ? <InstructorOverview /> : <GuestOverview />;
};

export default Overview;
