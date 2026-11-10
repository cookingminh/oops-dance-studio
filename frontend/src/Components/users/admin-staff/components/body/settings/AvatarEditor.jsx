import { useEffect, useMemo, useState } from 'react';
import { Avatar, Spinner } from '@nextui-org/react';
import { LuCamera } from 'react-icons/lu';
import { prepareImage } from '@/lib/image';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { useI18n } from '@/i18n/i18nContext';

// Temporary URL for previewing a picked file; released when it changes or the page closes.
function useObjectUrl(file) {
    const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
    return url;
}

// The profile photo is its own button: click it (or the camera badge) to pick a picture. The pick is
// prepared like ImagePicker does (HEIC → JPEG, resized) and previewed until it is saved or cancelled.
// `inputRef` lets the page open the picker too ("Add a photo" in the profile checklist); `onError`
// gets the English message when a picture can't be used ('' when a new pick starts).
const AvatarEditor = ({ name, src, avatar, inputRef, celebrate, onError }) => {
    const { t } = useI18n();
    const [preparing, setPreparing] = useState(false);
    const preview = useObjectUrl(avatar.file);
    const busy = preparing || avatar.saving;
    const action = src ? t('Change photo') : t('Add a photo');

    const pick = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = ''; // allow picking the same file again
        if (!file) return;
        onError('');
        setPreparing(true);
        try {
            avatar.setFile(await prepareImage(file));
        } catch (prepError) {
            onError(prepError.message);
            avatar.setFile(null);
        } finally {
            setPreparing(false);
        }
    };

    return (
        <div className={`avatarEditor${preview ? ' hasPreview' : ''}${celebrate ? ' isSaved' : ''}`}>
            <button type="button" className="avatarButton" onClick={() => inputRef.current?.click()} disabled={busy} aria-busy={busy} aria-label={action}>
                <Avatar {...AVATAR_DEFAULTS} src={preview ?? src ?? undefined} name={name} className="heroAvatar" />
                <span className="avatarHover" aria-hidden="true">
                    <LuCamera />
                    <span>{action}</span>
                </span>
                <span className="avatarBadge" aria-hidden="true">
                    {busy ? <Spinner size="sm" color="current" /> : <LuCamera />}
                </span>
            </button>
            {preview && <span className="previewBadge">{t('Preview')}</span>}
            <input ref={inputRef} type="file" accept="image/*,.heic,.heif" hidden onChange={pick} />
        </div>
    );
};

export default AvatarEditor;
