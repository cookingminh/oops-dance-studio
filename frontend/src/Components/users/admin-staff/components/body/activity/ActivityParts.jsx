import { Fragment } from 'react';
import { Avatar } from '@nextui-org/react';
import { LuCpu, LuLandmark } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import RoleChip from '../user-manager/components/RoleChip';
import { areaOf } from './activityModel';

// People, classes and titles are bold in a sentence; counts, dates and summaries are not.
const BOLD = new Set(['actor', 'name', 'class', 'title']);

// A translated sentence with its {placeholders} filled in, the names in bold.
export const Sentence = ({ template, vars }) => {
    const { t } = useI18n();
    const parts = t(template).split(/\{(\w+)\}/);
    return parts.map((part, index) => {
        if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
        const value = vars[part] ?? '';
        return BOLD.has(part) ? <strong key={index}>{value}</strong> : <Fragment key={index}>{value}</Fragment>;
    });
};

// The area's icon on its colour, with the area's name for screen readers and on hover.
export const AreaIcon = ({ area, className = 'alogAreaIcon' }) => {
    const { t } = useI18n();
    const meta = areaOf(area);
    const Icon = meta.icon;
    return (
        <span className={className} data-area={area} title={t(meta.label)}>
            <Icon aria-hidden="true" />
            <span className="sr-only">{t(meta.label)}</span>
        </span>
    );
};

// Bank payments come from the bank; other automatic entries from the studio's daily jobs.
const systemIcon = (row) => (row.area === 'tuition' ? LuLandmark : LuCpu);
// A sign-up or a student leaving after their course is about that person: show them.
const showsSubject = (row) => !row.actor_id && row.subject_id && ['account_created', 'removed'].includes(row.action);

// Who did it (their photo, or the system's icon) with the area badge in the corner.
export const ActorAvatar = ({ row, people, small = false }) => {
    const person = people?.get(row.actor_id ?? (showsSubject(row) ? row.subject_id : null));
    const SystemIcon = systemIcon(row);
    return (
        <span className={`alogWho${small ? ' isSmall' : ''}`}>
            {person || row.actor_id ? (
                <Avatar
                    {...AVATAR_DEFAULTS}
                    size="sm"
                    className="alogAvatar"
                    src={avatarUrl(person?.avatar_path, person?.updated_at) ?? undefined}
                    name={person?.name ?? row.actor_name ?? ''}
                />
            ) : (
                <span className="alogSystem" aria-hidden="true">
                    <SystemIcon />
                </span>
            )}
            <AreaIcon area={row.area} className="alogAreaBadge" />
        </span>
    );
};

// The actor's role then (a guest enrolled in a class reads as Student), or "System".
export const WhoTag = ({ row, people }) => {
    const { t } = useI18n();
    if (!row.actor_id) {
        const Icon = systemIcon(row);
        return (
            <span className="roleChip alogSystemChip" data-tone="slate">
                <Icon aria-hidden="true" />
                {row.area === 'tuition' ? t('Bank') : t('System')}
            </span>
        );
    }
    const kind = row.actor_role === 'guest' && people?.get(row.actor_id)?.kind === 'student' ? 'student' : row.actor_role ?? people?.get(row.actor_id)?.kind;
    return kind ? <RoleChip kind={kind} /> : null;
};

// The short facts after a sentence: "Phòng A · Mon 9 Nov · 16:00–17:30".
export const Facts = ({ facts }) =>
    facts.length ? (
        <span className="alogFacts">
            {facts.map((fact, index) => (
                <span key={index}>{fact}</span>
            ))}
        </span>
    ) : null;
