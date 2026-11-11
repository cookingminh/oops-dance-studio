import { Chip } from '@nextui-org/react';
import { useI18n } from '@/i18n/i18nContext';
import { formatClock } from '@/lib/format';
import { statusColorMap } from '../../../../../../Table/utils';
import { sessionTimesOf } from '@/lib/lessons';
import { ClassThumb } from '../classes/ClassParts';
import ProofThumb from './ProofThumb';
import MakeUpTag from '../../../../../admin-staff/components/body/class-manager/routines/MakeUpTag';
import LateTag from '../../../../../admin-staff/components/common/checkins/LateTag';

// Phone layout of the check-in history: one compact card per session instead of a wide table.
const HistoryList = ({ rows, onView }) => {
    const { t, formatDate } = useI18n();
    if (rows.length === 0) return <p className="pfMuted pfHistoryEmpty">{t('No sessions in this period.')}</p>;
    return (
        <ul className="pfHistoryList" aria-label={t('My attendance records')}>
            {rows.map((row) => (
                <li key={row.id}>
                    <div className="pfHistoryHead">
                        <ClassThumb cls={row.class ?? {}} />
                        <span className="pfHistoryText">
                            <strong>
                                {row.class?.name}
                                {row.is_extra && <MakeUpTag className="sessionTag" />}
                            </strong>
                            <span>
                                {formatDate(row.date, 'short')} · {sessionTimesOf(row).start} · {row.room?.name}
                            </span>
                        </span>
                        <Chip size="sm" variant="flat" className="capitalize" color={statusColorMap[row.status] ?? 'default'}>
                            {t(row.status.replace('_', ' '))}
                        </Chip>
                    </div>
                    <div className="pfHistoryTimes">
                        {[
                            { label: t('Check-in'), proofLabel: t('Check-in proof'), at: row.checkin_at, url: row.checkin_proof_url },
                            { label: t('Check-out'), proofLabel: t('Check-out proof'), at: row.checkout_at, url: row.checkout_proof_url, late: row.checkout_late },
                        ].map((step) => (
                            <span key={step.label} className="pfProofCell">
                                <ProofThumb url={step.url} label={step.proofLabel} onView={onView} />
                                <span className="pfHistoryTime">
                                    <small>{step.label}</small>
                                    <strong className={step.at ? undefined : 'isMuted'}>{step.at ? formatClock(step.at) : '—'}</strong>
                                    {step.late && <LateTag />}
                                </span>
                            </span>
                        ))}
                    </div>
                </li>
            ))}
        </ul>
    );
};

export default HistoryList;
