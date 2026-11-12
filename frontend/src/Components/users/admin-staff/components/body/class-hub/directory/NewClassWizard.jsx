import { Fragment, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuCheck, LuImagePlus, LuPartyPopper, LuUserPlus } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { createClass, saveRoutine, setClassImage } from '@/services/classes';
import { createSchedule, deleteSchedule } from '@/services/schedules';
import { listInstructors } from '@/services/users';
import { listRooms } from '@/services/rooms';
import { listVenues } from '@/services/venues';
import { placeColumns } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import ImagePicker from '@/ui/ImagePicker';
import { EASE_OUT } from '../../../common/motion';
import { DetailsStep, RoutineStep, SessionsStep } from './WizardSteps';
import { detailProblems, routineValid } from './wizardModel';

const STEPS = ['Details', 'Weekly sessions', 'First routine', 'Image', 'Done'];

const slide = {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT } },
    exit: { opacity: 0, x: -24, transition: { duration: 0.16 } },
};

// "New class" in steps. The class is created after step 1, so each later step saves straight away
// (a session that clashes with the room is reported at once) and closing early keeps what was
// done. The last step opens the new class's page to add students.
const NewClassWizard = ({ today, onClose, onCreated, onOpen }) => {
    const { t, tn, formatDate } = useI18n();
    const toast = useToast();
    const instructors = useAsync(listInstructors, []);
    const rooms = useAsync(listRooms, []);
    const venues = useAsync(listVenues, []);

    const [step, setStep] = useState(0);
    const [form, setForm] = useState({ name: '', instructorId: '', place: '', price: '', startsOn: today ?? '' });
    const [tried, setTried] = useState(false);
    const [created, setCreated] = useState(null);
    const [slots, setSlots] = useState([]);
    const [slotError, setSlotError] = useState('');
    const [routine, setRoutine] = useState({ title: '', sessions: '8', price: '' });
    const [savedRoutine, setSavedRoutine] = useState(null);
    const [image, setImage] = useState(null);
    const [busy, setBusy] = useState(false);

    const problems = detailProblems(form, today);
    const next = () => setStep((value) => value + 1);

    const close = () => {
        if (created) onCreated();
        onClose();
    };

    const createIt = async () => {
        setTried(true);
        if (Object.values(problems).some(Boolean)) return;
        setBusy(true);
        try {
            const cls = await createClass({ ...form, ...placeColumns(form.place) });
            setCreated(cls);
            toast.success(t('{name} created.', { name: cls.name }));
            next();
        } catch (error) {
            toast.error(error.code === 'DUPLICATE' ? 'A class with this name already exists.' : error);
        } finally {
            setBusy(false);
        }
    };

    // True when the session was added (the form then clears).
    const addSlot = async (fields) => {
        setBusy(true);
        setSlotError('');
        try {
            const slot = await createSchedule({ classId: created.id, ...fields });
            setSlots((old) => [...old, slot]);
            return true;
        } catch (error) {
            setSlotError(
                error.code === 'SLOT_TAKEN' && error.detail
                    ? t('That time isn’t free in this class’s room: {detail}.', { detail: error.detail })
                    : t(error.message)
            );
            return false;
        } finally {
            setBusy(false);
        }
    };

    const removeSlot = async (slot) => {
        setBusy(true);
        try {
            await deleteSchedule(slot.id);
            setSlots((old) => old.filter((item) => item.id !== slot.id));
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(false);
        }
    };

    const saveFirstRoutine = async () => {
        setBusy(true);
        try {
            const saved = await saveRoutine({
                classId: created.id,
                title: routine.title,
                startsOn: created.starts_on,
                sessionCount: Number(routine.sessions),
                price: routine.price,
            });
            setSavedRoutine(saved);
            next();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(false);
        }
    };

    const uploadImage = async () => {
        setBusy(true);
        try {
            setCreated(await setClassImage(created, image));
            next();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(false);
        }
    };

    const footers = [
        <Fragment key="0">
            <Button variant="light" onPress={close} isDisabled={busy}>
                {t('Cancel')}
            </Button>
            <Button color="danger" onPress={createIt} isLoading={busy}>
                {t('Create class')}
            </Button>
        </Fragment>,
        <Fragment key="1">
            <Button color="danger" onPress={next} isDisabled={busy}>
                {slots.length ? t('Next') : t('Skip for now')}
            </Button>
        </Fragment>,
        <Fragment key="2">
            <Button variant="light" onPress={next} isDisabled={busy}>
                {t('Skip for now')}
            </Button>
            <Button color="danger" onPress={saveFirstRoutine} isLoading={busy} isDisabled={!routineValid(routine)}>
                {t('Save routine')}
            </Button>
        </Fragment>,
        <Fragment key="3">
            <Button variant="light" onPress={next} isDisabled={busy}>
                {t('Skip for now')}
            </Button>
            <Button color="danger" onPress={uploadImage} isLoading={busy} isDisabled={!image} startContent={busy ? null : <LuImagePlus aria-hidden="true" />}>
                {t('Upload image')}
            </Button>
        </Fragment>,
        <Fragment key="4">
            <Button variant="light" onPress={close}>
                {t('Close')}
            </Button>
            <Button color="danger" startContent={<LuUserPlus aria-hidden="true" />} onPress={() => {
                onCreated();
                onOpen(created.id);
            }}>
                {t('Add students')}
            </Button>
        </Fragment>,
    ];

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && close()}
            size="2xl"
            placement="center"
            scrollBehavior="inside"
            isDismissable={!busy}
            classNames={{ base: 'hubDialog adminPortal' }}
        >
            <ModalContent>
                <ModalHeader className="hubWizardHead">
                    <span className="hubWizardKicker">{created ? created.name : t('New class')}</span>
                    <ol className="hubSteps" aria-label={t('Steps')}>
                        {STEPS.map((label, index) => (
                            <li key={label} className={index < step ? 'isDone' : index === step ? 'isCurrent' : ''} aria-current={index === step ? 'step' : undefined}>
                                <span className="hubStepDot" aria-hidden="true">
                                    {index < step ? <LuCheck /> : index + 1}
                                </span>
                                <span className="hubStepLabel">{t(label)}</span>
                            </li>
                        ))}
                    </ol>
                </ModalHeader>
                <ModalBody>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={step} {...slide}>
                            {step === 0 && (
                                <DetailsStep
                                    form={form}
                                    onChange={setForm}
                                    instructors={instructors.data ?? []}
                                    rooms={rooms.data ?? []}
                                    venues={venues.data ?? []}
                                    today={today}
                                    problems={problems}
                                    tried={tried}
                                />
                            )}
                            {step === 1 && <SessionsStep slots={slots} busy={busy} error={slotError} onAdd={addSlot} onRemove={removeSlot} />}
                            {step === 2 && <RoutineStep routine={routine} onChange={setRoutine} startsOn={created.starts_on} price={created.price} />}
                            {step === 3 && (
                                <div className="hubWizardStack">
                                    <p className="hubHint">{t('A photo makes the class easy to spot on the website and in the directory.')}</p>
                                    <ImagePicker label={t('Choose an image')} color="default" onChange={setImage} isDisabled={busy} />
                                </div>
                            )}
                            {step === 4 && (
                                <div className="hubWizardDone">
                                    <span className="hubDoneIcon" aria-hidden="true">
                                        <LuPartyPopper />
                                    </span>
                                    <h3>{t('{name} is ready', { name: created.name })}</h3>
                                    <ul>
                                        <li>{t('Starts on {date}', { date: formatDate(created.starts_on, 'long') })}</li>
                                        <li>{slots.length ? tn(slots.length, '{count} weekly session', '{count} weekly sessions') : t('No weekly sessions yet')}</li>
                                        <li>{savedRoutine ? t('First routine: {title}', { title: savedRoutine.title }) : t('No routine yet')}</li>
                                    </ul>
                                    <p className="hubHint">{t('Next, add its students. They are billed for the course they join.')}</p>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </ModalBody>
                <ModalFooter>{footers[step]}</ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default NewClassWizard;
