// The newest videos on a YouTube channel, from YouTube's public feed (no API key, no quota).
//
// YouTube's feed sends no CORS headers, so the browser can't read it from youtube.com. It asks this
// site at /youtube-feed/<playlist> instead, which passes the request on to YouTube: vite.config.js
// (server.proxy) in development, vercel.json (rewrites) once deployed. On a host without that
// pass-through the address answers with the app's own page, which is read as "no videos".
//
// The playlist "UULF" + the channel id without its "UC" holds the channel's uploads without Shorts.
// The feed lists the newest 15.

const YT_NS = 'http://www.youtube.com/xml/schemas/2015';
const CHANNEL_ID = /^UC[\w-]{22}$/;
const VIDEO_ID = /^[\w-]{11}$/;

export const longUploadsPlaylist = (channelId) => `UULF${channelId.slice(2)}`;

// [{ youtubeId, title, published }] newest first; [] when the channel id is missing or the feed can't be read.
export async function listChannelVideos(channelId) {
    if (!CHANNEL_ID.test(channelId ?? '')) return [];
    const response = await fetch(`/youtube-feed/${longUploadsPlaylist(channelId)}`);
    if (!response.ok) throw new Error(`The YouTube feed answered ${response.status}.`);

    const doc = new DOMParser().parseFromString(await response.text(), 'application/xml');
    if (doc.documentElement?.localName !== 'feed') return [];

    return [...doc.getElementsByTagName('entry')]
        .map((entry) => ({
            youtubeId: entry.getElementsByTagNameNS(YT_NS, 'videoId')[0]?.textContent?.trim() ?? '',
            title: entry.getElementsByTagName('title')[0]?.textContent?.trim() ?? '',
            published: entry.getElementsByTagName('published')[0]?.textContent?.trim() ?? null,
            link: entry.getElementsByTagName('link')[0]?.getAttribute('href') ?? '',
        }))
        .filter((video) => VIDEO_ID.test(video.youtubeId) && !video.link.includes('/shorts/'))
        .map(({ youtubeId, title, published }) => ({ youtubeId, title, published }));
}
