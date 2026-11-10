import { useEffect, useRef } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

// A muted, decorative loop of one part of a video (`from`–`to` seconds). It only plays while on
// screen, and not at all for people who ask for reduced motion (they see the poster frame).
const LoopClip = ({ clip, className = '' }) => {
    const ref = useRef(null);
    const inView = useInView(ref, { margin: '120px 0px' });
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        const video = ref.current;
        if (!video) return;
        if (inView && !reduceMotion) {
            video.muted = true;
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    }, [inView, reduceMotion]);

    const keepInClip = (event) => {
        const video = event.currentTarget;
        if (video.currentTime < clip.from || video.currentTime > clip.to) video.currentTime = clip.from;
    };

    return (
        <video
            ref={ref}
            className={className}
            // #t= starts the download and the first frame at the loop, not at the black intro.
            src={`${clip.src}#t=${clip.from}`}
            poster={clip.poster}
            muted
            loop
            playsInline
            preload="none"
            onTimeUpdate={keepInClip}
            aria-hidden="true"
            tabIndex={-1}
        />
    );
};

export default LoopClip;
