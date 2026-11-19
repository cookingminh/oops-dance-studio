import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LuImagePlus, LuLoader2, LuSendHorizonal, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { prepareImage } from '@/lib/image';
import { MESSAGE_MAX } from '@/services/support';

const MAX_HEIGHT = 140;

// The text box under a conversation (and under a new question): text, one photo, Send.
// `value` / `onChange` hold the text (the caller keeps the draft). `onSend({ body, file })` resolves to true
// when the message went out (the box empties) or false (the draft stays, e.g. the studio just closed).
// `onTyping` is called on every keystroke ("… is typing" for the other side).
// Sending: the paper plane flies off and a new one slides in.
const SupportComposer = ({
    value,
    onChange,
    onSend,
    placeholder,
    requireText = false,
    disabled = false,
    disabledNote = null,
    autoFocus = false,
    onTyping,
}) => {
    const { t } = useI18n();
    const toast = useToast();
    const [photo, setPhoto] = useState(null); // { file, url }
    const [preparing, setPreparing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [flights, setFlights] = useState(0);
    const textRef = useRef(null);
    const fileRef = useRef(null);

    // Grow with the text, up to a few lines.
    useLayoutEffect(() => {
        const box = textRef.current;
        if (!box) return;
        box.style.height = 'auto';
        box.style.height = `${Math.min(box.scrollHeight, MAX_HEIGHT)}px`;
    }, [value]);

    useEffect(() => {
        if (autoFocus && !disabled) textRef.current?.focus();
    }, [autoFocus, disabled]);

    useEffect(() => {
        if (!photo) return undefined;
        return () => URL.revokeObjectURL(photo.url);
    }, [photo]);

    const text = value ?? '';
    const remaining = MESSAGE_MAX - text.length;
    const canSend = !disabled && !busy && !preparing && (requireText ? text.trim() !== '' : text.trim() !== '' || Boolean(photo));

    const pick = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setPreparing(true);
        try {
            const prepared = await prepareImage(file);
            setPhoto({ file: prepared, url: URL.createObjectURL(prepared) });
        } catch (error) {
            toast.error(error);
        } finally {
            setPreparing(false);
        }
    };

    const submit = async (event) => {
        event?.preventDefault();
        if (!canSend) return;
        setFlights((count) => count + 1);
        setBusy(true);
        const sent = await onSend({ body: text.trim() || null, file: photo?.file ?? null });
        setBusy(false);
        if (sent) {
            onChange('');
            setPhoto(null);
            textRef.current?.focus();
        }
    };

    // Enter sends, Shift+Enter starts a new line; never while a Vietnamese (IME) word is being typed.
    const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
        }
    };

    if (disabled && disabledNote) {
        return (
            <div className="supportComposer isDisabled">
                <p className="supportComposerNote">{disabledNote}</p>
            </div>
        );
    }

    return (
        <form className="supportComposer" onSubmit={submit}>
            <AnimatePresence>
                {photo && (
                    <motion.div
                        key={photo.url}
                        className="supportComposerPhoto"
                        initial={{ opacity: 0, scale: 0.7, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.14 } }}
                        transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                    >
                        <img src={photo.url} alt={t('The photo you are sending')} />
                        <button type="button" onClick={() => setPhoto(null)} aria-label={t('Remove the photo')}>
                            <LuX />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="supportComposerRow">
                <button
                    type="button"
                    className="supportIconBtn supportAttach"
                    onClick={() => fileRef.current?.click()}
                    disabled={disabled || busy || preparing}
                    aria-label={photo ? t('Change the photo') : t('Attach a photo')}
                    title={photo ? t('Change the photo') : t('Attach a photo')}
                >
                    {preparing ? <LuLoader2 className="supportSpin" /> : <LuImagePlus />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
                <textarea
                    ref={textRef}
                    rows={1}
                    value={text}
                    onChange={(event) => {
                        onChange(event.target.value);
                        if (event.target.value.trim()) onTyping?.();
                    }}
                    onKeyDown={onKeyDown}
                    maxLength={MESSAGE_MAX}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    disabled={disabled || busy}
                />
                <motion.button
                    type="submit"
                    className={`supportSend${busy ? ' isBusy' : ''}`}
                    disabled={!canSend}
                    aria-label={t('Send')}
                    aria-busy={busy}
                    title={t('Send')}
                    animate={{ scale: canSend || busy ? 1 : 0.9 }}
                    whileTap={canSend ? { scale: 0.86 } : undefined}
                    transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                >
                    <AnimatePresence initial={false} mode="popLayout">
                        <motion.span
                            key={flights}
                            className="supportSendIcon"
                            initial={{ x: -12, y: 12, opacity: 0 }}
                            animate={{ x: 0, y: 0, opacity: 1 }}
                            exit={{ x: 24, y: -24, rotate: -14, opacity: 0 }}
                            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <LuSendHorizonal />
                        </motion.span>
                    </AnimatePresence>
                </motion.button>
            </div>
            {remaining < 200 && <p className="supportComposerCount">{t('{count} characters left', { count: remaining })}</p>}
        </form>
    );
};

export default SupportComposer;
