import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Tab, Tabs } from '@nextui-org/react';
import { LuMusic, LuTrash2 } from 'react-icons/lu';
import { deleteClassLesson, setClassLesson } from '@/services/classes';
import { lessonState, monthLabel, nextMonth } from '@/lib/lessons';
import { useToast } from '@/ui/feedback/toastContext';

// Set the piece a class learns this month (or plan next month's), and see / clean up past months.
const LessonDialog = ({ cls, today, onClose, onSaved }) => {
    const toast = useToast();
    const { history, thisMonth } = lessonState(cls.lessons, today);
    const months = [thisMonth, nextMonth(thisMonth)];
    const titleFor = (month) => history.find((lesson) => lesson.month === month)?.title ?? '';

    const [month, setMonth] = useState(thisMonth);
    const [title, setTitle] = useState(titleFor(thisMonth));
    const [saving, setSaving] = useState(false);

    const pickMonth = (key) => {
        setMonth(key);
        setTitle(titleFor(key));
    };

    const save = async () => {
        setSaving(true);
        try {
            await setClassLesson({ classId: cls.id, month, title });
            toast.success(`Lesson saved for ${monthLabel(month)}.`);
            onSaved();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (lesson) => {
        if (!window.confirm(`Remove ${monthLabel(lesson.month, { withYear: true })}’s lesson “${lesson.title}”?`)) return;
        try {
            await deleteClassLesson(lesson.id);
            toast.success('Lesson removed.');
            onSaved({ keepOpen: true });
        } catch (error) {
            toast.error(error);
        }
    };

    const unchanged = title.trim() === titleFor(month);

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <span>Monthly lesson</span>
                    <span className="text-small font-normal text-default-500">{cls.name}</span>
                </ModalHeader>
                <ModalBody>
                    <Tabs aria-label="Month" color="danger" radius="full" selectedKey={month} onSelectionChange={pickMonth}>
                        {months.map((key, index) => (
                            <Tab key={key} title={index === 0 ? `${monthLabel(key)} · this month` : `${monthLabel(key)} · next month`} />
                        ))}
                    </Tabs>
                    <Input
                        autoFocus
                        label="Lesson"
                        placeholder="Song — Artist"
                        description="Just the piece the class learns this month, e.g. Super Shy — NewJeans."
                        maxLength={120}
                        startContent={<LuMusic className="text-default-400" aria-hidden="true" />}
                        value={title}
                        onValueChange={setTitle}
                    />

                    {history.length > 0 && (
                        <div className="mt-2">
                            <p className="text-tiny font-semibold uppercase tracking-wider text-default-400 mb-2">Lesson history</p>
                            <ul className="flex flex-col gap-1">
                                {history.map((lesson) => (
                                    <li key={lesson.id} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-default-50">
                                        <span className="w-24 shrink-0 text-small text-default-500">{monthLabel(lesson.month, { withYear: true })}</span>
                                        <span className="flex-1 min-w-0 truncate text-small font-medium">{lesson.title}</span>
                                        <Button isIconOnly size="sm" variant="light" aria-label={`Remove ${monthLabel(lesson.month)}’s lesson`} onPress={() => remove(lesson)}>
                                            <LuTrash2 className="text-default-400" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        Close
                    </Button>
                    <Button color="danger" onPress={save} isLoading={saving} isDisabled={!title.trim() || unchanged}>
                        Save lesson
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default LessonDialog;
