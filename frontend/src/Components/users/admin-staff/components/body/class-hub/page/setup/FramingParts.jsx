import { useId } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Slider } from '@nextui-org/react';
import { useI18n } from '@/i18n/i18nContext';
import './framing.scss';

// The shell both framing dialogs share (ClassImageDialog, TimetablePhotoDialog): the controls on the left, the
// live preview on the right (stacked on phones, controls first), Close / Save below. On a short screen the body
// scrolls and the footer stays.
// `kind` 'card' | 'disc' sizes the preview column.
export const FramingDialog = ({ kind, kicker, title, size = '4xl', saving, canSave, onSave, onClose, controls, previewTitle, preview }) => {
    const { t } = useI18n();
    const titleId = useId();
    const submit = (event) => {
        event.preventDefault();
        if (canSave && !saving) onSave();
    };
    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && !saving && onClose()}
            size={size}
            placement="center"
            scrollBehavior="inside"
            classNames={{ base: 'adminPortal frmDialog' }}
        >
            <ModalContent>
                <form onSubmit={submit} noValidate>
                    <ModalHeader className="frmHead">
                        <span className="frmKicker">{kicker}</span>
                        <span>{title}</span>
                    </ModalHeader>
                    <ModalBody className="frmBody">
                        <div className="frmControls">{controls}</div>
                        <section className={`frmPreview is-${kind}`} aria-labelledby={titleId}>
                            <h3 id={titleId} className="frmPreviewTitle">
                                {previewTitle}
                            </h3>
                            {preview}
                        </section>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose} isDisabled={saving}>
                            {t('Close')}
                        </Button>
                        <Button type="submit" color="danger" isLoading={saving} isDisabled={!canSave}>
                            {t('Save')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

// A labelled group of controls in the left column, with its own buttons (Reset) beside the title.
export const FramingGroup = ({ title, actions, children }) => {
    const titleId = useId();
    return (
        <div className="frmGroup" role="group" aria-labelledby={titleId}>
            <div className="frmGroupHead">
                <h4 id={titleId}>{title}</h4>
                {actions}
            </div>
            {children}
        </div>
    );
};

// One slider of a frame, its value shown as a percent; `note` explains why it is off.
export const FrameSlider = ({ label, value, onChange, min = 0, max = 100, isDisabled = false, note }) => {
    const noteId = useId();
    return (
        <div className="frmSlider">
            <Slider
                size="sm"
                color="danger"
                label={label}
                minValue={min}
                maxValue={max}
                step={1}
                value={value}
                onChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
                getValue={(current) => `${current}%`}
                isDisabled={isDisabled}
                aria-describedby={note ? noteId : undefined}
                classNames={{ label: 'frmSliderLabel', value: 'frmSliderValue' }}
            />
            {note && (
                <p id={noteId} className="frmNote">
                    {note}
                </p>
            )}
        </div>
    );
};
