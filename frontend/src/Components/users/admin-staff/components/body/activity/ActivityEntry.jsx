import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDistanceStrict } from 'date-fns';
import { LuChevronDown } from 'react-icons/lu';
import { formatClock } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { EASE_OUT } from '../../common/motion';
import { describe, describeBurst } from './activitySentences';
import { ActorAvatar, AreaIcon, Facts, Sentence, WhoTag } from './ActivityParts';

const RECENT = 3 * 60 * 60 * 1000; // "5 minutes ago" for the last three hours

// New rows (from the minute-by-minute refresh) slide in from the top.
const itemMotion = (fresh) => ({
    initial: fresh ? { opacity: 0, y: -12, height: 0 } : false,
    animate: { opacity: 1, y: 0, height: 'auto', transition: { duration: 0.35, ease: EASE_OUT } },
});

const EntryTime = ({ at, earliest, now }) => {
    const { t, dateLocale } = useI18n();
    const age = now - Date.parse(at);
    const clock = formatClock(at);
    const from = earliest ? formatClock(earliest) : null;
    return (
        <span className="alogTime">
            <time dateTime={at}>{from && from !== clock ? `${from}–${clock}` : clock}</time>
            {age < RECENT && (
                <small>{age < 60_000 ? t('just now') : formatDistanceStrict(new Date(at), now, { addSuffix: true, locale: dateLocale, roundingMethod: 'floor' })}</small>
            )}
        </span>
    );
};

// One thing someone did, as a sentence. Opens the detail drawer.
const SingleEntry = ({ row, fmt, now, fresh, onOpen }) => {
    const sentence = describe(row, fmt);
    return (
        <motion.li className="alogItem" {...itemMotion(fresh)}>
            <button type="button" className={`alogEntry${fresh ? ' isFresh' : ''}`} onClick={() => onOpen(row)}>
                <ActorAvatar row={row} people={fmt.people} />
                <span className="alogBody">
                    <span className="alogSentence">
                        <Sentence template={sentence.key} vars={sentence.vars} />
                    </span>
                    <span className="alogMeta">
                        <WhoTag row={row} people={fmt.people} />
                        <Facts facts={sentence.facts} />
                    </span>
                </span>
                <EntryTime at={row.at} now={now} />
            </button>
        </motion.li>
    );
};

// Several entries in a row by the same person about the same thing: one sentence, and the
// single entries behind an expander.
const BurstEntry = ({ item, fmt, now, fresh, onOpen }) => {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const { rows } = item;
    const sentence = describeBurst(rows, fmt);
    const listId = `alog-${item.id}`;
    // Facts every entry shares (the roll call's date) are said once, in the burst's own line.
    const children = rows.map((row) => ({ row, ...describe(row, fmt) }));
    const shared = children[0].facts.filter((fact) => children.every((child) => child.facts.includes(fact)));
    return (
        <motion.li className={`alogItem isBurst${open ? ' isOpen' : ''}`} {...itemMotion(fresh)}>
            <button type="button" className={`alogEntry${fresh ? ' isFresh' : ''}`} aria-expanded={open} aria-controls={listId} onClick={() => setOpen((value) => !value)}>
                <span className="alogStack">
                    <ActorAvatar row={rows[0]} people={fmt.people} />
                    <span className="alogStackCount" aria-hidden="true">{rows.length > 99 ? '99+' : rows.length}</span>
                </span>
                <span className="alogBody">
                    <span className="alogSentence">
                        <Sentence template={sentence.key} vars={sentence.vars} />
                    </span>
                    <span className="alogMeta">
                        <WhoTag row={rows[0]} people={fmt.people} />
                        <Facts facts={sentence.facts} />
                        <span className="alogExpand">
                            {open ? t('Show less') : t('Show all {count}', { count: rows.length })}
                            <LuChevronDown aria-hidden="true" />
                        </span>
                    </span>
                </span>
                <EntryTime at={rows[0].at} earliest={rows.at(-1).at} now={now} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.ul
                        id={listId}
                        className="alogChildren"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1, transition: { duration: 0.28, ease: EASE_OUT } }}
                        exit={{ height: 0, opacity: 0, transition: { duration: 0.18 } }}
                    >
                        {children.map(({ row, key, vars, facts }) => (
                            <li key={row.id}>
                                <button type="button" className="alogChild" onClick={() => onOpen(row)}>
                                    <AreaIcon area={row.area} className="alogChildIcon" />
                                    <span className="alogChildText">
                                        <Sentence template={key} vars={vars} />
                                        <Facts facts={facts.filter((fact) => !shared.includes(fact))} />
                                    </span>
                                    <time dateTime={row.at}>{formatClock(row.at)}</time>
                                </button>
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </motion.li>
    );
};

const ActivityEntry = ({ item, ...props }) => (item.kind === 'burst' ? <BurstEntry item={item} {...props} /> : <SingleEntry row={item.row} {...props} />);

export default ActivityEntry;
