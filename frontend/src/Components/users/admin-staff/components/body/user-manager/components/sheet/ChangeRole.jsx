import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button, Checkbox } from '@nextui-org/react';
import { LuArrowLeft, LuInfo, LuShieldAlert } from 'react-icons/lu';
import { setRole } from '@/services/users';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { KINDS } from '../../peopleModel';
import RoleCards from '../RoleCards';

const reveal = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.25 } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.15 } },
};

// Change someone's role (admin_set_role). Each choice says which pages it opens; making someone an
// admin needs one more confirmation. Changes the database would refuse (last admin, an instructor who
// still teaches) are explained up front instead.
const ChangeRole = ({ person, people, onCancel, onSaved }) => {
    const { t, tn } = useI18n();
    const toast = useToast();
    const [role, setRoleChoice] = useState(person.role);
    const [trusted, setTrusted] = useState(false);
    const [saving, setSaving] = useState(false);

    const promotingToAdmin = role === 'admin' && person.role !== 'admin';
    const otherAdmins = people.filter((p) => p.role === 'admin' && p.id !== person.id).length;
    let blocker = null;
    if (role !== person.role && person.role === 'instructor' && person.teaches.length) {
        blocker = (
            <>
                {tn(person.teaches.length, '{name} still teaches {count} class. Give it to another instructor first.', '{name} still teaches {count} classes. Give them to another instructor first.', {
                    name: person.name,
                })}{' '}
                <Link to="/admin/classes">{t('Open Classes')}</Link>
            </>
        );
    } else if (role !== person.role && person.role === 'admin' && otherAdmins === 0) {
        blocker = t('{name} is the only admin. Make someone else an admin first.', { name: person.name });
    }
    const canSave = role !== person.role && !blocker && (!promotingToAdmin || trusted);

    // The name the new role will show: a guest in a class is a Student.
    const newLabel = t(KINDS[role === 'guest' ? (person.enrolments.length ? 'student' : 'guest') : role].label);

    const save = async () => {
        setSaving(true);
        try {
            await setRole(person.id, role);
            toast.success(t('{name} is now: {role}.', { name: person.name, role: newLabel }));
            onSaved();
        } catch (error) {
            toast.error(error.code === 'INVALID_STATE' ? 'This role change isn’t allowed: the user is the last admin or still teaches classes.' : error);
            setSaving(false);
        }
    };

    return (
        <div className="sheetForm">
            <div className="sheetBody">
                <div className="viewTitle">
                    <Button isIconOnly size="sm" variant="light" aria-label={t('Back')} onPress={onCancel}>
                        <LuArrowLeft />
                    </Button>
                    <h3>{t('Change role')}</h3>
                </div>
                <p className="viewIntro">{t('The role decides which pages {name} can open.', { name: person.name })}</p>
                <RoleCards name={`role-${person.id}`} value={role} onChange={setRoleChoice} notes={{ [person.role]: t('Current') }} label={t('Role')} autoFocus />

                <AnimatePresence initial={false}>
                    {blocker && (
                        <motion.p key="blocker" className="inlineNote isWarn" {...reveal}>
                            <LuInfo aria-hidden="true" />
                            <span>{blocker}</span>
                        </motion.p>
                    )}
                    {promotingToAdmin && (
                        <motion.div key="admin" className="revealBox" {...reveal}>
                            <div className="adminWarning">
                                <LuShieldAlert aria-hidden="true" />
                                <div>
                                    <strong>{t('Admins have full access')}</strong>
                                    <p>{t('{name} will be able to create and delete accounts, change anyone’s role and see everyone’s pay.', { name: person.name })}</p>
                                    <Checkbox size="sm" color="danger" isSelected={trusted} onValueChange={setTrusted}>
                                        {t('I trust {name} with full access', { name: person.name })}
                                    </Checkbox>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <div className="sheetFoot">
                <Button variant="light" onPress={onCancel} isDisabled={saving}>
                    {t('Cancel')}
                </Button>
                <Button color="danger" onPress={save} isLoading={saving} isDisabled={!canSave}>
                    {role === person.role ? t('Save role') : t('Change to {role}', { role: newLabel })}
                </Button>
            </div>
        </div>
    );
};

export default ChangeRole;
