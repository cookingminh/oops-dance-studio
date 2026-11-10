import { useLayoutEffect } from 'react';
import clip from '@/assets/video/register.mp4';
import poster from '@/assets/images/studio.webp';

// One <video> shared by the login, sign-up and reset-password pages. Each page renders its own
// layout, so a plain <video> would jump back to the first frame on every switch between them;
// moving this one element instead keeps the clip running where it was.
let video = null;

// A still poster for people who ask for less motion or less data.
const wantsStill = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true;

function sharedVideo() {
    if (!video) {
        video = document.createElement('video');
        video.preload = wantsStill() ? 'none' : 'auto';
        video.poster = poster;
        video.src = clip;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        // The attributes too: iOS only autoplays inline video marked muted + playsinline.
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-hidden', 'true');
    }
    return video;
}

// Puts the shared video into `hostRef` while the page is shown.
export function useStageVideo(hostRef) {
    useLayoutEffect(() => {
        const host = hostRef.current;
        const element = sharedVideo();
        host.append(element);
        if (!wantsStill()) element.play().catch(() => {}); // autoplay refused: the poster stays
        // The next page may have taken the video already (React can mount it before this cleanup).
        return () => {
            if (element.parentNode === host) element.remove();
        };
    }, [hostRef]);
}
