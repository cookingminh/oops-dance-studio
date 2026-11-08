import { useState } from 'react';
import { Tooltip } from '@nextui-org/react';
import { useAuth } from '@/auth/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { deleteUser, listProfiles } from '@/services/users';
import { avatarUrl } from '@/services/storage';
import { formatDate } from '@/lib/format';
import { isLockedDemoAccount } from '@/lib/demo';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import TableTemplate from '../../../../../../Table/TableTemplate';
import { EditIcon } from '../../../../../../Table/EditIcon';
import { DeleteIcon } from '../../../../../../Table/DeleteIcon';
import EditUserForm from './EditUserForm';
import AddUserForm from './AddUserForm';

const INITIAL_VISIBLE_COLUMNS = ['username', 'name', 'contact_number', 'dob', 'role', 'actions'];

const columns = [
    { name: 'Username', uid: 'username', allowsSorting: true },
    { name: 'Full Name', uid: 'name', allowsSorting: true },
    { name: 'Contact Number', uid: 'contact_number' },
    { name: 'Date of birth', uid: 'dob', allowsSorting: true },
    { name: 'Role', uid: 'role', allowsSorting: true },
    { name: 'Actions', uid: 'actions' },
];

const AllUsers = () => {
    const { user } = useAuth();
    const toast = useToast();
    const profiles = useAsync(listProfiles, []);
    const [editing, setEditing] = useState(null);
    const [adding, setAdding] = useState(false);

    const handleDelete = async (profile) => {
        const label = profile.full_name || profile.email;
        if (!window.confirm(`Delete ${label}’s account? This permanently removes the user.`)) return;
        try {
            await deleteUser(profile.id);
            toast.success('User deleted.');
            profiles.reload();
        } catch (error) {
            toast.error(error);
        }
    };

    const rows = (profiles.data ?? []).map((profile) => ({
        id: profile.id,
        username: profile.username ?? '',
        name: profile.full_name,
        email: profile.email,
        user_avatar: avatarUrl(profile.avatar_path, profile.updated_at),
        dob: formatDate(profile.date_of_birth),
        role: profile.role,
        contact_number: profile.contact_number ?? '',
        actions: (
            <div className="relative flex items-center justify-center gap-2">
                <Tooltip content="Edit user">
                    <button type="button" aria-label="Edit user" className="text-lg text-gray-400 cursor-pointer active:opacity-50" onClick={() => setEditing(profile)}>
                        <EditIcon />
                    </button>
                </Tooltip>
                {profile.id !== user.id && !isLockedDemoAccount(profile.email) && (
                    <Tooltip color="danger" content="Delete user">
                        <button type="button" aria-label="Delete user" className="text-lg text-danger cursor-pointer active:opacity-50" onClick={() => handleDelete(profile)}>
                            <DeleteIcon />
                        </button>
                    </Tooltip>
                )}
            </div>
        ),
    }));

    return (
        <div className="allUserList sectionContainer">
            <div className="header">
                <h2>All Users</h2>
            </div>
            <AsyncState state={profiles} isEmpty={false}>
                <TableTemplate
                    ariaLabel="Users"
                    columns={columns}
                    data={rows}
                    initialVisibleColumns={INITIAL_VISIBLE_COLUMNS}
                    onAddNew={() => setAdding(true)}
                />
            </AsyncState>
            {editing && (
                <EditUserForm
                    profile={editing}
                    isSelf={editing.id === user.id}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        profiles.reload();
                    }}
                />
            )}
            {adding && (
                <AddUserForm
                    onClose={() => setAdding(false)}
                    onSaved={() => {
                        setAdding(false);
                        profiles.reload();
                    }}
                />
            )}
        </div>
    );
};

export default AllUsers;
