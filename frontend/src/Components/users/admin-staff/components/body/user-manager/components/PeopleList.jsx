import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuSearchX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { PAGE_SIZE, contextLineOf, rowStagger } from '../peopleModel';
import PersonRow from './PersonRow';

// Placeholder rows while the directory loads (the shimmer stops for reduced motion).
export const PeopleSkeleton = ({ rows = 6 }) => (
    <ul className="peopleList isLoading" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
            <li key={index} className="personRow isSkeleton">
                <span className="skelCircle" />
                <span className="skelLines">
                    <span />
                    <span />
                </span>
                <span className="skelLines">
                    <span />
                    <span />
                </span>
                <span className="skelLines">
                    <span />
                    <span />
                </span>
            </li>
        ))}
    </ul>
);

// Everyone who matches the filters, `limit` at a time ("Show more" adds the next batch).
const PeopleList = ({ people, total, limit, listKey, selfId, openId, today, onOpen, onShowMore, onClear }) => {
    const { t, formatDate } = useI18n();
    const thisYear = today?.slice(0, 4);
    const joinedLabel = (person) => (person.joined ? formatDate(person.joined, person.joined.slice(0, 4) === thisYear ? 'dayMonth' : 'monthYear') : '—');

    if (people.length === 0) {
        return (
            <div className="peopleEmpty">
                <LuSearchX aria-hidden="true" />
                <p>{total ? t('Nobody matches these filters.') : t('No accounts yet.')}</p>
                {total > 0 && (
                    <Button size="sm" variant="flat" onPress={onClear}>
                        {t('Show everyone')}
                    </Button>
                )}
            </div>
        );
    }

    const shown = people.slice(0, limit);
    return (
        <>
            <div className="peopleHead" aria-hidden="true">
                <span>{t('Person')}</span>
                <span>{t('Contact')}</span>
                <span>{t('Role and classes')}</span>
                <span>{t('Member since')}</span>
            </div>
            <motion.ul key={listKey} className="peopleList" aria-label={t('Everyone at the studio')} variants={rowStagger} initial="hidden" animate="show">
                {shown.map((person) => (
                    <PersonRow
                        key={person.id}
                        person={person}
                        isSelf={person.id === selfId}
                        isOpen={person.id === openId}
                        contextLine={contextLineOf(person, t)}
                        joinedLabel={joinedLabel(person)}
                        onOpen={onOpen}
                    />
                ))}
            </motion.ul>
            {people.length > shown.length && (
                <div className="peopleMore">
                    <span>{t('Showing {shown} of {total}', { shown: shown.length, total: people.length })}</span>
                    <Button variant="flat" onPress={onShowMore}>
                        {t('Show {count} more', { count: Math.min(people.length - shown.length, PAGE_SIZE) })}
                    </Button>
                </div>
            )}
        </>
    );
};

export default PeopleList;
