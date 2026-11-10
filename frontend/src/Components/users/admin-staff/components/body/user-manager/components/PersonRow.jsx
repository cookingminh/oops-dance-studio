import { motion } from 'framer-motion';
import { Avatar } from '@nextui-org/react';
import { LuChevronRight, LuMail, LuPhone } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { rowIn } from '../peopleModel';
import RoleChip from './RoleChip';

// One person in the list. The whole row opens their panel.
const PersonRow = ({ person, isSelf, isOpen, contextLine, joinedLabel, onOpen }) => {
    const { t } = useI18n();
    return (
        <motion.li variants={rowIn}>
            <button type="button" className={`personRow${isOpen ? ' isOpen' : ''}`} onClick={() => onOpen(person.id)}>
                <Avatar {...AVATAR_DEFAULTS} className="personAvatar" src={avatarUrl(person.avatar_path, person.updated_at) ?? undefined} name={person.name} />
                <span className="personWho">
                    <strong>
                        <span className="personName">{person.name}</span>
                        {isSelf && <span className="youTag">{t('You')}</span>}
                    </strong>
                    {person.missing.includes('name') ? (
                        <small className="isMissing">{t('No full name')}</small>
                    ) : (
                        <small>{person.username ? `@${person.username}` : t('No username')}</small>
                    )}
                </span>
                <span className="personContact">
                    <span>
                        <LuMail aria-hidden="true" />
                        <span className="truncate">{person.email}</span>
                    </span>
                    <span className={person.contact_number ? undefined : 'isMissing'}>
                        <LuPhone aria-hidden="true" />
                        <span className="truncate">{person.contact_number || t('No phone number')}</span>
                    </span>
                </span>
                <span className="personRole">
                    <RoleChip kind={person.kind} />
                    <small>{contextLine}</small>
                </span>
                <span className="personJoined">
                    <small>{t('Member since')}</small>
                    <strong>{joinedLabel}</strong>
                </span>
                <LuChevronRight className="personGo" aria-hidden="true" />
            </button>
        </motion.li>
    );
};

export default PersonRow;
