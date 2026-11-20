import { Input, Switch } from '@nextui-org/react';
import { LuMonitor, LuSmartphone, LuTrash2 } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { BANNER_COLORS, BANNER_LINKS, BANNER_SCALE } from '@/services/banners';
import { isHttps } from './bannerModel';

const SPOTS = [
    ['Top left', 'Top centre', 'Top right'],
    ['Middle left', 'Centre', 'Middle right'],
    ['Bottom left', 'Bottom centre', 'Bottom right'],
];

// One button's settings: words (Vietnamese, English), where it leads (a page or an own https link), colour, arrow,
// and — for the poster being previewed (desktop or phone) — its size and a quick spot.
const ButtonFields = ({ button, index, device, selected, onSelect, onChange, onSpot, onQuick, onRemove }) => {
    const { t } = useI18n();
    const spot = button[device];
    const DeviceIcon = device === 'desktop' ? LuMonitor : LuSmartphone;
    const deviceName = t(device === 'desktop' ? 'desktop' : 'phone');
    const badUrl = button.link === 'url' && button.url.trim() !== '' && !isHttps(button.url);
    const id = (field) => `bn-${button.id}-${field}`;

    return (
        // Clicking anywhere in the card (or focusing a field in it) selects its button on the preview.
        <section onFocus={onSelect} className={`bnButtonCard${selected ? ' isSelected' : ''}`} onClick={onSelect} aria-label={t('Button {n}', { n: index + 1 })} data-button={button.id}>
            <header>
                <strong>{t('Button {n}', { n: index + 1 })}</strong>
                <button type="button" className="bnLinkButton isDanger" onClick={onRemove}>
                    <LuTrash2 aria-hidden="true" /> {t('Remove')}
                </button>
            </header>

            <div className="bnTwo">
                <Input
                    size="sm"
                    label={t('Words on the button')}
                    value={button.text_vi}
                    onValueChange={(value) => onChange({ text_vi: value })}
                    maxLength={30}
                    isRequired
                    isInvalid={!button.text_vi.trim()}
                    errorMessage={!button.text_vi.trim() ? t('Write the words') : undefined}
                />
                <Input
                    size="sm"
                    label={t('In English (optional)')}
                    value={button.text_en}
                    placeholder={button.text_vi}
                    onValueChange={(value) => onChange({ text_en: value })}
                    maxLength={30}
                />
            </div>

            <div className="bnField">
                <label htmlFor={id('link')}>{t('Leads to')}</label>
                <select id={id('link')} className="bnSelect" value={button.link} onChange={(event) => onChange({ link: event.target.value })}>
                    {BANNER_LINKS.map((link) => (
                        <option key={link.key} value={link.key}>
                            {t(link.label)}
                        </option>
                    ))}
                </select>
            </div>
            {button.link === 'url' && (
                <Input
                    size="sm"
                    type="url"
                    label={t('Link (opens in a new tab)')}
                    placeholder="https://www.facebook.com/…"
                    value={button.url}
                    onValueChange={(value) => onChange({ url: value })}
                    isInvalid={badUrl}
                    errorMessage={badUrl ? t('A link starts with https://') : undefined}
                    description={!badUrl ? t('For example a Facebook post, a sign-up form or a video.') : undefined}
                />
            )}

            <div className="bnField">
                <span className="bnLabel">{t('Colour')}</span>
                <div className="bnSwatches" role="radiogroup" aria-label={t('Colour of button {n}', { n: index + 1 })}>
                    {BANNER_COLORS.map((color) => (
                        <button
                            key={color.key}
                            type="button"
                            role="radio"
                            aria-checked={button.color === color.key}
                            aria-label={t(color.label)}
                            title={t(color.label)}
                            className={`bnSwatch c-${color.key}`}
                            onClick={() => onChange({ color: color.key })}
                        />
                    ))}
                </div>
            </div>

            <Switch size="sm" color="danger" isSelected={button.arrow} onValueChange={(arrow) => onChange({ arrow })} className="bnSwitch">
                {t('Arrow after the words')}
            </Switch>

            <div className="bnDeviceBox">
                <span className="bnDeviceTitle">
                    <DeviceIcon aria-hidden="true" /> {t('On the {device} poster', { device: deviceName })}
                </span>
                <div className="bnField">
                    <label htmlFor={id('scale')}>
                        {t('Button size')} <output htmlFor={id('scale')}>{Math.round((spot?.scale ?? 1) * 100)}%</output>
                    </label>
                    <input
                        id={id('scale')}
                        className="bnRange"
                        type="range"
                        min={BANNER_SCALE.min}
                        max={BANNER_SCALE.max}
                        step={BANNER_SCALE.step}
                        value={spot?.scale ?? 1}
                        onChange={(event) => onSpot({ scale: Number(event.target.value) })}
                        aria-label={t('Size of button {n} on the {device} poster', { n: index + 1, device: deviceName })}
                    />
                </div>
                <div className="bnQuickRow">
                    <div className="bnQuick" role="group" aria-label={t('Quick spot for button {n}', { n: index + 1 })}>
                        {SPOTS.map((row, r) =>
                            row.map((label, c) => (
                                <button key={label} type="button" aria-label={t(label)} title={t(label)} onClick={() => onQuick(c, r)} />
                            ))
                        )}
                    </div>
                    <p className="bnHint">{t('Or drag the button on the preview. Its handle in the corner changes its size.')}</p>
                </div>
            </div>
        </section>
    );
};

export default ButtonFields;
