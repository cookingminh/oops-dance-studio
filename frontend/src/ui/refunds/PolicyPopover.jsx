import { Button, Popover, PopoverContent, PopoverTrigger } from '@nextui-org/react';
import { LuShieldCheck } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import PolicyLines from './PolicyLines';
import { policyLines } from './refundText';

// "Cancellation policy" as a small button that opens the policy's lines (My bookings header, the
// booking form). `settings` is booking_settings (getBookingSettings); nothing shows without it.
// `portalClassName` styles the pop-over outside the page (e.g. 'adminPortal' for the workspace tokens).
const PolicyPopover = ({ settings, label, size = 'sm', variant = 'light', className = '', portalClassName = '', placement = 'bottom-end' }) => {
    const { t } = useI18n();
    if (!settings) return null;
    return (
        <Popover placement={placement} offset={8} classNames={{ base: `rfPopover ${portalClassName}` }}>
            <PopoverTrigger>
                <Button size={size} variant={variant} className={`rfPolicyBtn ${className}`} startContent={<LuShieldCheck aria-hidden="true" />}>
                    {label ?? t('Cancellation policy')}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="rfPopoverBody">
                <strong className="rfPopoverTitle">{t('Cancellation policy')}</strong>
                <PolicyLines lines={policyLines(settings)} />
            </PopoverContent>
        </Popover>
    );
};

export default PolicyPopover;
