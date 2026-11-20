import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/i18nContext';
import { BANNER_SAFE } from '@/services/banners';
import BannerPoster from '@/ui/banners/BannerPoster';
import logoMark from '@/assets/images/logo-mark.webp';
import { PREVIEW_PRESETS, clamp, roundScale } from './bannerModel';
const SNAP = 1.2; // % of the poster
const round1 = (value) => Math.round(value * 10) / 10;

// The banner on a copy of the homepage hero (the transparent navbar on top, the slide bar at the bottom).
// Buttons are dragged with the mouse or a finger, snap to the poster's centre lines and to each other (pink guides),
// resize from the handle in their corner, and move with the arrow keys (Shift: further) or resize with + / −.
// They stay inside the safe area (BANNER_SAFE). Positions and sizes belong to the poster shown (desktop or phone).
//   ref.current.measure(id) → the button's half width / height in % of the poster.
const BannerPreview = forwardRef(function BannerPreview(
    { draft, preset, lang, showZones, selectedId, onSelect, onSpot, slideLabel },
    ref
) {
    const { t } = useI18n();
    const wrap = useRef(null);
    const viewport = useRef(null);
    const drag = useRef(null);
    const [room, setRoom] = useState(760);
    const [guides, setGuides] = useState({ x: null, y: null });
    const [dragging, setDragging] = useState(null);
    const screen = PREVIEW_PRESETS[preset];
    const device = screen.device;
    const safe = BANNER_SAFE[device];

    useLayoutEffect(() => {
        const box = wrap.current;
        if (!box) return undefined;
        const observer = new ResizeObserver(() => setRoom(box.clientWidth - 32));
        observer.observe(box);
        setRoom(box.clientWidth - 32);
        return () => observer.disconnect();
    }, []);

    const scale = Math.min(Math.max(room, 200) / screen.width, (device === 'phone' ? 640 : 560) / screen.height, 1);

    const elementOf = (id) => viewport.current?.querySelector(`.bnStage.is-${device} [data-btn="${id}"]`);
    const measure = (id) => {
        const el = elementOf(id);
        if (!el) return { w: 6, h: 3 };
        const stage = el.closest('.bnStage').getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return { w: (box.width / stage.width) * 50, h: (box.height / stage.height) * 50 };
    };
    useImperativeHandle(ref, () => ({ measure }));

    const inside = (x, y, half) => ({
        x: clamp(x, safe.x0 + half.w, Math.max(safe.x0 + half.w, safe.x1 - half.w)),
        y: clamp(y, safe.y0 + half.h, Math.max(safe.y0 + half.h, safe.y1 - half.h)),
    });

    const start = (event, button) => {
        if (event.button !== 0) return;
        const el = event.currentTarget;
        const stage = el.closest('.bnStage').getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const spot = button[device];
        onSelect(button.id);
        el.setPointerCapture(event.pointerId);
        drag.current = {
            id: button.id,
            mode: event.target.closest('.beResize') ? 'resize' : 'move',
            stage,
            startX: event.clientX,
            dx: event.clientX - (box.left + box.width / 2),
            dy: event.clientY - (box.top + box.height / 2),
            hw: (box.width / stage.width) * 50,
            hh: (box.height / stage.height) * 50,
            width: box.width,
            spot,
        };
        setDragging(button.id);
        event.preventDefault();
    };

    const move = (event) => {
        const d = drag.current;
        if (!d) return;
        if (d.mode === 'move') {
            let { x, y } = inside(
                ((event.clientX - d.dx - d.stage.left) / d.stage.width) * 100,
                ((event.clientY - d.dy - d.stage.top) / d.stage.height) * 100,
                { w: d.hw, h: d.hh }
            );
            const others = draft.buttons.filter((button) => button.id !== d.id).map((button) => button[device]);
            let gx = null;
            let gy = null;
            const nearX = others.find((other) => Math.abs(other.x - x) < SNAP);
            const nearY = others.find((other) => Math.abs(other.y - y) < SNAP);
            if (Math.abs(x - 50) < SNAP) [x, gx] = [50, 50];
            else if (nearX) [x, gx] = [nearX.x, nearX.x];
            if (Math.abs(y - 50) < SNAP) [y, gy] = [50, 50];
            else if (nearY) [y, gy] = [nearY.y, nearY.y];
            setGuides({ x: gx, y: gy });
            onSpot(d.id, device, { x: round1(x), y: round1(y) });
        } else {
            // The button stays centred, so dragging its right edge grows it on both sides.
            const from = d.spot.scale ?? 1;
            const nextScale = roundScale((from * (d.width + 2 * (event.clientX - d.startX))) / d.width);
            const k = nextScale / from;
            const { x, y } = inside(d.spot.x, d.spot.y, { w: d.hw * k, h: d.hh * k });
            onSpot(d.id, device, { scale: nextScale, x: round1(x), y: round1(y) });
        }
    };

    const end = () => {
        drag.current = null;
        setDragging(null);
        setGuides({ x: null, y: null });
    };

    const keys = (event, button) => {
        const spot = button[device];
        const step = event.shiftKey ? 2 : 0.5;
        const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (moves[event.key]) {
            const half = measure(button.id);
            const { x, y } = inside(spot.x + moves[event.key][0], spot.y + moves[event.key][1], half);
            onSpot(button.id, device, { x: round1(x), y: round1(y) });
        } else if (['+', '=', '-', '_'].includes(event.key)) {
            const nextScale = roundScale((spot.scale ?? 1) + (event.key === '-' || event.key === '_' ? -0.05 : 0.05));
            onSpot(button.id, device, { scale: nextScale });
        } else return;
        event.preventDefault();
    };

    const renderButton = (button, { className, style, children }) => (
        <div
            key={button.id}
            data-btn={button.id}
            className={`${className} beBtn${button.id === selectedId ? ' isSelected' : ''}${dragging === button.id ? ' isDragging' : ''}`}
            style={style}
            role="button"
            tabIndex={0}
            aria-label={t('{words}: drag to move it, arrow keys to nudge it, + and − to change its size', { words: button.text_vi || t('Button') })}
            onPointerDown={(event) => start(event, button)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(event) => keys(event, button)}
            onFocus={() => onSelect(button.id)}
        >
            {children}
            {button.id === selectedId && <span className="beResize" title={t('Drag to resize')} aria-hidden="true" />}
        </div>
    );

    const overlay = () => (
        <>
            {showZones && (
                <>
                    <div className="beZone is-top" style={{ height: `${safe.y0}%` }}>
                        <span>{t('Navigation bar')}</span>
                    </div>
                    <div className="beZone is-bottom" style={{ height: `${100 - safe.y1}%` }}>
                        <span>{t('Slide bar')}</span>
                    </div>
                    <div className="beSafe" style={{ left: `${safe.x0}%`, right: `${100 - safe.x1}%`, top: `${safe.y0}%`, bottom: `${100 - safe.y1}%` }} />
                </>
            )}
            <i className={`beGuide is-v${guides.x !== null ? ' isOn' : ''}`} style={{ left: `${guides.x ?? 50}%` }} aria-hidden="true" />
            <i className={`beGuide is-h${guides.y !== null ? ' isOn' : ''}`} style={{ top: `${guides.y ?? 50}%` }} aria-hidden="true" />
        </>
    );

    const phone = device === 'phone';
    return (
        <div className="bePreviewWrap" ref={wrap}>
            <div className={`bePreviewFrame${phone ? ' isPhone' : ''}`} style={{ width: screen.width * scale + (phone ? 12 : 0), height: screen.height * scale + (phone ? 12 : 0) }}>
                <div className="beViewport" ref={viewport} style={{ width: screen.width, height: screen.height, transform: `scale(${scale})`, '--pv-scale': scale }}>
                    <div className={`beHero${phone ? ' isPhone' : ''}`}>
                        <BannerPoster
                            banner={{ buttons: draft.buttons }}
                            device={device}
                            posters={{ desktop: draft.desktop?.url ?? null, phone: draft.phone?.url ?? null }}
                            lang={lang}
                            renderButton={renderButton}
                            overlay={overlay}
                        />
                        {!draft[device]?.url && (
                            <div className="beNoPoster">
                                <strong>{phone ? '1080 × 1920' : '1920 × 1080'}</strong>
                                <span>{t(phone ? 'Add the phone poster to see it here' : 'Add the desktop poster to see it here')}</span>
                            </div>
                        )}
                        <NavReplica phone={phone} t={t} />
                        <SlideBarReplica phone={phone} label={slideLabel} t={t} />
                    </div>
                </div>
            </div>
            <p className="bePreviewNote">
                {t('{screen} · shown at {percent}% · button spots and sizes for the {device} poster', {
                    screen: `${t(screen.label)} ${screen.size}`,
                    percent: Math.round(scale * 100),
                    device: t(phone ? 'phone' : 'desktop'),
                })}
            </p>
        </div>
    );
});

// The homepage's transparent navbar, as it sits over the hero (not clickable here).
const NavReplica = ({ phone, t }) => (
    <div className="beNav" aria-hidden="true">
        <span className="beBrand">
            <img src={logoMark} alt="" />
            <span>
                <b>Oops!</b>
                <small>DANCE STUDIO</small>
            </span>
        </span>
        {phone ? (
            <span className="beBurger" />
        ) : (
            <>
                <span className="beLinks">
                    <span>{t('Home')}</span>
                    <span>{t('Classes')}</span>
                    <span>{t('Rooms')}</span>
                    <span>{t('About us')}</span>
                </span>
                <span className="beNavEnd">
                    <span className="bePill">EN · VI</span>
                    <span className="bePill">{t('Contact')}</span>
                    <span className="bePill isRed">{t('Sign In')}</span>
                </span>
            </>
        )}
    </div>
);

// The carousel's slide bar: the studio's slide, this banner (running), pause and arrows.
const SlideBarReplica = ({ phone, label, t }) => (
    <div className="beBar" aria-hidden="true">
        <span className="beSegs">
            <span className="beSeg isDone">{!phone && <small>{t('Studio')}</small>}</span>
            <span className="beSeg isNow">{!phone && <small>{label}</small>}</span>
        </span>
        <span className="beRound">❚❚</span>
        {!phone && (
            <>
                <span className="beRound">‹</span>
                <span className="beRound">›</span>
            </>
        )}
    </div>
);

export default BannerPreview;
