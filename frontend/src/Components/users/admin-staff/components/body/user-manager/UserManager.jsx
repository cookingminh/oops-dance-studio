import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Input } from '@nextui-org/react';
import { LuDownload, LuSearch, LuUserPlus, LuUsers, LuX } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { listPeopleDirectory } from '@/services/people';
import { getStudioToday } from '@/services/studio';
import { useI18n } from '@/i18n/i18nContext';
import { ErrorMessage } from '@/ui/feedback/AsyncState';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import { INSIGHTS, KINDS, PAGE_SIZE, SORTERS, buildPeople, downloadPeopleCsv, matchesQuery, matchesView } from './peopleModel';
import PeopleOverview from './components/PeopleOverview';
import PeopleList, { PeopleSkeleton } from './components/PeopleList';
import PersonSheet from './components/sheet/PersonSheet';
import AddPersonDialog from './components/AddPersonDialog';
import './users.scss';

// English keys for the list summary, singular and plural, per filter.
const SUMMARY = {
    all: ['{count} person', '{count} people'],
    student: ['{count} student', '{count} students'],
    guest: ['{count} guest', '{count} guests'],
    instructor: ['{count} instructor', '{count} instructors'],
    staff: ['{count} staff member', '{count} staff members'],
    admin: ['{count} admin', '{count} admins'],
    new: ['{count} person joined this month', '{count} people joined this month'],
    attention: ['{count} person is missing details', '{count} people are missing details'],
};

function countViews(people) {
    const counts = { all: people.length, new: 0, attention: 0 };
    for (const key of Object.keys(KINDS)) counts[key] = 0;
    for (const person of people) {
        counts[person.kind] += 1;
        if (person.isNew) counts.new += 1;
        if (person.missing.length) counts.attention += 1;
    }
    return counts;
}

// Admin "People" page (/admin/users): head counts that double as filters, a searchable list and a
// side panel per person (?person=<id>) with their classes, activity and account actions.
const UserManager = () => {
    const { user } = useAuth();
    const { t, tn } = useI18n();
    const today = useAsync(getStudioToday, []);
    const directory = useAsync(listPeopleDirectory, []);
    const [searchParams, setSearchParams] = useSearchParams();
    const [view, setView] = useState('all');
    const [sort, setSort] = useState('newest');
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [adding, setAdding] = useState(false);
    const [intent, setIntent] = useState(null); // 'enrol' when opened from "Add person" → next steps

    const month = today.data ? `${today.data.slice(0, 7)}-01` : null;
    const people = useMemo(() => buildPeople(directory.data, month), [directory.data, month]);
    const counts = useMemo(() => (directory.data ? countViews(people) : null), [directory.data, people]);
    const visible = people.filter((person) => matchesView(person, view) && matchesQuery(person, query)).sort(SORTERS[sort]);

    const openId = searchParams.get('person');
    const openPerson = people.find((person) => person.id === openId);
    const setOpenId = (id, nextIntent = null) => {
        setIntent(nextIntent);
        setSearchParams(
            (previous) => {
                const next = new URLSearchParams(previous);
                if (id) next.set('person', id);
                else next.delete('person');
                return next;
            },
            { replace: true }
        );
    };

    // Any filter change starts the list from the top again.
    const filterSetter = (setter) => (value) => {
        setter(value);
        setLimit(PAGE_SIZE);
    };
    const clearFilters = () => {
        setView('all');
        setQuery('');
        setLimit(PAGE_SIZE);
    };

    const [one, many] = SUMMARY[view];
    const summary = query.trim()
        ? t('{people} matching “{query}”', { people: tn(visible.length, one, many), query: query.trim() })
        : tn(visible.length, one, many);
    const filterLabel = view === 'all' ? null : t(KINDS[view]?.plural ?? INSIGHTS[view].label);

    return (
        <>
            <SectionCard
                className="peopleCard"
                icon={LuUsers}
                title={t('Everyone at the studio')}
                subtitle={t('Open someone to see their classes, activity and account options.')}
                actions={
                    <>
                        <Button
                            variant="flat"
                            startContent={<LuDownload aria-hidden="true" />}
                            isDisabled={!visible.length}
                            onPress={() => downloadPeopleCsv(visible, t, today.data)}
                        >
                            {t('Export CSV')}
                        </Button>
                        <Button color="danger" startContent={<LuUserPlus aria-hidden="true" />} onPress={() => setAdding(true)}>
                            {t('Add person')}
                        </Button>
                    </>
                }
            >
                <PeopleOverview counts={counts} view={view} onChange={filterSetter(setView)} />

                <div className="peopleToolbar">
                    <Input
                        isClearable
                        aria-label={t('Search people')}
                        placeholder={t('Name, @username, email or phone')}
                        className="peopleSearch"
                        startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                        value={query}
                        onValueChange={filterSetter(setQuery)}
                        onClear={() => filterSetter(setQuery)('')}
                    />
                    <Segmented
                        label={t('Sort')}
                        options={[
                            { key: 'newest', label: t('Newest first') },
                            { key: 'name', label: t('Name A–Z') },
                        ]}
                        value={sort}
                        onChange={setSort}
                    />
                </div>

                <div className="peopleMeta" aria-live="polite">
                    <span className="peopleSummary">{directory.data ? summary : t('Loading…')}</span>
                    {filterLabel && (
                        <button
                            type="button"
                            className="filterChip"
                            aria-label={t('Remove filter: {name}', { name: filterLabel })}
                            onClick={() => filterSetter(setView)('all')}
                        >
                            {filterLabel}
                            <LuX aria-hidden="true" />
                        </button>
                    )}
                </div>

                {directory.error ? (
                    <ErrorMessage error={directory.error} onRetry={directory.reload} />
                ) : !directory.data ? (
                    <PeopleSkeleton />
                ) : (
                    <PeopleList
                        people={visible}
                        total={people.length}
                        limit={limit}
                        listKey={`${view}-${sort}`}
                        selfId={user.id}
                        openId={openId}
                        today={today.data}
                        onOpen={(id) => setOpenId(id)}
                        onShowMore={() => setLimit((value) => value + PAGE_SIZE)}
                        onClear={clearFilters}
                    />
                )}
            </SectionCard>

            {openPerson && (
                <PersonSheet
                    key={openPerson.id}
                    person={openPerson}
                    people={people}
                    isSelf={openPerson.id === user.id}
                    today={today.data}
                    month={month}
                    intent={intent}
                    onClose={() => setOpenId(null)}
                    onChanged={directory.reload}
                    onDeleted={() => {
                        setOpenId(null);
                        directory.reload();
                    }}
                />
            )}
            {adding && (
                <AddPersonDialog
                    initialRole={KINDS[view]?.role}
                    onClose={() => setAdding(false)}
                    onCreated={directory.reload}
                    onOpenPerson={(id, nextIntent) => {
                        setAdding(false);
                        setOpenId(id, nextIntent);
                    }}
                />
            )}
        </>
    );
};

export default UserManager;
