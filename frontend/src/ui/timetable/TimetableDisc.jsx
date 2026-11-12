import { useId } from 'react';
import { levelOf } from '@/lib/classLevel';
import { PHOTO_FRAME, circleOf } from './timetableFrame';
import './timetableDisc.scss';

// One class on the poster timetable, as on the studio's printed schedule: a brush-painted circle in the
// level's colour, the photo cut to a slightly smaller circle inside it (a ring of colour shows around it),
// and the class name curving along the top. A class without a level gets a grey circle.
// `photo` = { src, alt, frame }: frame { x, y, zoom } places the photo — the point (x %, y %) of the photo
// sits in the middle of the circle, and the photo is zoom % of the circle wide (100 = just as wide).

// Font size (viewBox units) that keeps the name on the arc: about 98 units of it read comfortably.
const arcFontSize = (name) => Math.max(6.5, Math.min(13, 98 / Math.max(name.length * 0.68, 1)));

const TimetableDisc = ({ name, level, photo, className = '' }) => {
    const pathId = `ttArc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    const { value } = levelOf(level);
    const frame = { ...PHOTO_FRAME, ...photo?.frame };
    return (
        <span className={`ttDisc is-${value ?? 'none'} ${className}`} style={{ '--circle': `url(${circleOf(value)})` }} aria-hidden="true">
            <span className="ttPhoto">
                {photo?.src && (
                    <img
                        className="instructor"
                        src={photo.src}
                        alt={photo.alt ?? ''}
                        loading="lazy"
                        draggable={false}
                        style={{ '--px': frame.x, '--py': frame.y, '--pz': frame.zoom / 100 }}
                    />
                )}
            </span>
            <svg className="ttArc" viewBox="0 0 100 100" focusable="false">
                <path id={pathId} d="M 18.1 58.5 A 33 33 0 1 1 81.9 58.5" fill="none" />
                <text style={{ fontSize: arcFontSize(name) }}>
                    <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                        {name}
                    </textPath>
                </text>
            </svg>
        </span>
    );
};

export default TimetableDisc;
