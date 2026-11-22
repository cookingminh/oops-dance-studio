import { Fragment } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { hero, stats } from '@/content/about';
import { EASE_OUT, useLocalize } from './aboutHelpers';
import StatCounter from './StatCounter';

// Entrance on page load (the hero is always in view): the pill, the name letter by letter, the
// tagline, the numbers, then the photo rises like a curtain.
const sequence = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.15 } } };
const letter = {
    hidden: { opacity: 0, y: '0.35em', rotate: 4 },
    show: { opacity: 1, y: 0, rotate: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};
const enter = (reduce, delay) =>
    reduce
        ? {}
        : {
              initial: { opacity: 0, y: 18 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.6, delay, ease: EASE_OUT },
          };

// /about hero: the name and tagline with the numbers beside them, over a full-width band of the
// crew photo (black on white, like the crew's own shoot). The numbers count up.
const AboutHero = () => {
    const L = useLocalize();
    const reduce = useReducedMotion();

    const words = hero.title.split(' ');
    const letterDelay = 0.15 + hero.title.length * 0.035;

    return (
        <section className="abHero" aria-labelledby="about-title">
            <div className="abHeroTop">
                <div className="abHeroText">
                    <motion.p className="abHeroEyebrow" {...enter(reduce, 0)}>
                        {L(hero.subtitle)}
                    </motion.p>

                    <motion.h1
                        id="about-title"
                        className="abHeroTitle"
                        {...(reduce ? {} : { initial: 'hidden', animate: 'show', variants: sequence })}
                    >
                        <span className="sr-only">{hero.title}</span>
                        {words.map((word, w) => (
                            <Fragment key={`${word}-${w}`}>
                                {w > 0 && ' '}
                                <span className={`abHeroWord${w === 0 ? ' isBrand' : ''}`} aria-hidden="true">
                                    {[...word].map((char, c) => (
                                        <motion.span key={`${char}-${c}`} className="abHeroChar" variants={letter}>
                                            {char}
                                        </motion.span>
                                    ))}
                                </span>
                            </Fragment>
                        ))}
                    </motion.h1>

                    <motion.p className="abHeroTagline" {...enter(reduce, letterDelay)}>
                        {L(hero.tagline)}
                    </motion.p>
                </div>

                <motion.dl className="abStats" {...enter(reduce, letterDelay + 0.1)}>
                    {stats.map((stat) => (
                        <div key={stat.id} className="abStat">
                            <dt>{L(stat.label)}</dt>
                            <dd>
                                <StatCounter value={stat.value} suffix={stat.suffix} kind={stat.kind} delay={letterDelay + 0.3} />
                            </dd>
                        </div>
                    ))}
                </motion.dl>
            </div>

            <motion.div
                className="abHeroPhoto"
                {...(reduce
                    ? {}
                    : {
                          initial: { clipPath: 'inset(100% 0% 0% 0%)' },
                          animate: { clipPath: 'inset(0% 0% 0% 0%)' },
                          transition: { duration: 1.1, delay: 0.25, ease: EASE_OUT },
                      })}
            >
                <img src={hero.image} alt={L(hero.imageAlt)} width="2880" height="1096" decoding="async" />
            </motion.div>
        </section>
    );
};

export default AboutHero;
