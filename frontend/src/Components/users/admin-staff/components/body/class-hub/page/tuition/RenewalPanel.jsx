import { Button } from '@nextui-org/react';
import { LuCheck, LuDoorOpen, LuHelpCircle, LuRepeat, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../../../common/SectionCard';
import { renewalSummary } from '../../../tuition/tuitionModel';
import { unbilledMembers } from './courseModel';

const GROUPS = [
    { key: 'continue', label: 'Continuing', icon: LuCheck, tone: 'yes' },
    { key: 'none', label: 'No answer yet', icon: LuHelpCircle, tone: 'none' },
    { key: 'stop', label: 'Stopping', icon: LuX, tone: 'no' },
];

// The next course's renewal: who continues, who hasn't answered, who stops — and, before it
// opens by itself, "Open renewal now". The rules are spelled out so staff can explain them.
const RenewalPanel = ({ cls, next, current, settings, busy, onOpen }) => {
    const { t, tn, formatDate } = useI18n();
    const opensAt = settings?.renewal_open_sessions ?? 2;
    const dueSession = settings?.due_session ?? 2;
    const { course, invoices } = next;
    const summary = renewalSummary(invoices);
    const missing = unbilledMembers(cls, invoices);
    const open = invoices.length > 0;
    const left = current ? current.session_count - current.sessions_held : null;

    return (
        <SectionCard
            icon={LuRepeat}
            title={t('Renewal: {title}', { title: course.title })}
            subtitle={t('Next course, from {date}', { date: formatDate(course.starts_on, 'long') })}
            className="hubRenewal"
            actions={
                missing.length > 0 && (
                    <Button color="danger" variant={open ? 'flat' : 'solid'} startContent={<LuDoorOpen aria-hidden="true" />} isLoading={busy} onPress={onOpen}>
                        {open ? tn(missing.length, 'Bill {count} more student', 'Bill {count} more students') : t('Open renewal now')}
                    </Button>
                )
            }
        >
            {open ? (
                <>
                    <div className="hubRenewBar" role="img" aria-label={t('{yes} continuing, {none} no answer, {no} stopping', { yes: summary.continue.length, none: summary.none.length, no: summary.stop.length })}>
                        {GROUPS.map((group) =>
                            summary[group.key].length ? <span key={group.key} className={`is-${group.tone}`} style={{ flexGrow: summary[group.key].length }} /> : null
                        )}
                    </div>
                    <div className="hubRenewGroups">
                        {GROUPS.map(({ key, label, icon: Icon, tone }) => (
                            <div key={key} className={`hubRenewGroup is-${tone}`}>
                                <span className="hubRenewHead">
                                    <Icon aria-hidden="true" />
                                    {t(label)}
                                    <span className="segCount">{summary[key].length}</span>
                                </span>
                                <span className="hubRenewNames">
                                    {summary[key].length ? summary[key].map((invoice) => <span key={invoice.id}>{invoice.student_name}</span>) : <em>—</em>}
                                </span>
                            </div>
                        ))}
                    </div>
                    {summary.paid > 0 && <p className="hubHint">{tn(summary.paid, '{count} has already paid.', '{count} have already paid.')}</p>}
                </>
            ) : (
                <p className="hubHint">
                    {left !== null
                        ? t('Not open yet. It opens by itself when “{title}” has {count} or fewer sessions left ({left} left now).', { title: current.title, count: opensAt, left })
                        : t('Not open yet. It opens by itself; you can open it now to bill everyone in the class.')}
                </p>
            )}
            <ul className="hubRules">
                <li>{t('The next course’s renewal opens by itself when the running course has {count} or fewer sessions left.', { count: opensAt })}</li>
                <li>{t('Students pay or answer by session {count} of the new course.', { count: dueSession })}</li>
                <li>{t('Students who haven’t paid or answered leave the class when that course starts.')}</li>
            </ul>
        </SectionCard>
    );
};

export default RenewalPanel;
