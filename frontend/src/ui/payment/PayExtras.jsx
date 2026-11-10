import { Button } from '@nextui-org/react';
import { motion } from 'framer-motion';
import { LuCheck, LuFlaskConical } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import './payment.scss';

const EASE_OUT = [0.22, 1, 0.36, 1];

// Sandbox only (local stack, hosted demo): pretend to be the bank.
export const SandboxBox = ({ text, label, busy, onSimulate }) => {
    const { t } = useI18n();
    return (
        <div className="tuSandbox">
            <span className="tuSandboxTag">
                <LuFlaskConical aria-hidden="true" /> {t('Demo mode')}
            </span>
            <p>{text}</p>
            <Button size="sm" variant="bordered" className="tuSandboxBtn" onPress={onSimulate} isLoading={busy}>
                {label}
            </Button>
        </div>
    );
};

// "Waiting for your transfer…" with a breathing dot; `stopped` shows a plain line instead.
export const WaitingNote = ({ title, text, stopped }) =>
    stopped ? (
        <p className="tuWaiting isStopped">{stopped}</p>
    ) : (
        <p className="tuWaiting" role="status">
            <span className="pfPulse" aria-hidden="true" />
            <span>
                <strong>{title}</strong>
                <small>{text}</small>
            </span>
        </p>
    );

// A short celebration once the server says it's paid.
export const PaidCelebration = ({ title, text, amount, onDone }) => {
    const { t } = useI18n();
    return (
        <motion.div className="tuPaidMoment" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
            <span className="tuPaidBurst" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => (
                    <i key={index} style={{ '--i': index }} />
                ))}
                <motion.span
                    className="tuPaidCheck"
                    initial={{ scale: 0.4, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.05 }}
                >
                    <LuCheck />
                </motion.span>
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
            <span className="tuPaidAmount">{amount}</span>
            <Button color="danger" className="tuPaidDone" onPress={onDone}>
                {t('Done')}
            </Button>
        </motion.div>
    );
};
