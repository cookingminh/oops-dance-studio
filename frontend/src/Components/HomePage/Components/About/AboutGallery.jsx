import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import { CLIPS, GALLERY } from './aboutContent';
import { revealGroup, revealItem } from './aboutHelpers';
import ChapterHead from './ChapterHead';
import LoopClip from './LoopClip';

// 06 · Inside the studio: a small bento of photos and one muted loop, each with a caption.
const AboutGallery = () => {
    const { t } = useI18n();
    return (
        <section className="abSection abGallery" aria-labelledby="gallery-title">
            <div className="abWrap">
                <ChapterHead
                    id="gallery-title"
                    number="06"
                    eyebrow={t('Inside the studio')}
                    title={t('Where every routine comes together')}
                    intro={t('Floor 7, 25 Trung Phụng: classes, rehearsals and every shoot day happen here.')}
                />

                <motion.ul className="abBento" {...revealGroup}>
                    {GALLERY.map((tile) => (
                        <motion.li key={tile.caption} className={`abTile is-${tile.size}`} {...revealItem}>
                            <figure>
                                {tile.clip ? (
                                    <LoopClip clip={CLIPS[tile.clip]} className="abTileMedia" />
                                ) : (
                                    <img className="abTileMedia" src={tile.image} alt={t(tile.alt)} loading="lazy" />
                                )}
                                <figcaption>{t(tile.caption)}</figcaption>
                            </figure>
                        </motion.li>
                    ))}
                </motion.ul>
            </div>
        </section>
    );
};

export default AboutGallery;
