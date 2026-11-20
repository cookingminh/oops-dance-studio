import { Link } from 'react-router-dom';
import { LuArrowRight } from 'react-icons/lu';
import { BANNER_DEVICES, bannerTarget, buttonText, posterUrl } from '@/services/banners';
import './bannerPoster.scss';

// One homepage banner as visitors see it: the whole poster (never cropped), centred over a blurred copy of itself,
// with its buttons on top at their spot (x %, y % of the poster, so they stay on the same spot of the design on any
// screen) and their size (scale × the standard button, which grows with the poster).
// Fills its positioned parent. Used by the homepage carousel and by the editor's preview.
//   device       'desktop' | 'phone' shows that poster (the editor's preview, at a fixed size);
//                null shows the one that fits the screen (phone under 641 px).
//   posters      { desktop, phone } image URLs (the editor's freshly picked files); default: the banner's paths.
//   lang         'vi' | 'en' for the buttons' words.
//   renderButton (button, { device, className, style, children }) → node: the editor draws its own (draggable) buttons.
//   overlay      (device) → node drawn on each poster above the buttons (the editor's guides).
const BannerPoster = ({ banner, device = null, posters, lang = 'vi', renderButton, overlay, tabIndex }) => {
    const urls = posters ?? { desktop: posterUrl(banner.desktop_path), phone: posterUrl(banner.phone_path) };
    const devices = device ? [device] : BANNER_DEVICES;

    return (
        <div className={`bnPoster${device ? ` is-only-${device}` : ''}`}>
            {devices.map((d) => (
                <div key={`fill-${d}`} className={`bnFill is-${d}`} aria-hidden="true">
                    {urls[d] && <img src={urls[d]} alt="" draggable={false} />}
                </div>
            ))}
            {devices.map((d) => (
                <div key={d} className={`bnStage is-${d}`}>
                    {urls[d] ? <img className="bnImage" src={urls[d]} alt="" draggable={false} /> : <div className="bnMissing" />}
                    {(banner.buttons ?? []).map((button) => {
                        const spot = button[d] ?? { x: 50, y: 80, scale: 1 };
                        const className = `bnBtn c-${button.color}`;
                        const style = { left: `${spot.x}%`, top: `${spot.y}%`, '--s': spot.scale ?? 1 };
                        const children = (
                            <>
                                <span>{buttonText(button, lang)}</span>
                                {button.arrow && <LuArrowRight aria-hidden="true" />}
                            </>
                        );
                        if (renderButton) return renderButton(button, { device: d, className, style, children });
                        const { href, external } = bannerTarget(button);
                        return external ? (
                            <a key={button.id} className={className} style={style} href={href} target="_blank" rel="noopener noreferrer" tabIndex={tabIndex}>
                                {children}
                            </a>
                        ) : (
                            <Link key={button.id} className={className} style={style} to={href} tabIndex={tabIndex}>
                                {children}
                            </Link>
                        );
                    })}
                    {overlay?.(d)}
                </div>
            ))}
        </div>
    );
};

export default BannerPoster;
