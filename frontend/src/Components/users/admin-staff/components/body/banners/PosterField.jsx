import { useRef, useState } from 'react';
import { LuAlertTriangle, LuCheck, LuLoader2, LuMonitor, LuSmartphone, LuUpload } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { BANNER_SPECS, judgePoster } from '@/services/banners';

const CANVA = { desktop: 'Canva: “Presentation (16:9)”', phone: 'Canva: “Instagram Story”' };

// One poster (desktop or phone): click or drop an image; it uploads at once and says whether it fits the size.
//   poster    { path, width, height, url } | null
//   uploading true while the file goes up (the picked image already shows)
//   onPick(file)
const PosterField = ({ device, poster, uploading, onPick }) => {
    const { t } = useI18n();
    const input = useRef(null);
    const [over, setOver] = useState(false);
    const spec = BANNER_SPECS[device];
    const verdict = poster && judgePoster(device, poster.width, poster.height);
    const Icon = device === 'desktop' ? LuMonitor : LuSmartphone;

    const pick = (file) => {
        if (file) onPick(file);
    };

    let note;
    if (uploading) {
        note = (
            <span className="bnVerdict is-busy">
                <LuLoader2 className="bnSpin" aria-hidden="true" /> {t('Uploading…')}
            </span>
        );
    } else if (!verdict) {
        note = <span className="bnVerdict is-none">{t('No poster yet: click or drop an image')}</span>;
    } else if (verdict.tone === 'ok') {
        note = (
            <span className="bnVerdict is-ok">
                <LuCheck aria-hidden="true" /> {t('{width} × {height} · fits', { width: verdict.width, height: verdict.height })}
            </span>
        );
    } else {
        const wider = verdict.width / verdict.height > spec.ratio;
        note = (
            <span className="bnVerdict is-warn">
                <LuAlertTriangle aria-hidden="true" />
                <span>
                    {verdict.tone === 'shape'
                        ? t('{width} × {height} isn’t {shape}. It still shows whole, with blurred bands {where}. Better: {size}.', {
                              width: verdict.width,
                              height: verdict.height,
                              shape: t(spec.label).toLowerCase(),
                              where: wider ? t('above and below') : t('on the sides'),
                              size: `${spec.width} × ${spec.height}`,
                          })
                        : t('{width} × {height} is a little small: it may look blurry on big screens. Better: {size}.', {
                              width: verdict.width,
                              height: verdict.height,
                              size: `${spec.width} × ${spec.height}`,
                          })}
                </span>
            </span>
        );
    }

    return (
        <div
            className={`bnPosterField is-${device}${over ? ' isOver' : ''}`}
            onDragOver={(event) => {
                event.preventDefault();
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
                event.preventDefault();
                setOver(false);
                pick(event.dataTransfer.files?.[0]);
            }}
        >
            <button type="button" className="bnPosterPick" onClick={() => input.current?.click()} aria-label={t('Choose the {device} poster', { device: t(device === 'desktop' ? 'desktop' : 'phone') })}>
                <span className="bnPosterThumb">
                    {poster?.url ? (
                        <img src={poster.url} alt="" draggable={false} />
                    ) : (
                        <span className="bnPosterFrame" aria-hidden="true">
                            <LuUpload />
                        </span>
                    )}
                </span>
            </button>
            <span className="bnPosterMeta">
                <strong>
                    <Icon aria-hidden="true" /> {t(device === 'desktop' ? 'Desktop poster' : 'Phone poster')}
                </strong>
                <span className="bnPosterSpec">
                    {t(spec.label)} · {spec.width} × {spec.height} px · {t(CANVA[device])}
                </span>
                {note}
                <button type="button" className="bnLinkButton" onClick={() => input.current?.click()}>
                    {poster ? t('Change the image') : t('Choose an image')}
                </button>
            </span>
            <input
                ref={input}
                type="file"
                accept="image/*"
                hidden
                data-device={device}
                onChange={(event) => {
                    pick(event.target.files?.[0]);
                    event.target.value = '';
                }}
            />
        </div>
    );
};

export default PosterField;
