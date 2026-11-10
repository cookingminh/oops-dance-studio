import { useState } from 'react';
import { youtubeThumb } from '@/lib/youtube';

// A YouTube video's thumbnail. The 1280 px one doesn't exist for every video (YouTube then
// sends a 120 px grey placeholder), so a tiny result falls back to the 480 px thumbnail.
const VideoThumb = ({ id, size = 'hq', alt = '', className }) => {
    const [fallback, setFallback] = useState(false);
    const src = youtubeThumb(id, fallback ? 'hq' : size);
    return (
        <img
            key={src}
            src={src}
            alt={alt}
            className={className}
            loading="lazy"
            decoding="async"
            onLoad={(event) => size === 'max' && !fallback && event.currentTarget.naturalWidth <= 120 && setFallback(true)}
        />
    );
};

export default VideoThumb;
