import { Avatar, Button, Modal, ModalContent, Spinner } from '@nextui-org/react';
import { LuArrowUpRight, LuX } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listEntityActivity } from '@/services/activity';
import { avatarUrl } from '@/services/storage';
import { formatClock } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { ErrorMessage } from '@/ui/feedback/AsyncState';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import LinkButton from '@/ui/LinkButton';
import { EASE_OUT } from '../../common/motion';
import { actionLabel, areaOf, studioDateOf } from './activityModel';
import { actorName, describe } from './activitySentences';
import { changeRows, recordLink } from './activityFields';
import { AreaIcon, Facts, Sentence, WhoTag } from './ActivityParts';

// Slides in from the right (full screen on phones), like the People page's person sheet.
const DRAWER_MOTION = {
    variants: {
        enter: { x: 0, opacity: 1, transition: { x: { duration: 0.34, ease: EASE_OUT }, opacity: { duration: 0.18 } } },
        exit: { x: 48, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } },
    },
};

const STUDIO_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// "Tuesday 10 November 2026 · 08:21:43" in the studio's time.
function useExactTime() {
    const { formatDate, intl } = useI18n();
    return (at) => {
        const time = new Intl.DateTimeFormat(intl, { timeZone: STUDIO_TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(at));
        return `${formatDate(studioDateOf(at), 'full')} · ${time}`;
    };
}

const ChangesTable = ({ rows }) => {
    const { t } = useI18n();
    return (
        <div className="alogChangesWrap">
            <table className="alogChanges">
                <caption className="sr-only">{t('What changed')}</caption>
                <thead>
                    <tr>
                        <th scope="col">{t('Field')}</th>
                        <th scope="col">{t('Before')}</th>
                        <th scope="col">{t('After')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.column}>
                            <th scope="row">{row.label}</th>
                            <td className="isFrom">{row.from}</td>
                            <td className="isTo">{row.to}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Everything that happened to the same record, oldest first; the open entry is marked.
const RecordHistory = ({ row, fmt, onPick }) => {
    const { t, formatDate } = useI18n();
    const history = useAsync(() => (row.entity_id ? listEntityActivity(row.entity, row.entity_id) : Promise.resolve([])), [row.entity, row.entity_id]);

    if (history.error) return <ErrorMessage error={history.error} onRetry={history.reload} />;
    if (!history.data) {
        return (
            <div className="alogDrawerLoading">
                <Spinner size="sm" color="danger" />
                <span>{t('Loading…')}</span>
            </div>
        );
    }
    return (
        <>
            <ol className="alogHistory">
                {history.data.map((item) => {
                    const sentence = describe(item, fmt);
                    const current = item.id === row.id;
                    return (
                        <li key={item.id} className={current ? 'isCurrent' : undefined}>
                            <button type="button" onClick={() => onPick(item)} aria-current={current ? 'true' : undefined} disabled={current}>
                                <span className="alogHistoryDot" aria-hidden="true" />
                                <span className="alogHistoryText">
                                    <small>
                                        {formatDate(studioDateOf(item.at), 'short')} · {formatClock(item.at)}
                                        {current && <em>{t('This entry')}</em>}
                                    </small>
                                    <span>
                                        <Sentence template={sentence.key} vars={sentence.vars} />
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
            {history.data.length <= 1 && <p className="alogHint">{t('Nothing else has happened to this record.')}</p>}
        </>
    );
};

// One entry in full: the sentence, when exactly and who, what changed, the record's history
// and a link to where it lives.
const ActivityDrawer = ({ row, fmt, lookups, onPick, onClose }) => {
    const { t } = useI18n();
    const exactTime = useExactTime();
    const sentence = describe(row, fmt);
    const changes = changeRows(row, fmt);
    const link = recordLink(row, lookups);
    const person = lookups?.people?.get(row.actor_id);
    const name = row.actor_id ? actorName(row, fmt) : row.area === 'tuition' ? t('The bank') : t('The studio’s daily jobs');

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            size="full"
            scrollBehavior="inside"
            hideCloseButton
            motionProps={DRAWER_MOTION}
            classNames={{ wrapper: 'alogDrawerWrap', base: 'alogDrawer adminPortal', backdrop: 'alogDrawerBackdrop' }}
        >
            <ModalContent aria-label={t(sentence.key, sentence.vars)}>
                <div className="alogDrawerHead">
                    <div className="alogDrawerTop">
                        <span className="alogDrawerArea" data-area={row.area}>
                            <AreaIcon area={row.area} className="alogAreaIcon" />
                            {t(areaOf(row.area).label)} · {t(actionLabel(row.area, row.action))}
                        </span>
                        <Button isIconOnly variant="light" radius="full" aria-label={t('Close')} onPress={onClose}>
                            <LuX />
                        </Button>
                    </div>
                    <h2 className="alogDrawerSentence">
                        <Sentence template={sentence.key} vars={sentence.vars} />
                    </h2>
                    <Facts facts={sentence.facts} />
                </div>

                <div className="alogDrawerBody">
                    <dl className="alogDetails">
                        <div>
                            <dt>{t('When')}</dt>
                            <dd>{exactTime(row.at)}</dd>
                        </div>
                        <div>
                            <dt>{t('Who')}</dt>
                            <dd className="alogDetailWho">
                                {row.actor_id && (
                                    <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(person?.avatar_path, person?.updated_at) ?? undefined} name={name} />
                                )}
                                <strong>{name}</strong>
                                <WhoTag row={row} people={fmt.people} />
                            </dd>
                        </div>
                    </dl>

                    {changes.length > 0 && (
                        <section className="alogDrawerSection" aria-labelledby="alog-changes">
                            <h3 id="alog-changes">{t('What changed')}</h3>
                            <ChangesTable rows={changes} />
                        </section>
                    )}

                    <section className="alogDrawerSection" aria-labelledby="alog-history">
                        <h3 id="alog-history">{t('History of this record')}</h3>
                        <RecordHistory row={row} fmt={fmt} onPick={onPick} />
                    </section>
                </div>

                {link && (
                    <div className="alogDrawerFoot">
                        <LinkButton to={link.to} variant="flat" startContent={<LuArrowUpRight aria-hidden="true" />}>
                            {link.className ? t('Open {class}', { class: link.className }) : t('Open in {page}', { page: t(link.page) })}
                        </LinkButton>
                    </div>
                )}
            </ModalContent>
        </Modal>
    );
};

export default ActivityDrawer;
