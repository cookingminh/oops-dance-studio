import { Input } from '@nextui-org/react';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../../../common/Segmented';
import PriceReasonChips from '../PriceReasonChips';


// The money part of a new booking: the price the room gives (live with room and times), another agreed
// price with its required reason, held or approved, and money taken now (nothing / deposit / full / other)
// with its method. `money` = { price, priceNote, changing, status, paidKind, other, method, paymentNote }.
const NewBookingMoney = ({ room, hours, list, money, set }) => {
    const { t } = useI18n();
    const total = money.changing && money.price !== '' ? Number(money.price) : list;
    const deposit = total === null ? null : Math.round(total * 0.5);
    const rate = room ? Number(room.price ?? 0) : 0;

    return (
        <div className="bfMoney">
            <div className="bfPrice">
                <span className="bfLabel">{t('Room price')}</span>
                {list === null ? (
                    <p className="bfMuted">{t('Pick the room and the times to see the price.')}</p>
                ) : (
                    <p className="bfPriceLine">
                        {t('{room} · {rate}/h × {hours} h = {total} · deposit 50% = {deposit}', {
                            room: room.name,
                            rate: formatVnd(rate),
                            hours,
                            total: formatVnd(list),
                            deposit: formatVnd(Math.round(list * 0.5)),
                        })}
                    </p>
                )}
                {list !== null && !money.changing && (
                    <button type="button" className="bfLink" onClick={() => set({ changing: true, price: String(list) })}>
                        {t('Change price')}
                    </button>
                )}
                {money.changing && list !== null && (
                    <div className="bfChange">
                        <Input type="number" size="sm" label={t('New total (VND)')} value={money.price} onValueChange={(price) => set({ price })} min={0} step={1000} />
                        <Input
                            size="sm"
                            label={t('Reason')}
                            value={money.priceNote}
                            onValueChange={(priceNote) => set({ priceNote })}
                            maxLength={300}
                            isRequired={total !== list}
                            isInvalid={total !== list && !money.priceNote.trim()}
                            errorMessage={total !== list && !money.priceNote.trim() ? t('Say why the price changes.') : undefined}
                        />
                        <PriceReasonChips
                            list={list}
                            total={total}
                            rate={Math.round(rate)}
                            onPick={(option) => set({ ...(option.amount !== undefined ? { price: String(option.amount) } : {}), priceNote: option.label })}
                            onBack={() => set({ changing: false, price: '', priceNote: '' })}
                        />
                        {total !== null && total !== list && (
                            <p className="bfMuted">
                                {t('Agreed price {total} · deposit 50% = {deposit}', { total: formatVnd(total), deposit: formatVnd(deposit) })}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="bfRow">
                <span className="bfLabel">{t('Status')}</span>
                <Segmented
                    label={t('Status')}
                    options={[
                        { key: 'approved', label: t('Approved') },
                        { key: 'pending', label: t('Hold (pending)') },
                    ]}
                    value={money.status}
                    onChange={(status) => set({ status })}
                />
            </div>

            <div className="bfRow">
                <span className="bfLabel">{t('Payment now')}</span>
                <Segmented
                    label={t('Payment now')}
                    options={[
                        { key: 'none', label: t('Nothing yet') },
                        { key: 'deposit', label: deposit === null ? t('Deposit') : `${t('Deposit')} · ${formatVnd(deposit)}` },
                        { key: 'full', label: total === null ? t('Full price') : `${t('Full price')} · ${formatVnd(total)}` },
                        { key: 'other', label: t('Other amount') },
                    ]}
                    value={money.paidKind}
                    onChange={(paidKind) => set({ paidKind })}
                />
            </div>
            {money.paidKind === 'none' ? (
                <p className="bfMuted">{t('The guest pays later: the booking’s QR code opens after saving, to show or send.')}</p>
            ) : (
                <div className="bfTaken">
                    {money.paidKind === 'other' && (
                        <Input type="number" size="sm" label={t('Amount received (VND)')} value={money.other} onValueChange={(other) => set({ other })} min={0} step={1000} />
                    )}
                    <Segmented
                        label={t('Method')}
                        options={[
                            { key: 'cash', label: t('Cash') },
                            { key: 'transfer', label: t('Transfer (seen by hand)') },
                        ]}
                        value={money.method}
                        onChange={(method) => set({ method })}
                    />
                    <Input size="sm" label={t('Payment note')} placeholder={t('Optional')} value={money.paymentNote} onValueChange={(paymentNote) => set({ paymentNote })} maxLength={300} />
                </div>
            )}
        </div>
    );
};

export default NewBookingMoney;
