import { useState } from 'react';
import { motion } from 'framer-motion';
import { Chip, Image, Modal, ModalBody, ModalContent, ModalHeader, Pagination, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@nextui-org/react';
import { LuCheck, LuClipboardCheck, LuCoffee, LuHistory, LuMail } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { useAsync } from '@/hooks/useAsync';
import { listMyInstructorAttendance } from '@/services/attendance';
import { getStudioToday } from '@/services/studio';
import { withOwnTimes } from '@/services/sessions';
import { sessionTimesOf } from '@/lib/lessons';
import { formatClock } from '@/lib/format';
import { placeOf } from '@/lib/place';
import { PlaceDetails, PlaceIcon } from '@/ui/place/PlaceParts';
import AsyncState from '@/ui/feedback/AsyncState';
import { statusColorMap } from '../../../../../../Table/utils';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import Segmented from '../../../../../admin-staff/components/common/Segmented';
import { fadeUp, stagger } from '../../../../../admin-staff/components/common/motion';
import { sessionPhase, useIsPhone, useStudioNow } from '../../profileHelpers';
import { ClassThumb } from '../classes/ClassParts';
import { CheckAction } from '../classes/ClassNext';
import CheckForm from './CheckForm';
import HistoryList from './HistoryList';
import ProofThumb from './ProofThumb';
import MakeUpTag from '../../../../../admin-staff/components/body/class-manager/routines/MakeUpTag';
import LateTag from '../../../../../admin-staff/components/common/checkins/LateTag';

const PAGE_SIZE = 8;
const PERIODS = [
    { key: 'month', label: 'This month' },
    { key: 'all', label: 'All time' },
];
const COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'class', label: 'Class' },
    { key: 'checkin', label: 'Check-in' },
    { key: 'checkout', label: 'Check-out' },
    { key: 'status', label: 'Status' },
];
// Make-up sessions have their own times (withOwnTimes also puts them in the row's class schedule,
// so sessionPhase reads them); regular sessions take the class's weekly slot.
const byStart = (a, b) => sessionTimesOf(a).start.localeCompare(sessionTimesOf(b).start);

async function loadToday(instructorId) {
    const today = await getStudioToday();
    const rows = await withOwnTimes(await listMyInstructorAttendance(instructorId, { date: today, withProofs: true }));
    return { today, rows: rows.sort(byStart) };
}

// `label` and `proofLabel` are already translated. (A late check-out is said under the steps, by CheckAction.)
const Step = ({ label, proofLabel, at, proof, onView }) => {
    const { t } = useI18n();
    return (
        <li className={`pfStep${at ? ' isDone' : ''}`}>
            <span className="pfStepDot" aria-hidden="true">
                {at && <LuCheck />}
            </span>
            <span className="pfStepText">
                <small>{label}</small>
                <strong>{at ? formatClock(at) : t('Not yet')}</strong>
            </span>
            <ProofThumb url={proof} label={proofLabel} onView={onView} />
        </li>
    );
};

// Instructor check-in: today's sessions with one big action each, then the full history.
const CheckIn = () => {
    const { user } = useAuth();
    const { t, tn, formatDate } = useI18n();
    const today = useAsync(() => loadToday(user.id), [user.id]);
    const history = useAsync(() => listMyInstructorAttendance(user.id, { withProofs: true }).then(withOwnTimes), [user.id]);
    const { now } = useStudioNow();
    const [checking, setChecking] = useState(null); // { kind, attendance }
    const [proof, setProof] = useState(null); // { url, label }
    const [period, setPeriod] = useState('month');
    const [page, setPage] = useState(1);
    const isPhone = useIsPhone();

    const viewProof = (url, label) => setProof({ url, label });
    const rows = today.data?.rows ?? [];
    const done = rows.filter((row) => row.status === 'completed').length;

    const month = today.data?.today.slice(0, 7);
    const records = (history.data ?? [])
        .filter((row) => period === 'all' || !month || row.date.startsWith(month))
        .sort((a, b) => b.date.localeCompare(a.date) || byStart(b, a));
    const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
    const currentPage = Math.min(page, pages);
    const pageRows = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const renderCell = (row, key) => {
        switch (key) {
            case 'date':
                return (
                    <div className="stackCell">
                        <strong>{formatDate(row.date, 'short')}</strong>
                        <span>
                            {sessionTimesOf(row).start}
                            {row.is_extra && <MakeUpTag className="sessionTag" />}
                        </span>
                    </div>
                );
            case 'class':
                return (
                    <span className="pfCellClass">
                        <ClassThumb cls={row.class ?? {}} />
                        <span className="stackCell">
                            <strong>{row.class?.name}</strong>
                            <span>{placeOf(row, row.class).name}</span>
                        </span>
                    </span>
                );
            case 'checkin':
            case 'checkout': {
                const at = key === 'checkin' ? row.checkin_at : row.checkout_at;
                const url = key === 'checkin' ? row.checkin_proof_url : row.checkout_proof_url;
                return (
                    <span className="pfProofCell">
                        <ProofThumb url={url} label={key === 'checkin' ? t('Check-in proof') : t('Check-out proof')} onView={viewProof} />
                        <span className={at ? undefined : 'isMuted'}>{at ? formatClock(at) : '—'}</span>
                        {key === 'checkout' && row.checkout_late && <LateTag />}
                    </span>
                );
            }
            case 'status':
                return (
                    <Chip size="sm" variant="flat" className="capitalize" color={statusColorMap[row.status] ?? 'default'}>
                        {t(row.status.replace('_', ' '))}
                    </Chip>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <SectionCard
                className="todayClassesDiv"
                icon={LuClipboardCheck}
                title={t('Your Classes Today')}
                subtitle={today.data ? t('{date} · {done} of {total} done', { date: formatDate(today.data.today, 'long'), done, total: rows.length }) : t('Loading today…')}
                actions={
                    <a className="cardLink" href="mailto:oopsdancestudio@gmail.com?subject=Attendance%20report">
                        <LuMail aria-hidden="true" /> {t('Report a problem')}
                    </a>
                }
            >
                <AsyncState state={today} isEmpty={false}>
                    {rows.length === 0 ? (
                        <div className="pfEmptyLine">
                            <LuCoffee aria-hidden="true" />
                            <span>{t('No class for today. Enjoy your day off!')}</span>
                        </div>
                    ) : (
                        <motion.div className="pfSessionGrid" variants={stagger} initial="hidden" animate="show">
                            {rows.map((row) => {
                                const { start, end } = sessionTimesOf(row);
                                const phase = sessionPhase(row, now);
                                return (
                                    <motion.article key={row.id} variants={fadeUp} className={`pfSession tone-${phase.tone}`}>
                                        <header className="pfSessionTop">
                                            <span className="pfSessionTime">
                                                <strong>{start}</strong> – {end}
                                                {row.is_extra && <MakeUpTag className="sessionTag" />}
                                            </span>
                                            <span className={`pfPhase tone-${phase.tone}`}>
                                                {phase.tone === 'live' && <span className="pfPulse" aria-hidden="true" />}
                                                {t(phase.key, phase.vars)}
                                            </span>
                                        </header>
                                        <div className="pfSessionWho">
                                            <ClassThumb cls={row.class ?? {}} />
                                            <span>
                                                <strong>{row.class?.name}</strong>
                                                <small className="pfSessionPlace">
                                                    <PlaceIcon place={placeOf(row, row.class)} />
                                                    <PlaceDetails place={placeOf(row, row.class)} empty={t('No room')} />
                                                </small>
                                            </span>
                                        </div>
                                        <ol className="pfSteps">
                                            <Step label={t('Check-in')} proofLabel={t('Check-in proof')} at={row.checkin_at} proof={row.checkin_proof_url} onView={viewProof} />
                                            <Step label={t('Check-out')} proofLabel={t('Check-out proof')} at={row.checkout_at} proof={row.checkout_proof_url} onView={viewProof} />
                                        </ol>
                                        <footer className="pfSessionAction">
                                            <CheckAction record={row} now={now} onCheck={setChecking} />
                                        </footer>
                                    </motion.article>
                                );
                            })}
                        </motion.div>
                    )}
                </AsyncState>
            </SectionCard>

            <SectionCard
                className="historyDiv"
                icon={LuHistory}
                title={t('Your attendance records')}
                subtitle={history.data ? tn(records.length, '{count} session · tap a photo to see it', '{count} sessions · tap a photo to see it') : t('Loading…')}
                actions={
                    <Segmented
                        label={t('Period')}
                        options={PERIODS.map((option) => ({ ...option, label: t(option.label) }))}
                        value={period}
                        onChange={(value) => {
                            setPeriod(value);
                            setPage(1);
                        }}
                    />
                }
            >
                <AsyncState state={history} isEmpty={false}>
                    {isPhone ? (
                        <HistoryList rows={pageRows} onView={viewProof} />
                    ) : (
                        <div className="tableScroll">
                            <Table aria-label={t('My attendance records')} removeWrapper className="bookingTable">
                                <TableHeader columns={COLUMNS}>{(column) => <TableColumn key={column.key}>{t(column.label)}</TableColumn>}</TableHeader>
                                <TableBody items={pageRows} emptyContent={<div className="tableEmpty">{t('No sessions in this period.')}</div>}>
                                    {(row) => <TableRow key={row.id}>{(key) => <TableCell>{renderCell(row, key)}</TableCell>}</TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {pages > 1 && (
                        <div className="tableFooter">
                            <span>{t('Page {page} of {pages}', { page: currentPage, pages })}</span>
                            <Pagination isCompact showControls color="danger" page={currentPage} total={pages} onChange={setPage} />
                        </div>
                    )}
                </AsyncState>
            </SectionCard>

            {checking && (
                <CheckForm
                    kind={checking.kind}
                    attendance={checking.attendance}
                    onClose={() => setChecking(null)}
                    onDone={() => {
                        setChecking(null);
                        today.reload();
                        history.reload();
                    }}
                />
            )}

            <Modal isOpen={Boolean(proof)} onOpenChange={(open) => !open && setProof(null)} size="lg">
                <ModalContent>
                    <ModalHeader>{proof?.label}</ModalHeader>
                    <ModalBody className="pb-6">{proof && <Image src={proof.url} alt={proof.label} />}</ModalBody>
                </ModalContent>
            </Modal>
        </>
    );
};

export default CheckIn;
