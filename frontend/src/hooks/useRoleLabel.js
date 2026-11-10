import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { countMyEnrolments } from '@/services/classes';

// The name shown for the signed-in user's role. In the database everyone who isn't staff or an
// instructor is a `guest`; once they are enrolled in a class we call them a Student.
const LABELS = { [ROLES.admin]: 'Admin', [ROLES.staff]: 'Staff', [ROLES.instructor]: 'Instructor' };

// One lookup per user per page load, shared by the top bar, sidebar and settings.
const enrolments = new Map();

export function useRoleLabel() {
    const { user, role } = useAuth();
    const [isStudent, setIsStudent] = useState(null);

    useEffect(() => {
        if (role !== ROLES.guest || !user?.id) return undefined;
        let active = true;
        if (!enrolments.has(user.id)) enrolments.set(user.id, countMyEnrolments(user.id).catch(() => 0));
        enrolments.get(user.id).then((count) => active && setIsStudent(count > 0));
        return () => {
            active = false;
        };
    }, [role, user?.id]);

    if (role !== ROLES.guest) return LABELS[role] ?? role ?? '';
    return isStudent ? 'Student' : 'Guest';
}
