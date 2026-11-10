import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuArrowUpRight, LuQuote } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { PromoPlayer } from './PromoPlayer';
import './promo.scss';

// Watching a promo: the clip (it starts playing), what it is for and the teacher's words.
//   eyebrow   e.g. 'Coming next · K-pop Cover'      title   the routine ('Super Shy — NewJeans')
//   meta      a line under the title (when it starts, who teaches)
//   footer    actions (e.g. "Try a free class" on /classes)
// `portalClass` gives the dialog the page's tokens (admin and profile pages: 'adminPortal').
const PromoDialog = ({ promo, eyebrow, title, meta, footer, onClose, portalClass = '' }) => {
    const { t } = useI18n();
    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            placement="center"
            scrollBehavior="inside"
            classNames={{ base: `prDialog ${portalClass}`, closeButton: 'prDialogClose' }}
        >
            <ModalContent>
                <ModalHeader className="prDialogHead">
                    {eyebrow && <small className="prEyebrow">{eyebrow}</small>}
                    <h2>{title}</h2>
                    {meta && <p>{meta}</p>}
                </ModalHeader>
                <ModalBody className="prDialogBody">
                    <PromoPlayer promo={promo} title={t('Promo of “{title}”', { title })} autoPlay />
                    {promo.caption && (
                        <p className="prCaption">
                            <LuQuote aria-hidden="true" />
                            <span>{promo.caption}</span>
                        </p>
                    )}
                    {promo.url && (
                        <a className="prOpenYt" href={promo.url} target="_blank" rel="noreferrer">
                            {t('Open on YouTube')} <LuArrowUpRight aria-hidden="true" />
                        </a>
                    )}
                </ModalBody>
                {footer && <ModalFooter className="prDialogFoot">{footer}</ModalFooter>}
            </ModalContent>
        </Modal>
    );
};

export default PromoDialog;
