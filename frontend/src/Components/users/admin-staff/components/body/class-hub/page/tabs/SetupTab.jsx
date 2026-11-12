import { useEffect, useRef, useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuAlertTriangle, LuCalendarClock, LuImage, LuPencil, LuPlus, LuSettings2, LuTrash2 } from 'react-icons/lu';
import { deleteSchedule } from '@/services/schedules';
import { formatTime } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import SectionCard from '../../../../common/SectionCard';
import ScheduleForm from '../../../class-manager/components/schedules/ScheduleForm';
import { ClassImage } from '../../HubParts';
import { bySlot, weeklySlots } from '../../hubModel';
import DetailsForm from '../setup/DetailsForm';
import EndClassPanel from '../setup/EndClassPanel';
import TimetablePhotoCard from '../setup/TimetablePhotoCard';

// Setup: details, weekly sessions, the pictures on the website (image, timetable photo) — and the danger zone
// (end / reopen / delete).
// ?end=1 scrolls to the danger zone (the header's "End class").
const SetupTab = ({ ctx }) => {
    const { cls, today, badge, instructors, rooms, venues, history, canDelete, changed, params, openImage, reopen, remove } = ctx;
    const { t, tn, dayName } = useI18n();
    const toast = useToast();
    const ended = badge.phase === 'ended';
    const [session, setSession] = useState(undefined); // undefined = closed, null = new, or a schedule
    const dangerRef = useRef(null);
    const wantsEnd = params.get('end') === '1';

    useEffect(() => {
        if (!wantsEnd) return undefined;
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timer = setTimeout(() => dangerRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' }), 350);
        return () => clearTimeout(timer);
    }, [wantsEnd]);

    const slots = [...(cls.schedules ?? [])].sort(bySlot);

    const removeSlot = async (slot) => {
        if (!window.confirm(t('Delete {name}’s {day} {time} session?', { name: cls.name, day: dayName(slot.day_of_week), time: formatTime(slot.start_time) }))) return;
        try {
            await deleteSchedule(slot.id);
            toast.success('Schedule deleted.');
            changed();
        } catch (error) {
            toast.error(error);
        }
    };

    const blockers = history
        ? [
            history.sessions && tn(history.sessions, '{count} taught session', '{count} taught sessions'),
            history.marks && tn(history.marks, '{count} roll-call mark', '{count} roll-call marks'),
            history.payments && tn(history.payments, '{count} payment', '{count} payments'),
        ].filter(Boolean)
        : [];

    return (
        <>
            <SectionCard icon={LuSettings2} title={t('Details')} subtitle={ended ? t('An ended class can’t be edited. Reopen it first.') : t('Name, instructor, where it’s taught, price, start date and level')}>
                <DetailsForm key={`${cls.id}-${cls.updated_at ?? ''}-${cls.name}-${cls.price}-${cls.room_id}-${cls.venue_id}-${cls.instructor_id}-${cls.starts_on}`} cls={cls} today={today} instructors={instructors} rooms={rooms} venues={venues} readOnly={ended} onSaved={changed} />
            </SectionCard>

            <div className="hubTrio">
                <SectionCard
                    icon={LuCalendarClock}
                    title={t('Weekly sessions')}
                    subtitle={ended ? t('Kept from when the class ended') : tn(slots.length, '{count} session a week', '{count} sessions a week')}
                    actions={
                        !ended && (
                            <Button variant="flat" startContent={<LuPlus aria-hidden="true" />} onPress={() => setSession(null)}>
                                {t('Add session')}
                            </Button>
                        )
                    }
                >
                    <ul className="hubSlotList">
                        {(ended ? weeklySlots(cls) : slots).map((slot) => (
                            <li key={slot.id ?? `${slot.day_of_week}-${slot.start_time}`} className="hubSlotItem">
                                <strong>{dayName(slot.day_of_week)}</strong>
                                <span>
                                    {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                                </span>
                                {!ended && (
                                    <span className="hubSlotActions">
                                        <Button isIconOnly size="sm" variant="light" aria-label={t('Edit the {day} session', { day: dayName(slot.day_of_week) })} onPress={() => setSession(slot)}>
                                            <LuPencil />
                                        </Button>
                                        <Button isIconOnly size="sm" variant="light" aria-label={t('Remove the {day} session', { day: dayName(slot.day_of_week) })} onPress={() => removeSlot(slot)}>
                                            <LuTrash2 />
                                        </Button>
                                    </span>
                                )}
                            </li>
                        ))}
                        {slots.length === 0 && !ended && <li className="hubSlotItem isEmpty">{t('No weekly sessions yet')}</li>}
                    </ul>
                </SectionCard>

                <SectionCard
                    icon={LuImage}
                    title={t('Image')}
                    subtitle={t('Shown on the website and in the directory')}
                    actions={
                        <Button variant="flat" startContent={<LuImage aria-hidden="true" />} onPress={openImage}>
                            {cls.image_path ? t('Change image') : t('Add an image')}
                        </Button>
                    }
                >
                    <ClassImage cls={cls} className="isPreview" />
                </SectionCard>

                <TimetablePhotoCard cls={cls} onChanged={changed} />
            </div>

            <div ref={dangerRef}>
                <SectionCard icon={LuAlertTriangle} title={t('Danger zone')} subtitle={t('Ending, reopening or deleting the class')} className="hubDangerCard">
                    <EndClassPanel cls={cls} today={today} phase={badge.phase} onChanged={changed} onReopen={reopen} />
                    <div className="hubDelete">
                        {canDelete ? (
                            <>
                                <div>
                                    <strong>{t('Delete this class')}</strong>
                                    <p className="hubHint">{t('Only for a class created by mistake: it has no sessions taught, roll calls or payments yet.')}</p>
                                </div>
                                <Button color="danger" variant="light" startContent={<LuTrash2 aria-hidden="true" />} onPress={remove}>
                                    {t('Delete class')}
                                </Button>
                            </>
                        ) : (
                            <div>
                                <strong>{t('This class can’t be deleted')}</strong>
                                <p className="hubHint">
                                    {blockers.length
                                        ? t('It has history ({items}). End it instead: everything stays on record.', { items: blockers.join(', ') })
                                        : t('Checking its history…')}
                                </p>
                            </div>
                        )}
                    </div>
                </SectionCard>
            </div>

            {session !== undefined && (
                <ScheduleForm
                    schedule={session ? { ...session, class_id: cls.id } : null}
                    defaultClassId={cls.id}
                    classes={[cls]}
                    onClose={() => setSession(undefined)}
                    onSaved={() => {
                        setSession(undefined);
                        changed();
                    }}
                />
            )}
        </>
    );
};

export default SetupTab;
