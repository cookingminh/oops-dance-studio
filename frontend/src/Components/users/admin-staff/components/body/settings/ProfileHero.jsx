import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuCalendarHeart, LuMail } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { fadeUp } from '../../common/motion';
import AvatarEditor from './AvatarEditor';
import ProfileProgress from './ProfileProgress';
import { useFlash } from './settingsHooks';

const reveal = {
    initial: { opacity: 0, y: -6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.2 },
};

// Who you are at the studio: photo (click to change), name, role, email and since when, with the
// profile checklist on the side. Name and username follow the form as you type.
const ProfileHero = ({ user, roleLabel, displayName, username, avatar, photoInputRef, onFix }) => {
    const { t, formatDate } = useI18n();
    const [photoError, setPhotoError] = useState('');
    // The toast confirms the upload; the photo itself gets a short ring pulse.
    const [photoSaved, flashPhotoSaved] = useFlash(1800);

    const savePhoto = async () => {
        if (await avatar.save()) flashPhotoSaved();
    };

    return (
        <motion.section variants={fadeUp} className="adminCard profileHero" aria-labelledby="settings-hero-name">
            <div className="heroCover" aria-hidden="true">
                <span className="heroOrb isLarge" />
                <span className="heroOrb isSmall" />
            </div>

            <div className="heroBody">
                <AvatarEditor
                    name={displayName}
                    src={user.avatar_url}
                    avatar={avatar}
                    inputRef={photoInputRef}
                    celebrate={photoSaved}
                    onError={setPhotoError}
                />

                <div className="heroIdentity">
                    <h2 id="settings-hero-name">{displayName}</h2>
                    <div className="heroTags">
                        <span className={`roleBadge is-${roleLabel.toLowerCase()}`}>{t(roleLabel)}</span>
                        {username && <span className="heroHandle">@{username}</span>}
                    </div>
                    <ul className="heroMeta">
                        <li>
                            <LuMail aria-hidden="true" />
                            <span className="heroEmail">{user.email}</span>
                        </li>
                        {user.created_at && (
                            <li>
                                <LuCalendarHeart aria-hidden="true" />
                                <span>
                                    {t('Member since')} {formatDate(user.created_at, 'monthYear')}
                                </span>
                            </li>
                        )}
                    </ul>

                    <AnimatePresence initial={false}>
                        {avatar.file && (
                            <motion.div key="pending" className="photoPending" {...reveal}>
                                <span>{t('Looking good! Save it as your new photo?')}</span>
                                <div className="photoPendingActions">
                                    <Button size="sm" variant="light" onPress={avatar.clear} isDisabled={avatar.saving}>
                                        {t('Cancel')}
                                    </Button>
                                    <Button size="sm" color="danger" onPress={savePhoto} isLoading={avatar.saving}>
                                        {t('Save photo')}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                        {photoError && !avatar.file && (
                            <motion.p key="error" className="photoError" role="alert" {...reveal}>
                                {t(photoError)}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>

                <ProfileProgress user={user} onFix={onFix} />
            </div>
        </motion.section>
    );
};

export default ProfileHero;
