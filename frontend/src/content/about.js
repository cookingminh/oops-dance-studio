// ─────────────────────────────────────────────────────────────────────────────
// ABOUT US PAGE (/about): every word, number, photo, video and link on the page lives in this file.
// ─────────────────────────────────────────────────────────────────────────────
//
// How the studio edits it:
//   • Text written as { en: '…', vi: '…' } is shown in the visitor's language (EN | VI switch in the
//     navbar). Change BOTH sides. A plain '…' string (a name, a song, a YouTube title) shows the same
//     in both languages.
//   • The order of each list is the order on the page. Add, remove or move whole { … } blocks.
//   • Keep every `id` unique and don't rename one that is in use: highlights point at timeline ids,
//     timeline entries at era ids.
//   • Photos: put the new picture in src/assets/images/about/ (WebP, about 1600 px wide), then change
//     the import line just below. Crew portraits go in src/assets/images/about/crew/, named after the
//     member's id (do-linh.webp), about 300 × 320 px.
//   • Videos come by themselves from the crew's YouTube channel (sections.videos below). The short
//     fallbackVideos list only shows when YouTube can't be reached.
//   • Save the file: the page reloads by itself in `npm run dev`. Nothing else needs changing.
//
// Each list is shaped like a future database table (one block = one row), so this file can move to
// Supabase later without changing the page.

import heroImage from '@/assets/images/about/crew-2026-hero.webp';
import chairsImage from '@/assets/images/about/crew-2026-chairs.webp';
import standingImage from '@/assets/images/about/crew-2026-standing.webp';
import stoolsImage from '@/assets/images/about/crew-2026-stools.webp';

// Every portrait in about/crew/, by file name: crewPhoto('do-linh') → do-linh.webp.
const CREW_PHOTOS = import.meta.glob('../assets/images/about/crew/*.webp', { eager: true, import: 'default' });
const crewPhoto = (id) => CREW_PHOTOS[`../assets/images/about/crew/${id}.webp`];

// ── Hero: the first screen ──────────────────────────────────────────────────
export const hero = {
    title: 'Oops! Crew',
    subtitle: { en: 'Hà Nội · since 2014', vi: 'Hà Nội · từ 2014' },
    tagline: 'REBORN — beyond dance cover',
    image: heroImage,
    imageAlt: {
        en: 'Oops! Crew 2026 Edition: fifteen dancers dressed in black on a light grey stage',
        vi: 'Oops! Crew 2026 Edition: mười lăm thành viên mặc đồ đen trên sân khấu xám sáng',
    },
};

// ── Numbers in the hero (they count up on screen) ───────────────────────────
// `value` is the number, `suffix` is written after it (800 + 'K+' → 800K+).
// `kind: 'year'` prints the number as a year (2014, not 2,014).
export const stats = [
    { id: 'founded', value: 2014, suffix: '', kind: 'year', label: { en: 'Founded', vi: 'Năm thành lập' } }, // TODO: studio to confirm current number
    { id: 'awards', value: 20, suffix: '+', label: { en: 'Awards', vi: 'Giải thưởng' } }, // TODO: studio to confirm current number
    { id: 'youtube', value: 800, suffix: 'K+', label: 'YouTube subscribers' }, // TODO: studio to confirm current number
    { id: 'facebook', value: 100, suffix: 'K+', label: 'Facebook followers' }, // TODO: studio to confirm current number
];

// ── Story: told as a few short paragraphs ───────────────────────────────────
// The first paragraph is printed bigger. Wrap words in **double stars** to make them stand out.
export const story = [
    {
        id: 'beginning',
        text: {
            en: 'Oops! Crew started in **Hà Nội in 2014**, out of a shared love of K-pop. Over the next seven years it became one of Vietnam’s best-known dance cover crews, winning awards at home and abroad.',
            vi: 'Oops! Crew ra đời ở **Hà Nội năm 2014**, bắt đầu từ tình yêu chung với K-pop. Bảy năm sau đó, nhóm trở thành một trong những nhóm dance cover nổi bật nhất Việt Nam, mang về hàng loạt giải thưởng trong và ngoài nước.',
        },
    },
    {
        id: 'reborn',
        text: {
            en: 'In 2022, with **REBORN**, Oops! found a new direction: not only dancing covers but creating its own choreography and its own style. Beyond dance cover.',
            vi: 'Năm 2022, với **REBORN**, Oops! định hướng lại chính mình: không chỉ nhảy cover mà tự sáng tạo vũ đạo, tìm ra chất riêng — beyond dance cover.',
        },
    },
    {
        id: 'since',
        text: {
            en: 'Since then, Oops! has put out one catchy, carefully made routine after another, each with a style all its own, unmistakably **“Oops!”**. The crew reached the Top 4 of Street Woman Fighter Vietnam, and in the Low Budget Project its choreographers present routines of their own.',
            vi: 'Từ đó, Oops! liên tục cho ra mắt những vũ đạo catchy được đầu tư kỹ lưỡng, mang chất rất riêng, rất **“Oops!”**. Nhóm vào Top 4 Nữ Hoàng Vũ Đạo Đường Phố, và với Low Budget Project, các biên đạo của Oops! trình làng vũ đạo của riêng mình.',
        },
    },
    {
        id: 'today',
        text: {
            en: 'And today Oops! is also **Oops Dance Studio**, where the crew passes its love of dance on to the next generation.',
            vi: 'Và hôm nay, Oops! còn là **Oops Dance Studio**, nơi crew truyền đam mê cho thế hệ tiếp theo.',
        },
    },
];

// The two photos next to the story.
export const storyPhotos = [
    {
        id: 'chairs',
        image: chairsImage,
        alt: {
            en: 'Oops! Crew 2026 posing around director’s chairs in a white studio',
            vi: 'Oops! Crew 2026 tạo dáng quanh những chiếc ghế đạo diễn trong studio trắng',
        },
    },
    {
        id: 'standing',
        image: standingImage,
        alt: {
            en: 'Oops! Crew 2026 seen from above, standing in formation',
            vi: 'Oops! Crew 2026 nhìn từ trên cao, đứng thành đội hình',
        },
    },
];

// ── Meet our crew ───────────────────────────────────────────────────────────
// The photo is src/assets/images/about/crew/<id>.webp.
export const crew = [
    { id: 'do-linh', name: 'Đỗ Linh', photo: crewPhoto('do-linh') },
    { id: 'pit', name: 'Pit', photo: crewPhoto('pit') },
    { id: 'soleck', name: 'Soleck', photo: crewPhoto('soleck') },
    { id: 'an-trinh', name: 'An Trinh', photo: crewPhoto('an-trinh') },
    { id: 'feii', name: 'Feii', photo: crewPhoto('feii') },
    { id: 'duc-anh', name: 'Đức Anh', photo: crewPhoto('duc-anh') },
    { id: 'tram-anh', name: 'Trâm Anh', photo: crewPhoto('tram-anh') },
    { id: 'thao-be', name: 'Thảo Bé', photo: crewPhoto('thao-be') },
    { id: 'han-ji', name: 'Han Ji', photo: crewPhoto('han-ji') },
    { id: 'an-khanh-tran', name: 'An Khánh Trần', photo: crewPhoto('an-khanh-tran') },
    { id: 'vank', name: 'Vank', photo: crewPhoto('vank') },
    { id: 'suuina', name: 'Suuina', photo: crewPhoto('suuina') },
    { id: 'giangcong', name: 'Giangcong', photo: crewPhoto('giangcong') },
    { id: 'dieu-linh', name: 'Diệu Linh', photo: crewPhoto('dieu-linh') },
    { id: 'hoang-quan', name: 'Hoàng Quân', photo: crewPhoto('hoang-quan') },
];

// ── Timeline, oldest first ──────────────────────────────────────────────────
// The two chapters of the timeline; a REBORN divider is drawn before the second. `to: null` = now.
export const eras = [
    { id: 'cover', from: 2014, to: 2021, name: { en: 'Cover era', vi: 'Thời dance cover' } },
    { id: 'reborn', from: 2022, to: null, name: { en: 'Reborn era', vi: 'Thời REBORN' } },
];

// era:  which chapter above it belongs to ('cover' or 'reborn').
// type: 'award' (trophy), 'milestone' (flag) or 'project' (sparkles). Each has its own icon and colour.
// year: a number, or null for "Now".
// prize: awards only, the place won (shown big on the highlight cards).
// description: optional; leave it out if there's nothing to add.
export const timeline = [
    // Cover era
    {
        id: 'founded-2014',
        era: 'cover',
        year: 2014,
        type: 'milestone',
        title: { en: 'Oops! Crew is born in Hà Nội', vi: 'Thành lập Oops! Crew tại Hà Nội' },
        description: { en: 'It began with a shared love of K-pop.', vi: 'Bắt đầu từ tình yêu chung với K-pop.' },
    },
    {
        id: 'dance-of-spring-2016',
        era: 'cover',
        year: 2016,
        type: 'award',
        prize: { en: '1st prize', vi: 'Giải Nhất' },
        title: 'Dance of Spring',
        description: { en: 'Korean Culture Festival', vi: 'Lễ hội văn hoá Hàn Quốc' },
    },
    {
        id: 'kpop-world-festival-2017',
        era: 'cover',
        year: 2017,
        type: 'award',
        prize: { en: '1st prize', vi: 'Giải Nhất' },
        title: { en: 'K-pop World Festival, Vietnam round', vi: 'K-pop World Festival vòng Việt Nam' },
        description: {
            en: 'Represented Vietnam at the final in Changwon, Korea.',
            vi: 'Đại diện Việt Nam tại chung kết ở Changwon, Hàn Quốc.',
        },
    },
    {
        id: 'heart-shaker-2017',
        era: 'cover',
        year: 2017,
        type: 'award',
        prize: { en: 'Winner', vi: 'Quán quân' },
        title: 'Heart Shaker (TWICE) Dance Cover Contest',
        description: { en: 'Hosted by 1theK', vi: 'Do 1theK tổ chức' },
    },
    {
        id: 'cover-contests-2018',
        era: 'cover',
        year: 2018,
        type: 'award',
        prize: { en: '2nd prize', vi: 'Giải Nhì' },
        title: 'Talk To Me (Chi Pu), Killing Me (YG), BAAM (1theK)',
        description: { en: 'Three dance cover contests in one year.', vi: 'Ba cuộc thi dance cover trong một năm.' },
    },
    {
        id: 'dalla-dalla-2019',
        era: 'cover',
        year: 2019,
        type: 'award',
        prize: { en: '1st prize', vi: 'Giải Nhất' },
        title: 'Dalla Dalla Dance Cover Contest (JYP) & Kpop Starking 2019',
    },
    {
        id: 'kpop-cover-video-2020',
        era: 'cover',
        year: 2020,
        type: 'award',
        prize: { en: '1st prize', vi: 'Giải Nhất' },
        title: 'Kpop Cover Video Contest',
        description: { en: 'Korean Cultural Center in Vietnam', vi: 'Trung tâm Văn hoá Hàn Quốc' },
    },
    {
        id: 'my-universe-2021',
        era: 'cover',
        year: 2021,
        type: 'award',
        prize: { en: '1st prize', vi: 'Giải Nhất' },
        title: 'My Universe Dance Challenge (BTS × Coldplay)',
        description: 'Warner Music Vietnam',
    },

    // Reborn era
    {
        id: 'reborn-showcase-2022',
        era: 'reborn',
        year: 2022,
        type: 'milestone',
        title: 'REBORN Mini Showcase',
        description: {
            en: 'The turn to “beyond dance cover”: every routine choreographed by Oops!',
            vi: 'Bước ngoặt “beyond dance cover”, toàn bộ vũ đạo do Oops! sáng tác.',
        },
    },
    {
        id: 'hong-hong-tuyet-tuyet-2024',
        era: 'reborn',
        year: 2024,
        type: 'project',
        title: '“Hồng Hồng Tuyết Tuyết”',
        description: { en: 'Ca trù meets modern dance.', vi: 'Ca trù × nhảy hiện đại.' },
    },
    {
        id: 'street-woman-fighter-2024',
        era: 'reborn',
        year: 2024,
        type: 'award',
        prize: 'Top 4',
        title: { en: 'Street Woman Fighter Vietnam', vi: 'Nữ Hoàng Vũ Đạo Đường Phố' },
        description: { en: 'Nữ Hoàng Vũ Đạo Đường Phố, on HTV7', vi: 'Street Woman Fighter Việt Nam, HTV7' },
    },
    {
        id: 'hotsteps-2024',
        era: 'reborn',
        year: 2024,
        type: 'award',
        prize: { en: '3rd prize', vi: 'Giải Ba' },
        title: 'Hotsteps 2024',
    },
    {
        id: 'low-budget-project-2025',
        era: 'reborn',
        year: 2025,
        type: 'project',
        title: 'Low Budget Project',
        description: {
            en: 'Oops! choreographers present routines of their own.',
            vi: 'Các biên đạo của Oops! trình làng vũ đạo riêng.',
        },
    },
    {
        id: 'studio-now',
        era: 'reborn',
        year: null,
        type: 'milestone',
        title: 'Oops Dance Studio',
        description: { en: 'Passing the love of dance on to the next generation.', vi: 'Truyền đam mê cho thế hệ tiếp theo.' },
    },
];

// ── Highlights: the biggest wins, as cards ──────────────────────────────────
// Each one points at a timeline entry (its text comes from there). The first and the last cards are
// the wide ones on desktop.
export const highlights = [
    { id: 'hl-kwf', timelineId: 'kpop-world-festival-2017' },
    { id: 'hl-jyp', timelineId: 'dalla-dalla-2019' },
    { id: 'hl-1thek', timelineId: 'heart-shaker-2017' },
    { id: 'hl-warner', timelineId: 'my-universe-2021' },
    { id: 'hl-swf', timelineId: 'street-woman-fighter-2024' },
    { id: 'hl-hotsteps', timelineId: 'hotsteps-2024' },
];

// ── Videos (only when YouTube can't be reached) ─────────────────────────────
// The videos section shows the channel's newest videos by itself (sections.videos below). These are
// shown in their place only if YouTube's feed can't be read, so the section is never empty.
// title: the video's title on YouTube. note: optional line under the title.
export const fallbackVideos = [
    {
        id: 'v-hong-hong-tuyet-tuyet',
        youtubeId: 'queW26EWDLM',
        title: 'Hồng Hồng Tuyết Tuyết (ENTERA Remix) | Choreography by Oops! Crew',
        year: 2024,
    },
    {
        id: 'v-my-universe',
        youtubeId: 's-Agy3pI8g4',
        title: '[MY UNIVERSE DANCE CHALLENGE] My Universe - Coldplay X BTS | Choreography by Oops! Crew',
        year: 2021,
        note: { en: '1st prize, Warner Music', vi: 'Giải Nhất Warner Music' },
    },
    {
        id: 'v-hotsteps',
        youtubeId: 'MLmN_sgROks',
        title: 'HOTSTEPS 2024 | OOPS! CREW | VÒNG SƠ KHẢO',
        year: 2024,
    },
    {
        id: 'v-fpt-polytechnic',
        youtubeId: 'p1C01WdlqaE',
        title: '[OOPS! CREW X FPT POLYTECHNIC] HOT TIKTOK DANCE MEDLEY PART 7 | Vũ điệu học đường',
        year: 2023,
    },
    {
        id: 'v-talk-to-me',
        youtubeId: '2ivmP3YO4Fc',
        title: '[V-pop project] Talk to me (ChiPu) - Dance cover by Oops! crew',
        year: 2018,
        note: { en: '2nd prize', vi: 'Giải Nhì' },
    },
];

// ── Social links ────────────────────────────────────────────────────────────
// id picks the icon: facebook, youtube, instagram, tiktok or email.
export const socials = [
    { id: 'facebook', name: 'Facebook', handle: 'dancecrewHN', url: 'https://www.facebook.com/dancecrewHN' },
    { id: 'youtube', name: 'YouTube', handle: 'OopsCrew2014', url: 'https://www.youtube.com/c/OopsCrew2014' },
    { id: 'instagram', name: 'Instagram', handle: '@oopscrew.official', url: 'https://www.instagram.com/oopscrew.official' },
    { id: 'tiktok', name: 'TikTok', handle: '@oopscrew.official', url: 'https://www.tiktok.com/@oopscrew.official' },
    { id: 'email', name: 'Email', handle: 'oopscrew.official@gmail.com', url: 'mailto:oopscrew.official@gmail.com' },
];

// ── Section headings, labels and the closing call to action ─────────────────
export const sections = {
    story: {
        title: { en: 'From dancing covers to making our own', vi: 'Từ nhảy cover đến vũ đạo của riêng mình' },
    },
    crew: {
        title: { en: 'Meet our crew', vi: 'Gặp gỡ Oops! Crew' },
        edition: '2026 Edition',
        members: { en: 'members', vi: 'thành viên' },
    },
    timeline: {
        title: { en: 'Our journey', vi: 'Hành trình' },
        turn: 'REBORN',
        now: { en: 'Now', vi: 'Nay' },
        untilNow: { en: 'now', vi: 'nay' },
        types: {
            award: { en: 'Award', vi: 'Giải thưởng' },
            milestone: { en: 'Milestone', vi: 'Dấu mốc' },
            project: { en: 'Project', vi: 'Dự án' },
        },
    },
    highlights: {
        title: { en: 'Biggest wins', vi: 'Những giải thưởng lớn nhất' },
    },
    // The channel's newest videos, read from YouTube every time the page opens (no Shorts): the newest
    // one in the big player, the next `count` under it.
    videos: {
        title: { en: 'Watch us dance', vi: 'Xem Oops! nhảy' },
        newest: { en: 'Newest', vi: 'Mới nhất' },
        channelId: 'UCLEC2Yl4aGyo_-u7GrHiptQ', // Oops! Crew, youtube.com/@OopsCrew2014
        count: 4,
        more: { en: 'More on YouTube', vi: 'Xem thêm trên YouTube' },
        moreUrl: 'https://www.youtube.com/c/OopsCrew2014',
    },
    socials: {
        title: { en: 'Follow Oops! Crew', vi: 'Theo dõi Oops! Crew' },
    },
    cta: {
        title: { en: 'Dance with Oops!', vi: 'Học nhảy cùng Oops!' },
        text: {
            en: 'A new routine every month, taught by the crew.',
            vi: 'Mỗi tháng một bài nhảy mới, do chính các thành viên Oops! Crew dạy.',
        },
        button: { en: 'See classes', vi: 'Xem lớp học' },
        link: '/classes#timetable',
        image: stoolsImage,
    },
};
