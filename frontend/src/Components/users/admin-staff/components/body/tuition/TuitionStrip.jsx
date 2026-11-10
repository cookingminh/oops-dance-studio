import { motion } from 'framer-motion';
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input } from '@nextui-org/react';
import { LuDownload, LuMoreHorizontal, LuPlay, LuSearch, LuSettings2 } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { EASE_OUT, fadeUp } from '../../common/motion';

const MENU_ICONS = { export: LuDownload, check: LuPlay, settings: LuSettings2 };

// The top of the tuition page in one line: the running courses' money (collected of what they ask
// for, with a thin bar), what is still owed and how many people are late — then the search and the
// ⋯ menu (export, the daily check, and the payment settings for admins).
const TuitionStrip = ({ money, latePeople, loading, query, onQuery, isAdmin, busy, onMenu }) => {
    const { t, tn } = useI18n();
    const pct = money.rate === null ? 0 : Math.min(100, Math.round(money.rate * 100));
    const menu = [
        { key: 'export', label: t('Export CSV…') },
        { key: 'check', label: t('Run today’s check') },
        ...(isAdmin ? [{ key: 'settings', label: t('Payment settings') }] : []),
    ];

    return (
        <motion.section variants={fadeUp} className={`adminCard tuStrip${loading ? ' isLoading' : ''}`} aria-label={t('Tuition of the running courses')}>
            <div className="tuStripStats">
                <span className="tuStripStat isCollected">
                    <span className="tuStripLabel">{t('Running courses')}</span>
                    <span>
                        <strong>{formatVnd(money.collected)}</strong> <small>{t('collected of {amount}', { amount: formatVnd(money.billed) })}</small>
                    </span>
                    <span className="tuStripBar" role="progressbar" aria-label={t('Collected of billed')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                        <motion.span initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: EASE_OUT }} />
                    </span>
                </span>
                <span className="tuStripStat">
                    <strong>{formatVnd(money.owed)}</strong> <small>{t('still owed')}</small>
                </span>
                <span className={`tuStripStat${latePeople ? ' isBad' : ' isGood'}`}>
                    <strong>{latePeople}</strong> <small>{tn(latePeople, 'person late', 'people late')}</small>
                </span>
            </div>
            <div className="tuStripTools">
                <Input
                    isClearable
                    size="sm"
                    aria-label={t('Find a student or an OOPS code')}
                    placeholder={t('Find a student or an OOPS code')}
                    className="tuSearch"
                    startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                    value={query}
                    onValueChange={onQuery}
                    onClear={() => onQuery('')}
                />
                <Dropdown placement="bottom-end" classNames={{ content: 'adminPortal' }}>
                    <DropdownTrigger>
                        <Button isIconOnly variant="flat" isLoading={busy} aria-label={t('More tuition tools')} className="tuStripMenu">
                            <LuMoreHorizontal />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label={t('More tuition tools')} items={menu} onAction={(key) => onMenu(String(key))}>
                        {(item) => {
                            const Icon = MENU_ICONS[item.key];
                            return (
                                <DropdownItem key={item.key} startContent={<Icon aria-hidden="true" />}>
                                    {item.label}
                                </DropdownItem>
                            );
                        }}
                    </DropdownMenu>
                </Dropdown>
            </div>
        </motion.section>
    );
};

export default TuitionStrip;
