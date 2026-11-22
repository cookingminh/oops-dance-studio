import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { sections, story, storyPhotos } from '@/content/about';
import { reveal, useLocalize } from './aboutHelpers';
import RichText from './RichText';

// The story as a few short paragraphs (the first one bigger), with two crew photos beside it that
// drift at different speeds as the page scrolls.
const AboutStory = () => {
    const L = useLocalize();
    const reduce = useReducedMotion();
    const photosRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: photosRef, offset: ['start end', 'end start'] });
    const drift = [useTransform(scrollYProgress, [0, 1], [24, -24]), useTransform(scrollYProgress, [0, 1], [70, -50])];

    return (
        <section className="abSection abStory" aria-labelledby="story-title">
            <div className="abWrap abStoryGrid">
                <div className="abStoryText">
                    <motion.h2 id="story-title" className="abTitle" {...reveal(reduce)}>
                        {L(sections.story.title)}
                    </motion.h2>
                    {story.map((paragraph, index) => (
                        <motion.p key={paragraph.id} className={index === 0 ? 'isLead' : undefined} {...reveal(reduce, { y: 18, delay: 0.05 })}>
                            <RichText text={L(paragraph.text)} />
                        </motion.p>
                    ))}
                </div>

                <div className="abStoryPhotos" ref={photosRef}>
                    {storyPhotos.slice(0, 2).map((photo, index) => (
                        <motion.figure key={photo.id} className={`abStoryPhoto is-${index}`} style={reduce ? undefined : { y: drift[index] }}>
                            <motion.img
                                src={photo.image}
                                alt={L(photo.alt)}
                                width="1400"
                                height="934"
                                loading="lazy"
                                decoding="async"
                                {...reveal(reduce, { y: 0, delay: index * 0.15, duration: 0.8 })}
                            />
                        </motion.figure>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default AboutStory;
