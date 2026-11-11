import { motion } from 'framer-motion';
import { Button, Spinner } from '@nextui-org/react';
import { LuLock, LuPencil, LuShieldCheck } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import PolicyLines from '@/ui/refunds/PolicyLines';
import { policyLines } from '@/ui/refunds/refundText';
import { fadeUp } from '../../../../common/motion';
import { studioDay } from '../refunds/refundModel';

// The cancellation policy next to the room prices: the lines guests read when they book and when they
// cancel. Admins change it here (RefundPolicyDialog, `onEdit`); staff read it.
const PolicyCard = ({ state, isAdmin, onEdit }) => {
    const { t, formatDate } = useI18n();
    const settings = state.data;
    const updated = studioDay(settings?.updated_at);

    return (
        <motion.aside variants={fadeUp} className="bkPolicyCard" aria-labelledby="bk-policy-title">
            <header className="bkPolicyHead">
                <span className="bkPolicyIcon" aria-hidden="true">
                    <LuShieldCheck />
                </span>
                <span>
                    <h3 id="bk-policy-title">{t('Cancellation policy')}</h3>
                    <small>{t('What guests read when they book and when they cancel.')}</small>
                </span>
            </header>
            {settings ? (
                <PolicyLines lines={policyLines(settings)} className="bkPolicyLines" />
            ) : state.error ? (
                <p className="bkPolicyMeta">{t(state.error.message ?? 'Something went wrong.')}</p>
            ) : (
                <Spinner size="sm" color="danger" />
            )}
            {updated && <p className="bkPolicyMeta">{t('Last changed {date}', { date: formatDate(updated, 'shortYear') })}</p>}
            {isAdmin ? (
                <Button variant="bordered" className="bkPolicyEdit" startContent={<LuPencil aria-hidden="true" />} isDisabled={!settings} onPress={onEdit}>
                    {t('Edit the policy')}
                </Button>
            ) : (
                <p className="bkPolicyMeta isLock">
                    <LuLock aria-hidden="true" /> {t('Only an admin can change the policy.')}
                </p>
            )}
        </motion.aside>
    );
};

export default PolicyCard;
