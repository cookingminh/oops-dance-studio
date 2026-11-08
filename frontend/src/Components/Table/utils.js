export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export const statusColorMap = {
    attend: 'success',
    completed: 'success',
    approved: 'primary',
    in_progress: 'primary',
    absent: 'danger',
    rejected: 'danger',
    cancelled: 'danger',
    pending: 'warning',
    waiting: 'secondary',
};
