// PLACEHOLDER COPY for the About us page (/about).
// The story, quote, timeline, achievements and numbers below were written as an example so the
// page could be designed. They are NOT real facts: the owner should replace them with Oops! Crew's
// real history before launch. (Real so far: founded in Hanoi in 2017, Oops! Dance Studio at 25
// Trung Phụng, every instructor is a crew member, the styles taught, the end-of-month class video,
// the free first class, the slogan and the social links.) Photos are illustrative, not of the
// events they sit next to.
//
// Every string is English source text and doubles as its i18n key: when you change one, update its
// Vietnamese in src/i18n/vi/about.js too. The crew section is not here: it lists the real
// instructors from the public class list.

import studio from '@/assets/images/studio.webp';
import roomBright from '@/assets/images/room1-1.webp';
import roomWide from '@/assets/images/room1-2.webp';
import roomLogoWall from '@/assets/images/room1-3.webp';
import roomDark from '@/assets/images/room2-1.webp';
import roomRed from '@/assets/images/room2-3.webp';
import roomLong from '@/assets/images/room2-4.webp';
import heroVideo from '@/assets/video/hero.mp4';
import crewStage from './media/crew-stage.webp';
import classJerseys from './media/class-jerseys.webp';
import crewGrey from './media/crew-grey.webp';
import classUniforms from './media/class-uniforms.webp';
import crewRed from './media/crew-red.webp';
import posterDance from './media/poster-dance.webp';
import posterCorridor from './media/poster-corridor.webp';

export const FOUNDED = 2017;
const YEARS_TOGETHER = Math.max(1, new Date().getFullYear() - FOUNDED);

// Muted loops cut from the home page video (seconds): the class dancing, and the warm-up
// in the corridor. The posters are the first frame of each loop.
export const CLIPS = {
    dance: { src: heroVideo, poster: posterDance, from: 18, to: 29.4 },
    corridor: { src: heroVideo, poster: posterCorridor, from: 10.2, to: 16.4 },
};

export const HERO = {
    kicker: 'We are',
    lede: 'A Hanoi dance crew since 2017. We started out filming K-pop covers with friends after class; today we run Oops! Dance Studio and teach the routines we love to perform.',
    tags: ['Hà Nội', 'Since 2017', 'K-pop cover · hip-hop · breaking'],
    stamp: 'Oops! Crew · Since 2017 · Hà Nội ·',
    photo: { src: crewGrey, alt: 'Dancers posing together after a class shoot' },
};

// `value` counts up when it scrolls into view; `suffix` is added after it.
export const STATS = [
    { value: YEARS_TOGETHER, suffix: '', label: 'Years dancing together' },
    { value: 1500, suffix: '+', label: 'Students taught' },
    { value: 300, suffix: '+', label: 'Class videos filmed' },
    { value: 60, suffix: '+', label: 'Live performances' },
];

export const STORY = {
    title: 'It started with a borrowed room and one speaker',
    paragraphs: [
        'Oops! Crew began in 2017 as a handful of university friends who couldn’t stop dancing. We rehearsed in whatever room we could borrow, filmed K-pop covers at weekends and posted them mostly for each other.',
        'The name? It’s what we said most at those first rehearsals. We kept it as a reminder that missed steps are part of dancing, and that nobody gets a routine right the first time.',
        'People kept asking where they could learn our routines, so we started teaching: in rented rooms around Hanoi, online when the city went quiet, and from 2021 in a place of our own, Oops! Dance Studio at 25 Trung Phụng.',
        'We still perform as a crew, and every instructor at the studio is a crew member. At the end of every course each class films its routine together, just like we filmed our very first cover.',
    ],
    quote: 'We never set out to open a school. We just wanted more people to dance with.',
    quoteBy: 'The founding members',
    photo: { src: crewStage, alt: 'A full class in white outfits on the studio floor', caption: 'Shoot day at Oops! Dance Studio.' },
    // "At a glance" fact file next to the story.
    facts: [
        { label: 'Founded', value: '2017, Hà Nội' },
        { label: 'Studio', value: 'Floor 7, 25 Trung Phụng, Đống Đa' },
        { label: 'Styles', value: 'K-pop cover, hip-hop, breaking, contemporary, choreography' },
        { label: 'Every course', value: 'A new routine and a class video' },
        { label: 'First class', value: 'Free of charge' },
    ],
};

export const TIMELINE = [
    {
        year: 2017,
        tag: 'Founded',
        title: 'Six friends, one speaker',
        text: 'A group of university friends forms Oops! Crew and films its first K-pop cover in a borrowed rehearsal room.',
        image: posterCorridor,
        alt: 'Friends fooling around in the studio corridor',
    },
    {
        year: 2018,
        tag: 'Stage',
        title: 'First time on stage',
        text: 'Our first shows at school festivals and community events around Hanoi. By the end of the year the crew has grown to twelve dancers.',
        image: crewStage,
        alt: 'Dancers in white outfits in formation',
    },
    {
        year: 2019,
        tag: 'Award',
        title: 'A first trophy',
        text: 'First place in the crew category of a city-wide K-pop cover contest, and our first weekend workshops for people who wanted to learn the routines.',
        image: crewRed,
        alt: 'Dancers in black and red outfits posing under red lights',
    },
    {
        year: 2020,
        tag: 'Online',
        title: 'Dancing apart, together',
        text: 'With studios closed, classes move online. Weekly livestream sessions keep everyone dancing in their living rooms.',
        image: roomDark,
        alt: 'An empty studio room with the lights on',
    },
    {
        year: 2021,
        tag: 'Studio',
        title: 'A home of our own',
        text: 'Oops! Dance Studio opens at 25 Trung Phụng with one mirrored room and our first regular weekly classes.',
        image: roomLogoWall,
        alt: 'A bright studio room with the Oops! Crew logo wall',
    },
    {
        year: 2022,
        tag: 'Tradition',
        title: 'Shoot day is born',
        text: 'Every class starts filming its routine together at the end of each course. It quickly becomes everyone’s favourite day.',
        image: classJerseys,
        alt: 'A class in matching jerseys posing after their shoot',
    },
    {
        year: 2023,
        tag: 'Growth',
        title: 'More room to move',
        text: 'A second studio room opens, along with hip-hop, breaking and a class just for kids.',
        image: roomLong,
        alt: 'A long studio room with floor-to-ceiling windows',
    },
    {
        year: 2024,
        tag: 'Community',
        title: 'Our first showcase',
        text: 'More than a hundred students share one stage at the first Oops! student showcase.',
        image: classUniforms,
        alt: 'Students in school-style outfits in front of the logo wall',
    },
    {
        year: 2025,
        tag: 'Studio',
        title: 'Book it online',
        text: 'Students can now book practice rooms and keep up with their classes online, any time of day.',
        image: roomBright,
        alt: 'A daylight studio room ready for practice',
    },
    {
        year: 2026,
        tag: 'Today',
        title: 'Where we are today',
        text: 'A new song every course, a weekly timetable full of classes, and the same crew teaching the routines they perform.',
        image: crewGrey,
        alt: 'Dancers in grey and white outfits posing with arms crossed',
    },
];

// In date order. `kind` picks the icon: competition, stage or community. `ongoing` reads "2018–now".
export const ACHIEVEMENTS = [
    {
        year: 2018,
        ongoing: true,
        kind: 'stage',
        title: '60+ live performances',
        text: 'School festivals, university events, weddings and shop openings all over Hanoi.',
    },
    {
        year: 2019,
        kind: 'competition',
        title: 'Champions, crew category',
        text: 'A city-wide K-pop cover contest in Hanoi, up against more than twenty crews.',
    },
    {
        year: 2020,
        kind: 'competition',
        title: 'Top 3, online cover challenge',
        text: 'A nationwide online dance cover challenge, filmed in our living rooms during lockdown.',
    },
    {
        year: 2023,
        kind: 'competition',
        title: 'Finalists, street-dance battle',
        text: 'Two of our breakers made the final of a regional two-on-two battle.',
    },
    {
        year: 2023,
        ongoing: true,
        kind: 'community',
        title: 'Free summer workshops',
        text: 'Every summer we open the studio for free workshops for kids and teens from the neighbourhood.',
    },
    {
        year: 2024,
        kind: 'community',
        title: 'First student showcase',
        text: '120 students, 14 routines and one very loud audience.',
    },
];

export const SLOGAN = {
    first: 'Let every step set you free.',
    second: 'Dance to express, not to impress.',
};

export const VALUES = [
    {
        title: 'Express, don’t impress',
        text: 'Dance is a way of saying something. How you feel on the floor matters more to us than how perfect it looks.',
    },
    {
        title: 'Oops is part of it',
        text: 'Missed a step? So did we. It’s in our name. Laugh it off and go again.',
    },
    {
        title: 'Everyone starts at step one',
        text: 'Every move is broken down and every question is welcome. Beginners are the reason we teach.',
    },
    {
        title: 'Crew over ego',
        text: 'We learn together, cheer each other on and end every course as one group, on camera.',
    },
];

// Bento gallery. `size`: big (2×2), tall (1×2) or small (1×1); `clip` plays a muted loop instead.
export const GALLERY = [
    { clip: 'corridor', size: 'big', caption: 'Warming up before class' },
    { image: studio, size: 'tall', alt: 'The Oops! Crew logo wall', caption: 'The wall everyone poses in front of' },
    { image: roomWide, size: 'small', alt: 'A wide studio room with mirrors', caption: 'Mirrors on every wall' },
    { image: roomRed, size: 'small', alt: 'A studio room lit in red', caption: 'Lights down for shoot day' },
];

export const ADDRESS = 'Floor 7, 25 Trung Phụng, Đống Đa, Hà Nội';
export const MAP_URL = 'https://www.google.com/maps/search/?api=1&query=25+Trung+Ph%E1%BB%A5ng%2C+%C4%90%E1%BB%91ng+%C4%90a%2C+H%C3%A0+N%E1%BB%99i';

// `network` picks the icon.
export const SOCIALS = [
    { network: 'facebook', name: 'Facebook', handle: 'oopsdancestudio', url: 'https://www.facebook.com/oopsdancestudio' },
    { network: 'tiktok', name: 'TikTok', handle: '@oopsdancestudio', url: 'https://www.tiktok.com/@oopsdancestudio' },
    { network: 'instagram', name: 'Instagram', handle: '@oopscrew.official', url: 'https://www.instagram.com/oopscrew.official' },
    { network: 'youtube', name: 'YouTube', handle: 'Oops! Crew', url: 'https://www.youtube.com/channel/UC7erFR2T4VW_rQnUOz2Tk_A' },
];
