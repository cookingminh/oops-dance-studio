import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuGift, LuReceipt } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import { setRenewal } from '@/services/tuition';
import { forgetMyTuition } from '@/services/tuitionStudent';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import { stagger } from '../../../../../admin-staff/components/common/motion';
import NowCard from './NowCard';
import PayDialog from './PayDialog';
import RenewalCalendar from './RenewalCalendar';
import RenewalCard from './RenewalCard';
import StopDialog from './StopDialog';
import TuitionHero from './TuitionHero';
import TuitionHistory from './TuitionHistory';
import { arrangeTuition } from './tuitionData';
import { useMyTuition } from './useMyTuition';
import './tuition.scss';

// /profile/tuition (students): tuition per course (khoá). What's owed and by when, pay any course
// with one scan, answer the renewal of each class's next course, and the courses already paid.
// ?pay=<invoice id> opens that invoice's QR straight away (the overview card and the class view link here).
const MyTuition = () => {
    const toast = useToast();
    const data = useMyTuition({ fresh: true });
    const [params, setParams] = useSearchParams();
    const [paying, setPaying] = useState(null); // invoice in the pay dialog
    const [stopping, setStopping] = useState(null); // invoice waiting for "are you sure?"
    const [busyId, setBusyId] = useState(null);
    const [offerId, setOfferId] = useState(null); // just said "continue": offer to pay now

    const { today, invoices = [], settings, sandbox } = data.data ?? {};
    const view = today ? arrangeTuition(data.data) : null;

    // Deep link from the overview or a class: open that invoice's QR once the page has loaded.
    const wanted = Number(params.get('pay'));
    useEffect(() => {
        if (!wanted || !data.data) return;
        const invoice = arrangeTuition(data.data).all.find((row) => row.id === wanted);
        if (invoice?.status === 'unpaid') setPaying(invoice);
        setParams({}, { replace: true });
    }, [wanted, data.data, setParams]);

    const answer = async (invoice, decision) => {
        setBusyId(invoice.id);
        try {
            await setRenewal(invoice.id, decision);
            forgetMyTuition();
            if (decision === 'continue') {
                toast.success(invoice.status === 'void' ? 'Welcome back! You’re in again.' : 'Great, you’re continuing!');
                setOfferId(invoice.id);
            } else {
                toast.success(invoice.course?.phase === 'planned' ? 'Got it. You’ll stop when the current course ends.' : 'You’ve left the class.');
            }
            setStopping(null);
            await data.reload();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusyId(null);
        }
    };

    const closePay = () => {
        setPaying(null);
        setOfferId(null);
        data.refresh();
    };

    return (
        <motion.div className="tuPage" variants={stagger}>
            <AsyncState state={data} isEmpty={false}>
                {view && invoices.length === 0 && <NoTuition />}
                {view && invoices.length > 0 && (
                    <>
                        <TuitionHero view={view} settings={settings} onPay={setPaying} />
                        <NowCard view={view} today={today} busyId={busyId} onPay={setPaying} onAnswer={answer} onStop={setStopping} />
                        {view.upcoming.length ? (
                            <RenewalCard
                                invoices={view.upcoming}
                                all={view.all}
                                today={today}
                                busyId={busyId}
                                offerId={offerId}
                                onPay={setPaying}
                                onAnswer={answer}
                                onStop={setStopping}
                                onDismissOffer={() => setOfferId(null)}
                            />
                        ) : (
                            <RenewalCalendar settings={settings} />
                        )}
                        <TuitionHistory view={view} today={today} />
                    </>
                )}
            </AsyncState>

            {paying && <PayDialog invoice={paying} settings={settings} sandbox={sandbox} onClose={closePay} onPaid={() => data.refresh()} />}
            {stopping && (
                <StopDialog
                    invoice={stopping}
                    busy={busyId === stopping.id}
                    onCancel={() => setStopping(null)}
                    onConfirm={() => answer(stopping, 'stop')}
                />
            )}
        </motion.div>
    );
};

// No invoices yet: tuition starts with the first class (and that one is free).
const NoTuition = () => {
    const { t } = useI18n();
    return (
        <SectionCard className="tuEmptyCard">
            <div className="pfEmpty">
                <span className="pfEmptyArt" aria-hidden="true">
                    <LuReceipt />
                </span>
                <strong>{t('Nothing to pay yet')}</strong>
                <p>{t('Once you join a class, the tuition of each course shows up here and you can pay with one scan. Your first class is on the house!')}</p>
                <div className="pfEmptyActions">
                    <Link to="/classes" className="pfBtn isPrimary">
                        <LuGift aria-hidden="true" /> {t('Your first class is free')}
                    </Link>
                </div>
            </div>
        </SectionCard>
    );
};

export default MyTuition;
