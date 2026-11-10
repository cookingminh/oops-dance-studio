import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, Button, Modal, ModalContent } from '@nextui-org/react';
import { LuHistory, LuKeyRound, LuPencil, LuUserCog, LuX } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { getPersonActivity } from '@/services/people';
import { requestPasswordReset } from '@/services/auth';
import { avatarUrl } from '@/services/storage';
import { isLockedDemoAccount } from '@/lib/demo';
import { nextMonth } from '@/lib/lessons';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import LinkButton from '@/ui/LinkButton';
import { EASE_OUT } from '../../../../common/motion';
import { activityPath } from '../../../activity/activityLinks';
import RoleChip from '../RoleChip';
import PersonProfile from './PersonProfile';
import EditDetails from './EditDetails';
import ChangeRole from './ChangeRole';

// The sheet slides in from the right (full screen on phones). NextUI's Modal gives it the focus
// trap, Escape, scroll lock and dialog semantics.
const SHEET_MOTION = {
    variants: {
        enter: { x: 0, opacity: 1, transition: { x: { duration: 0.38, ease: EASE_OUT }, opacity: { duration: 0.2 } } },
        exit: { x: 56, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
    },
};

// Sub-views slide sideways: forward into a form, back to the profile.
const viewMotion = (forward) => ({
    initial: { opacity: 0, x: forward ? 24 : -24 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: EASE_OUT } },
    exit: { opacity: 0, x: forward ? -24 : 24, transition: { duration: 0.15 } },
});

// One person: contact details, classes, activity and the account actions (edit, role, password,
// delete). Edits happen inside the sheet, so there is never a dialog on top of a dialog.
const PersonSheet = ({ person, people, isSelf, today, month, intent, onClose, onChanged, onDeleted }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const [view, setView] = useState('profile'); // 'profile' | 'edit' | 'role'
    const [focusField, setFocusField] = useState(null);
    const [sendingReset, setSendingReset] = useState(false);
    const activity = useAsync(
        () => (month ? getPersonActivity(person, { month, nextMonth: nextMonth(month) }) : Promise.resolve(undefined)),
        [person.id, person.role, month]
    );
    const lockedDemo = isLockedDemoAccount(person.email);

    const sameYear = person.joined?.slice(0, 4) === today?.slice(0, 4);
    const joined = person.joined ? formatDate(person.joined, sameYear ? 'dayMonth' : 'monthYear') : '';

    // The form opens with the cursor in the field that needs filling (the name by default).
    const openEdit = (field = 'name') => {
        setFocusField(field);
        setView('edit');
    };

    const sendReset = async () => {
        setSendingReset(true);
        try {
            await requestPasswordReset(person.email);
            toast.success(t('Password reset email sent to {email}.', { email: person.email }));
        } catch (error) {
            toast.error(error);
        } finally {
            setSendingReset(false);
        }
    };

    const afterSave = () => {
        setView('profile');
        onChanged();
        activity.reload();
    };

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            size="full"
            scrollBehavior="inside"
            hideCloseButton
            // A stray click outside shouldn't throw away a half-filled form.
            isDismissable={view === 'profile'}
            motionProps={SHEET_MOTION}
            classNames={{ wrapper: 'personSheetWrap', base: 'personSheet adminPortal', backdrop: 'personSheetBackdrop' }}
        >
            {/* Plain header and body (not ModalHeader / ModalBody): the dialog is named after the person
                only, instead of every text and button in the header and body. */}
            <ModalContent aria-label={person.name}>
                <div className="sheetHead">
                    <div className="sheetIdentity">
                        <Avatar {...AVATAR_DEFAULTS} className="sheetAvatar" src={avatarUrl(person.avatar_path, person.updated_at) ?? undefined} name={person.name} />
                        <div className="sheetTitles">
                            <h2>{person.name}</h2>
                            <p>
                                {person.username && <span>@{person.username}</span>}
                                <RoleChip kind={person.kind} />
                                {isSelf && <span className="youTag">{t('You')}</span>}
                            </p>
                            {joined && <small>{t('Member since {date}', { date: joined })}</small>}
                        </div>
                        <Button isIconOnly variant="light" radius="full" className="sheetClose" aria-label={t('Close')} onPress={onClose}>
                            <LuX />
                        </Button>
                    </div>
                    {view === 'profile' && (
                        <div className="sheetActions">
                            <Button size="sm" variant="flat" startContent={<LuPencil aria-hidden="true" />} onPress={() => openEdit()}>
                                {t('Edit details')}
                            </Button>
                            {!isSelf && (
                                <Button size="sm" variant="flat" startContent={<LuUserCog aria-hidden="true" />} onPress={() => setView('role')}>
                                    {t('Change role')}
                                </Button>
                            )}
                            {!lockedDemo && (
                                <Button size="sm" variant="flat" startContent={<LuKeyRound aria-hidden="true" />} isLoading={sendingReset} onPress={sendReset}>
                                    {t('Send password reset')}
                                </Button>
                            )}
                            {/* Guests and students: what happened to them; everyone else: what they did. */}
                            <LinkButton
                                size="sm"
                                variant="flat"
                                startContent={<LuHistory aria-hidden="true" />}
                                to={activityPath(person.role === 'guest' ? { subject: person.id } : { person: person.id })}
                            >
                                {t('See activity')}
                            </LinkButton>
                        </div>
                    )}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={view} className="sheetView" {...viewMotion(view !== 'profile')}>
                        {view === 'profile' && (
                            <PersonProfile
                                person={person}
                                people={people}
                                isSelf={isSelf}
                                lockedDemo={lockedDemo}
                                today={today}
                                activity={activity}
                                startEnrolling={intent === 'enrol'}
                                onEdit={openEdit}
                                onChanged={() => {
                                    onChanged();
                                    activity.reload();
                                }}
                                onDeleted={onDeleted}
                            />
                        )}
                        {view === 'edit' && (
                            <EditDetails person={person} lockedDemo={lockedDemo} focusField={focusField} onCancel={() => setView('profile')} onSaved={afterSave} />
                        )}
                        {view === 'role' && <ChangeRole person={person} people={people} onCancel={() => setView('profile')} onSaved={afterSave} />}
                    </motion.div>
                </AnimatePresence>
            </ModalContent>
        </Modal>
    );
};

export default PersonSheet;
