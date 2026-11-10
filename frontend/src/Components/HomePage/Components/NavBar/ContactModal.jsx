import { useState } from 'react';
import { Modal, ModalBody, ModalContent } from '@nextui-org/react';
import { LuCheck, LuChevronRight, LuClock, LuCopy, LuFacebook, LuMail, LuMapPin, LuPhone } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import logoMark from '@/assets/images/logo-mark.webp';
import { ADDRESS, EMAIL, MAP_URL, PHONE, SOCIALS } from './contactInfo';
import './ContactModal.scss';

const CHANNELS = [
    { key: 'phone', icon: LuPhone, label: 'Call the hotline', value: PHONE.display, href: PHONE.tel, copy: PHONE.raw },
    { key: 'mail', icon: LuMail, label: 'Email us', value: EMAIL, href: `mailto:${EMAIL}`, copy: EMAIL },
    { key: 'facebook', icon: LuFacebook, label: 'Message our fanpage', value: 'Oops! Dance Studio', href: SOCIALS.facebook, external: true },
    { key: 'map', icon: LuMapPin, label: 'Visit the studio', value: ADDRESS, href: MAP_URL, external: true },
];

const ContactModal = ({ isOpen, onOpenChange }) => {
    const { t } = useI18n();
    const [copied, setCopied] = useState(null);

    const copy = async (channel) => {
        try {
            await navigator.clipboard.writeText(channel.copy);
            setCopied(channel.key);
            setTimeout(() => setCopied((current) => (current === channel.key ? null : current)), 1600);
        } catch {
            // Clipboard blocked (e.g. insecure context): the link itself still works.
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            placement="center"
            backdrop="blur"
            size="lg"
            // Above the fixed navbar (z 1000), so the whole page dims behind the dialog.
            classNames={{ base: 'contactModal', closeButton: 'contactClose', wrapper: 'z-[1200]', backdrop: 'z-[1200]' }}
        >
            <ModalContent>
                <header className="contactHero">
                    <span className="contactMark">
                        <img src={logoMark} alt="" />
                    </span>
                    <h2 id="modal-title">{t('Let’s dance together')}</h2>
                    <p>{t('Questions about classes, rooms or bookings? Reach us any way you like.')}</p>
                </header>
                <ModalBody className="contactBody">
                    <ul className="contactList">
                        {CHANNELS.map((channel, index) => {
                            const Icon = channel.icon;
                            return (
                                <li key={channel.key} className={`kind-${channel.key}`} style={{ animationDelay: `${80 + index * 60}ms` }}>
                                    <a
                                        className="contactRow"
                                        href={channel.href}
                                        {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    >
                                        <span className="contactIcon" aria-hidden="true">
                                            <Icon />
                                        </span>
                                        <span className="contactText">
                                            <small>{t(channel.label)}</small>
                                            <strong>{channel.value}</strong>
                                        </span>
                                        {!channel.copy && <LuChevronRight className="contactGo" aria-hidden="true" />}
                                    </a>
                                    {channel.copy && (
                                        <button type="button" className="contactCopy" onClick={() => copy(channel)} aria-label={t('Copy {value}', { value: channel.value })}>
                                            {copied === channel.key ? <LuCheck /> : <LuCopy />}
                                            <span>{copied === channel.key ? t('Copied') : t('Copy')}</span>
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    <p className="contactHours">
                        <LuClock aria-hidden="true" /> {t('Rooms open every day, 08:00 – 22:00')}
                    </p>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default ContactModal;
