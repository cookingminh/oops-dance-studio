import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuCheck, LuChevronLeft, LuChevronRight, LuFacebook, LuLoader2, LuLogIn, LuMail, LuMoon, LuPhone } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { EMAIL, PHONE, SOCIALS } from '@/Components/HomePage/Components/NavBar/contactInfo';
import { listMyThreads, startThread, topicsFor, uploadSupportImage } from '@/services/support';
import SupportComposer from './SupportComposer';
import { TOPIC_ICONS } from './topicIcons';
import { dayLabel, previewText, topicLabel } from './supportText';

// Lists that cascade in: the container staggers its children.
const CASCADE = { hidden: {}, shown: { transition: { staggerChildren: 0.035, delayChildren: 0.06 } } };
const RISE = {
    hidden: { opacity: 0, y: 8 },
    shown: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 30 } },
};

// The hotline, the fanpage and the email: for visitors, and when the studio isn't taking questions.
export const ContactLinks = () => {
    const { t } = useI18n();
    return (
        <ul className="supportContacts">
            <li>
                <a href={PHONE.tel}>
                    <LuPhone aria-hidden="true" />
                    <span>
                        <small>{t('Call the hotline')}</small>
                        <strong>{PHONE.display}</strong>
                    </span>
                </a>
            </li>
            <li>
                <a href={SOCIALS.facebook} target="_blank" rel="noopener noreferrer">
                    <LuFacebook aria-hidden="true" />
                    <span>
                        <small>{t('Message our fanpage')}</small>
                        <strong>Oops! Dance Studio</strong>
                    </span>
                </a>
            </li>
            <li>
                <a href={`mailto:${EMAIL}`}>
                    <LuMail aria-hidden="true" />
                    <span>
                        <small>{t('Email us')}</small>
                        <strong>{EMAIL}</strong>
                    </span>
                </a>
            </li>
        </ul>
    );
};

// Not signed in: the chat is for members; log in, or use the public channels.
export const SignedOutView = ({ status }) => {
    const { t } = useI18n();
    const location = useLocation();
    return (
        <div className="supportBody supportGuest">
            <h3>{t('Log in to message the studio')}</h3>
            <p>
                {t('Ask about classes, rooms or payments. Staff answer {opens}–{closes}, and the reply waits for you here.', {
                    opens: status?.opens ?? '08:00',
                    closes: status?.closes ?? '22:00',
                })}
            </p>
            <Link to="/login" state={{ from: location }} className="supportPrimary supportLogin">
                <LuLogIn aria-hidden="true" /> {t('Log in')}
            </Link>
            <p className="supportOr">{t('Or reach us directly')}</p>
            <ContactLinks />
        </div>
    );
};

// No open chat and the studio isn't taking new questions (from 21:45, and at night).
export const OfflineView = ({ status, onHistory }) => {
    const { t } = useI18n();
    const vars = { opens: status?.opens ?? '08:00', last_start: status?.last_start ?? '21:45', closes: status?.closes ?? '22:00' };
    return (
        <div className="supportBody supportOffline">
            <span className="supportOfflineIcon" aria-hidden="true">
                <LuMoon />
            </span>
            <h3>{status?.phase === 'last_call' ? t('We’re wrapping up for today') : t('The studio is offline')}</h3>
            <p>{t('New questions are taken {opens}–{last_start}. Write to us again from {opens}.', vars)}</p>
            <p className="supportOr">{t('Urgent? Call or message us')}</p>
            <ContactLinks />
            <button type="button" className="supportLinkBtn" onClick={onHistory}>
                {t('See past chats')} <LuChevronRight aria-hidden="true" />
            </button>
        </div>
    );
};

// A new question: pick a topic, write it (a photo too), Send. The draft survives closing the panel.
export const NewQuestionView = ({ status, role, userId, firstName, draft, setDraft, onStarted, onChanged }) => {
    const { t } = useI18n();
    const toast = useToast();
    const { pathname } = useLocation();
    const [needTopic, setNeedTopic] = useState(false);

    const send = async ({ body, file }) => {
        if (!draft.category) {
            setNeedTopic(true);
            return false;
        }
        try {
            const imagePath = file ? await uploadSupportImage(userId, file) : null;
            const thread = await startThread({ category: draft.category, body, imagePath, openedFrom: pathname });
            setDraft({ category: null, body: '' });
            onStarted(thread.id);
            return true;
        } catch (error) {
            toast.error(error);
            if (error?.code === 'SUPPORT_CLOSED' || error?.code === 'INVALID_STATE') onChanged();
            return false;
        }
    };

    return (
        <>
            <div className="supportBody supportNew">
                <motion.p className="supportLead" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    {firstName ? t('Hi {name}! What can we help you with?', { name: firstName }) : t('Hi! What can we help you with?')}{' '}
                    <span className="supportWave" aria-hidden="true">
                        👋
                    </span>
                </motion.p>
                <p className="supportHint">
                    {t('Pick a topic and write your question. Staff reply {opens}–{closes}; the answer shows up right here.', {
                        opens: status?.opens ?? '08:00',
                        closes: status?.closes ?? '22:00',
                    })}
                </p>
                <motion.div className="supportTopics" role="radiogroup" aria-label={t('Topic')} variants={CASCADE} initial="hidden" animate="shown">
                    {topicsFor(role).map((topic) => {
                        const on = draft.category === topic.key;
                        const Icon = on ? LuCheck : (TOPIC_ICONS[topic.key] ?? TOPIC_ICONS.other);
                        return (
                            <motion.button
                                key={topic.key}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                className={`supportTopic${on ? ' isOn' : ''}`}
                                variants={RISE}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    setNeedTopic(false);
                                    setDraft((current) => ({ ...current, category: topic.key }));
                                }}
                            >
                                <motion.span
                                    key={on ? 'on' : 'off'}
                                    className="supportTopicIcon"
                                    aria-hidden="true"
                                    initial={{ scale: 0.5, rotate: on ? -30 : 0 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                                >
                                    <Icon />
                                </motion.span>
                                {t(topic.label)}
                            </motion.button>
                        );
                    })}
                </motion.div>
                {needTopic && (
                    <p className="supportFieldError" role="alert">
                        {t('Pick a topic for your question.')}
                    </p>
                )}
            </div>
            <div className="supportFooter">
                <SupportComposer
                    value={draft.body}
                    onChange={(body) => setDraft((current) => ({ ...current, body }))}
                    onSend={send}
                    requireText
                    autoFocus={Boolean(draft.category)}
                    placeholder={t('Write your question…')}
                />
            </div>
        </>
    );
};

const stateOf = (item) => (item.status === 'closed' ? 'closed' : item.status === 'closing' ? 'closing' : 'open');

// Every chat they had, newest first (the open one on top); open one to read it.
export const HistoryView = ({ status, onOpen, onBack }) => {
    const i18n = useI18n();
    const { t } = i18n;
    const [items, setItems] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        listMyThreads()
            .then((rows) => alive && setItems(rows ?? []))
            .catch(() => alive && setFailed(true));
        return () => {
            alive = false;
        };
    }, []);

    const labels = { closed: t('Chat closed'), closing: t('Is it sorted?'), open: t('Ongoing') };

    return (
        <div className="supportBody supportHistory">
            <button type="button" className="supportLinkBtn supportBack" onClick={onBack}>
                <LuChevronLeft aria-hidden="true" /> {t('Back')}
            </button>
            <h3>{t('Past chats')}</h3>
            {failed && <p className="supportEmpty">{t('Your chats couldn’t be loaded. Try again in a moment.')}</p>}
            {!failed && !items && <LuLoader2 className="supportSpin" aria-label={t('Loading…')} />}
            {items && items.length === 0 && <p className="supportEmpty">{t('No chats yet. Your questions and the studio’s answers will be kept here.')}</p>}
            {items && items.length > 0 && (
                <motion.ul className="supportHistoryList" variants={CASCADE} initial="hidden" animate="shown">
                    {items.map((item) => (
                        <motion.li key={item.id} variants={RISE}>
                            <button type="button" className="supportHistoryItem" onClick={() => onOpen(item.id)}>
                                <span className="supportHistoryTop">
                                    <strong>{topicLabel(t, item.category)}</strong>
                                    <span className={`supportState is-${stateOf(item)}`}>{labels[stateOf(item)]}</span>
                                </span>
                                <span className="supportHistoryPreview">{previewText(t, item, status)}</span>
                                <span className="supportHistoryWhen">
                                    {dayLabel(i18n, item.last_message_at)}
                                    {item.unread > 0 && (
                                        <span className="supportCount" aria-label={t('{count} unread', { count: item.unread })}>
                                            {item.unread}
                                        </span>
                                    )}
                                </span>
                            </button>
                        </motion.li>
                    ))}
                </motion.ul>
            )}
        </div>
    );
};
