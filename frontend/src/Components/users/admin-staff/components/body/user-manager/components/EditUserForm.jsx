import { useState } from 'react';
import { Modal, Input, Button, ModalHeader, ModalBody, ModalFooter, ModalContent, Select, SelectItem } from '@nextui-org/react';
import { setRole, updateProfile, updateUserEmail } from '@/services/users';
import { ROLE_OPTIONS } from '@/auth/roles';
import { isLockedDemoAccount } from '@/lib/demo';
import { useToast } from '@/ui/feedback/toastContext';
import DateField from '@/ui/DateField';

// Admin only. Email changes go through the admin-users function (auth.users is the source).
const EditUserForm = ({ profile, isSelf, onClose, onSaved }) => {
    const toast = useToast();
    const lockedDemo = isLockedDemoAccount(profile.email);
    const [form, setForm] = useState({
        username: profile.username ?? '',
        full_name: profile.full_name ?? '',
        contact_number: profile.contact_number ?? '',
        date_of_birth: profile.date_of_birth ?? '',
        role: profile.role,
        email: profile.email,
    });
    const [saving, setSaving] = useState(false);
    const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await updateProfile(profile.id, form);
            if (form.email.trim() !== profile.email) await updateUserEmail(profile.id, form.email);
            if (form.role !== profile.role) await setRole(profile.id, form.role);
            toast.success('User updated.');
            onSaved();
        } catch (error) {
            if (error.code === 'DUPLICATE') toast.error('That username is already taken.');
            else if (error.code === 'INVALID_STATE' && form.role !== profile.role) {
                toast.error('This role change isn’t allowed: the user is the last admin or still teaches classes.');
            } else toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()}>
            <ModalContent>
                <ModalHeader>Edit User</ModalHeader>
                <ModalBody>
                    <Input
                        label="Email"
                        type="email"
                        value={form.email}
                        onValueChange={set('email')}
                        isReadOnly={lockedDemo}
                        description={lockedDemo
                            ? 'Demo accounts keep their email in the public demo.'
                            : 'Changes the login email immediately.'}
                    />
                    <Input label="Username" value={form.username} onValueChange={set('username')} />
                    <Input label="Full Name" value={form.full_name} onValueChange={set('full_name')} />
                    <Input label="Contact Number" type="tel" value={form.contact_number} onValueChange={set('contact_number')} />
                    <DateField label="Date of Birth" value={form.date_of_birth} onChange={set('date_of_birth')} />
                    <Select
                        label="Role"
                        selectedKeys={[form.role]}
                        onChange={(event) => event.target.value && set('role')(event.target.value)}
                        isDisabled={isSelf}
                        description={isSelf ? 'You can’t change your own role.' : undefined}
                    >
                        {ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role} className="capitalize">{role}</SelectItem>
                        ))}
                    </Select>
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose} isDisabled={saving}>
                        Close
                    </Button>
                    <Button color="primary" onPress={handleSubmit} isLoading={saving}>
                        Save Changes
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default EditUserForm;
