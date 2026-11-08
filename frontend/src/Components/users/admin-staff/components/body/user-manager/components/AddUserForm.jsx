import { useState } from 'react';
import { Modal, Input, Button, ModalHeader, ModalBody, ModalFooter, ModalContent, Select, SelectItem } from '@nextui-org/react';
import { createUser } from '@/services/users';
import { ROLES, ROLE_OPTIONS } from '@/auth/roles';
import { useToast } from '@/ui/feedback/toastContext';
import DateField from '@/ui/DateField';

const MIN_PASSWORD_LENGTH = 8;

// Admin only: creates the auth user + profile through the admin-users Edge Function.
const AddUserForm = ({ onClose, onSaved }) => {
    const toast = useToast();
    const [form, setForm] = useState({
        email: '',
        password: '',
        fullName: '',
        role: ROLES.instructor,
        contactNumber: '',
        dateOfBirth: '',
    });
    const [saving, setSaving] = useState(false);
    const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));
    const passwordTooShort = form.password.length > 0 && form.password.length < MIN_PASSWORD_LENGTH;
    const canSave = form.email.trim() && form.fullName.trim() && form.password.length >= MIN_PASSWORD_LENGTH;

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await createUser(form);
            toast.success(`Account created for ${form.email}.`);
            onSaved();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen scrollBehavior="inside" onOpenChange={(open) => !open && onClose()}>
            <ModalContent>
                <ModalHeader>Add User</ModalHeader>
                <ModalBody>
                    <Input label="Email" type="email" isRequired value={form.email} onValueChange={set('email')} />
                    <Input
                        label="Temporary password"
                        type="password"
                        autoComplete="new-password"
                        isRequired
                        value={form.password}
                        onValueChange={set('password')}
                        isInvalid={passwordTooShort}
                        errorMessage={passwordTooShort ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
                        description="Share it with the user; they can change it in their profile settings."
                    />
                    <Input label="Full Name" isRequired value={form.fullName} onValueChange={set('fullName')} />
                    <Select label="Role" selectedKeys={[form.role]} onChange={(event) => event.target.value && set('role')(event.target.value)}>
                        {ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role} className="capitalize">{role}</SelectItem>
                        ))}
                    </Select>
                    <Input label="Contact Number" type="tel" value={form.contactNumber} onValueChange={set('contactNumber')} />
                    <DateField label="Date of Birth" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose} isDisabled={saving}>
                        Close
                    </Button>
                    <Button color="primary" onPress={handleSubmit} isLoading={saving} isDisabled={!canSave}>
                        Create User
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default AddUserForm;
