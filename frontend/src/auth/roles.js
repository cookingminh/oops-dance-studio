export const ROLES = {
    admin: 'admin',
    staff: 'staff',
    instructor: 'instructor',
    guest: 'guest',
};

// Admin and staff share the /admin dashboard; instructors and guests use /profile.
export const DASHBOARD_ROLES = [ROLES.admin, ROLES.staff];
export const PROFILE_ROLES = [ROLES.instructor, ROLES.guest];

export function homePathFor(role) {
    if (DASHBOARD_ROLES.includes(role)) return '/admin';
    if (PROFILE_ROLES.includes(role)) return '/profile';
    return '/home';
}

// Order used by role pickers.
export const ROLE_OPTIONS = [ROLES.guest, ROLES.instructor, ROLES.staff, ROLES.admin];
