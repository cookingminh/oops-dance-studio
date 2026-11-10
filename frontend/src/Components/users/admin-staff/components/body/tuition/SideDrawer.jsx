import { Button, Modal, ModalContent, ModalHeader } from '@nextui-org/react';
import { LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { EASE_OUT } from '../../common/motion';

// Slides in from the right (full screen on phones), like the activity log's drawer.
const DRAWER_MOTION = {
    variants: {
        enter: { x: 0, opacity: 1, transition: { x: { duration: 0.32, ease: EASE_OUT }, opacity: { duration: 0.18 } } },
        exit: { x: 48, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } },
    },
};

// A side drawer for the tuition page's less frequent work (transfer history, payment settings):
// an icon, a title and a line under it (they name the dialog), then its content. `id` is on its content.
const SideDrawer = ({ id, icon: Icon, title, subtitle, wide = false, onClose, children }) => {
    const { t } = useI18n();
    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            size="full"
            scrollBehavior="inside"
            hideCloseButton
            motionProps={DRAWER_MOTION}
            classNames={{ wrapper: 'tuDrawerWrap', base: `tuDrawer adminPortal${wide ? ' isWide' : ''}`, backdrop: 'tuDrawerBackdrop' }}
        >
            <ModalContent>
                {/* NextUI gives the dialog its own id: ours (#tuition-history, #tuition-settings) wraps the content. */}
                <div id={id} className="tuDrawerInner">
                    <ModalHeader className="tuDrawerHead">
                        {Icon && (
                            <span className="tuDrawerIcon" aria-hidden="true">
                                <Icon />
                            </span>
                        )}
                        <span className="tuDrawerTitles">
                            <h2>{title}</h2>
                            {subtitle && <p>{subtitle}</p>}
                        </span>
                        <Button isIconOnly variant="light" radius="full" aria-label={t('Close')} onPress={onClose}>
                            <LuX />
                        </Button>
                    </ModalHeader>
                    <div className="tuDrawerBody">{children}</div>
                </div>
            </ModalContent>
        </Modal>
    );
};

export default SideDrawer;
