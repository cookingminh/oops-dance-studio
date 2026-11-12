import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuCheck, LuHelpCircle, LuLightbulb } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import './guide.scss';

// A page's guide in one big dialog, read top to bottom: what the page is for, then each part of it with a
// worked example beside the words, and a closing line. `guide` is { id, title, intro, sections: [{ id,
// title, body, example (node), tip }], outro } with the text already translated.
const GuideModal = ({ guide, onClose }) => {
    const { t } = useI18n();
    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            size="4xl"
            placement="center"
            scrollBehavior="inside"
            classNames={{ base: 'gmDialog adminPortal', closeButton: 'gmClose' }}
        >
            <ModalContent>
                <ModalHeader className="gmHead">
                    <span className="gmIcon" aria-hidden="true">
                        <LuHelpCircle />
                    </span>
                    <h2 className="gmTitle">{t('Using the {page} page', { page: guide.title })}</h2>
                </ModalHeader>
                <ModalBody className="gmBody">
                    {guide.intro && <p className="gmIntro">{guide.intro}</p>}
                    <ol className="gmSections">
                        {guide.sections.map((section, index) => (
                            <li key={section.id} className={`gmSection${section.example ? '' : ' isTextOnly'}`}>
                                <div className="gmText">
                                    <h3>
                                        <span className="gmNumber" aria-hidden="true">
                                            {index + 1}
                                        </span>
                                        {section.title}
                                    </h3>
                                    <p>{section.body}</p>
                                    {section.tip && (
                                        <p className="gmTip">
                                            <LuLightbulb aria-hidden="true" />
                                            <span>{section.tip}</span>
                                        </p>
                                    )}
                                </div>
                                {section.example && (
                                    <figure className="gmExample">
                                        <figcaption>{t('Example')}</figcaption>
                                        {section.example}
                                    </figure>
                                )}
                            </li>
                        ))}
                    </ol>
                    {guide.outro && <p className="gmOutro">{guide.outro}</p>}
                </ModalBody>
                <ModalFooter className="gmFoot">
                    <button type="button" className="gmDone" onClick={onClose}>
                        <LuCheck aria-hidden="true" /> {t('Got it')}
                    </button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default GuideModal;
