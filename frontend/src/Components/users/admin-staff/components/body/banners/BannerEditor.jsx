import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch, Textarea } from '@nextui-org/react';
import { LuArrowLeft, LuCalendarRange, LuEye, LuImage, LuMousePointerClick, LuPlus } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { ErrorMessage, Loading } from '@/ui/feedback/AsyncState';
import DateField from '@/ui/DateField';
import { BANNER_MAX_BUTTONS, BANNER_SAFE, discardPosters, listBanners, saveBanner, uploadBannerPoster } from '@/services/banners';
import { toAppError } from '@/services/errors';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import { fadeUp } from '../../common/motion';
import PosterField from './PosterField';
import ButtonFields from './ButtonFields';
import BannerPreview from './BannerPreview';
import { PREVIEW_PRESETS, draftKey, draftOf, missingOf, newButton, payloadOf } from './bannerModel';

// /admin/banners/new and /admin/banners/:id: the two posters, the buttons, when it shows — and a live preview of
// the homepage (laptop, large screen, phone) where the buttons are dragged, resized and snapped into place.
// Posters upload as soon as they're picked; ones never saved are deleted when the editor is left.
const BannerEditor = () => {
    const { id } = useParams();
    const bannerId = id && id !== 'new' ? Number(id) : null;
    const { t } = useI18n();
    const toast = useToast();
    const navigate = useNavigate();
    const preview = useRef(null);
    const uploads = useRef(new Set()); // posters uploaded here and not saved yet
    const saved = useRef(false);

    const [load, setLoad] = useState({ loading: Boolean(bannerId), error: null, missing: false });
    const [initial] = useState(() => draftOf(null));
    const [draft, setDraft] = useState(initial);
    const [baseline, setBaseline] = useState(() => draftKey(initial));
    // On a phone, the preview starts on the phone poster (a laptop would be drawn tiny).
    const [preset, setPreset] = useState(() => (window.innerWidth < 700 ? 'phone' : 'laptop'));
    const [lang, setLang] = useState('vi');
    const [showZones, setShowZones] = useState(true);
    const [selectedId, setSelectedId] = useState(() => draft.buttons[0]?.id ?? null);
    const [uploading, setUploading] = useState({ desktop: false, phone: false });
    const [attempted, setAttempted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [leaving, setLeaving] = useState(false);

    const loadBanner = useCallback(async () => {
        if (!bannerId) return;
        setLoad({ loading: true, error: null, missing: false });
        try {
            const banner = (await listBanners()).find((row) => row.id === bannerId);
            if (!banner) {
                setLoad({ loading: false, error: null, missing: true });
                return;
            }
            const next = draftOf(banner);
            setDraft(next);
            setBaseline(draftKey(next));
            setSelectedId(next.buttons[0]?.id ?? null);
            setLoad({ loading: false, error: null, missing: false });
        } catch (error) {
            setLoad({ loading: false, error: toAppError(error), missing: false });
        }
    }, [bannerId]);
    useEffect(() => {
        loadBanner();
    }, [loadBanner]);

    const dirty = useMemo(() => draftKey(draft) !== baseline, [draft, baseline]);
    const missing = missingOf(draft);
    const device = PREVIEW_PRESETS[preset].device;

    // Closing the tab with unsaved changes asks the browser's own question; leaving the editor any other way
    // deletes the posters uploaded here and not saved.
    useEffect(() => {
        const warn = (event) => {
            if (!dirty) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);
    useEffect(
        () => () => {
            if (!saved.current && uploads.current.size) discardPosters([...uploads.current]);
        },
        []
    );

    const change = (patch) => setDraft((current) => ({ ...current, ...patch }));
    const changeButton = (buttonId, patch) =>
        setDraft((current) => ({ ...current, buttons: current.buttons.map((button) => (button.id === buttonId ? { ...button, ...patch } : button)) }));
    const changeSpot = (buttonId, spotDevice, patch) =>
        setDraft((current) => ({
            ...current,
            buttons: current.buttons.map((button) => (button.id === buttonId ? { ...button, [spotDevice]: { ...button[spotDevice], ...patch } } : button)),
        }));

    const pickPoster = async (posterDevice, file) => {
        const previous = draft[posterDevice];
        const url = URL.createObjectURL(file);
        setDraft((current) => ({ ...current, [posterDevice]: { ...(current[posterDevice] ?? {}), url, path: null } }));
        setUploading((current) => ({ ...current, [posterDevice]: true }));
        setPreset((current) => (posterDevice === 'phone' ? 'phone' : current === 'phone' ? 'laptop' : current));
        try {
            const uploaded = await uploadBannerPoster(file, posterDevice);
            uploads.current.add(uploaded.path);
            // A poster picked here and replaced before saving isn't needed any more.
            if (previous?.path && uploads.current.has(previous.path)) {
                uploads.current.delete(previous.path);
                discardPosters([previous.path]);
            }
            setDraft((current) => ({ ...current, [posterDevice]: { ...uploaded, url } }));
        } catch (error) {
            toast.error(error);
            setDraft((current) => ({ ...current, [posterDevice]: previous }));
        } finally {
            setUploading((current) => ({ ...current, [posterDevice]: false }));
        }
    };

    const addButton = () => {
        const button = newButton(draft.buttons.at(-1));
        setDraft((current) => ({ ...current, buttons: [...current.buttons, button] }));
        setSelectedId(button.id);
    };
    const removeButton = (buttonId) => {
        const rest = draft.buttons.filter((button) => button.id !== buttonId);
        setDraft((current) => ({ ...current, buttons: current.buttons.filter((button) => button.id !== buttonId) }));
        if (selectedId === buttonId) setSelectedId(rest[0]?.id ?? null);
    };
    // The 9 quick spots, inside the safe area (the button's own size taken into account).
    const quickSpot = (button, col, row) => {
        const safe = BANNER_SAFE[device];
        const half = preview.current?.measure(button.id) ?? { w: 8, h: 3 };
        const x = [safe.x0 + half.w + 1, 50, safe.x1 - half.w - 1][col];
        const y = [safe.y0 + half.h + 2, 50, safe.y1 - half.h - 2][row];
        changeSpot(button.id, device, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
        setSelectedId(button.id);
    };

    const leave = () => {
        if (uploads.current.size) discardPosters([...uploads.current]);
        uploads.current.clear();
        navigate('/admin/banners');
    };
    const cancel = () => (dirty ? setLeaving(true) : leave());

    const save = async () => {
        setAttempted(true);
        if (missing.length || uploading.desktop || uploading.phone) return;
        setSaving(true);
        try {
            await saveBanner(bannerId, payloadOf(draft));
            const kept = new Set([draft.desktop?.path, draft.phone?.path]);
            const unused = [...uploads.current].filter((path) => !kept.has(path));
            if (unused.length) discardPosters(unused);
            uploads.current.clear();
            saved.current = true;
            toast.success(bannerId ? 'Banner saved' : 'Banner added to the homepage');
            navigate('/admin/banners');
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    if (load.loading) return <Loading />;
    if (load.error) return <ErrorMessage error={load.error} onRetry={loadBanner} />;
    if (load.missing) {
        return (
            <SectionCard title={t('This banner doesn’t exist any more')} className="bnGone">
                <Button variant="flat" startContent={<LuArrowLeft aria-hidden="true" />} onPress={() => navigate('/admin/banners')}>
                    {t('Back to the banners')}
                </Button>
            </SectionCard>
        );
    }

    return (
        <motion.div variants={fadeUp} className="bnEditor">
            <header className="bnEditorTop">
                <Button isIconOnly variant="light" onPress={cancel} aria-label={t('Back to the banners')}>
                    <LuArrowLeft aria-hidden="true" />
                </Button>
                <div className="bnEditorTitle">
                    <h2>{bannerId ? draft.name || t('Banner') : t('New banner')}</h2>
                    {dirty && <span className="bnUnsaved">{t('Unsaved changes')}</span>}
                </div>
                <Button variant="flat" onPress={cancel} isDisabled={saving}>
                    {t('Cancel')}
                </Button>
                <Button color="danger" onPress={save} isLoading={saving} isDisabled={!dirty && Boolean(bannerId)}>
                    {t('Save')}
                </Button>
            </header>

            {attempted && missing.length > 0 && (
                <div className="bnMissingList" role="alert">
                    <strong>{t('Before saving:')}</strong>
                    <ul>
                        {missing.map((key) => (
                            <li key={key}>{t(key)}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="bnEditorGrid">
                <div className="bnForm">
                    <SectionCard icon={LuImage} title={t('Posters')} subtitle={t('Designed elsewhere (Canva…), with the words on the image. Both are needed.')}>
                        <div className="bnFormStack">
                            <Input
                                label={t('Banner name')}
                                description={t('Shown under the homepage’s slide bar, and in this list.')}
                                value={draft.name}
                                onValueChange={(name) => change({ name })}
                                maxLength={60}
                                isRequired
                            />
                            <PosterField device="desktop" poster={draft.desktop} uploading={uploading.desktop} onPick={(file) => pickPoster('desktop', file)} />
                            <PosterField device="phone" poster={draft.phone} uploading={uploading.phone} onPick={(file) => pickPoster('phone', file)} />
                            <p className="bnHint">{t('Keep words and faces away from the striped strips on the preview: the navigation bar and the slide bar sit there.')}</p>
                            <Textarea
                                label={t('What the poster says')}
                                description={t('In plain words, for Google and for people using a screen reader.')}
                                value={draft.alt_text}
                                onValueChange={(alt_text) => change({ alt_text })}
                                maxLength={400}
                                minRows={2}
                                isRequired
                            />
                        </div>
                    </SectionCard>

                    <SectionCard
                        icon={LuMousePointerClick}
                        title={t('Buttons')}
                        subtitle={t('{count} of {max} · click a button on the preview to pick it', { count: draft.buttons.length, max: BANNER_MAX_BUTTONS })}
                    >
                        <div className="bnFormStack">
                            {draft.buttons.length === 0 && <p className="bnHint">{t('No buttons: the poster shows on its own.')}</p>}
                            {draft.buttons.map((button, index) => (
                                <ButtonFields
                                    key={button.id}
                                    button={button}
                                    index={index}
                                    device={device}
                                    selected={button.id === selectedId}
                                    onSelect={() => setSelectedId(button.id)}
                                    onChange={(patch) => changeButton(button.id, patch)}
                                    onSpot={(patch) => changeSpot(button.id, device, patch)}
                                    onQuick={(col, row) => quickSpot(button, col, row)}
                                    onRemove={() => removeButton(button.id)}
                                />
                            ))}
                            {draft.buttons.length < BANNER_MAX_BUTTONS && (
                                <Button variant="flat" startContent={<LuPlus aria-hidden="true" />} onPress={addButton} className="bnAddButton">
                                    {t('Add a button')}
                                </Button>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard icon={LuCalendarRange} title={t('When it shows')}>
                        <div className="bnFormStack">
                            <div className="bnTwo">
                                <DateField label={t('Shows from')} value={draft.starts_on} onChange={(starts_on) => change({ starts_on })} description={t('Empty: from now')} />
                                <DateField label={t('Hides after')} value={draft.ends_on} onChange={(ends_on) => change({ ends_on })} description={t('Empty: no end')} />
                            </div>
                            <Switch color="success" isSelected={draft.enabled} onValueChange={(enabled) => change({ enabled })}>
                                {t('Show on the homepage')}
                            </Switch>
                        </div>
                    </SectionCard>
                </div>

                <div className="bnPreviewCol">
                    <SectionCard icon={LuEye} title={t('Preview')} subtitle={t('Exactly as the homepage shows it. Drag a button to move it; its corner handle resizes it.')}>
                        <div className="bnPreviewBar">
                            <Segmented
                                label={t('Preview on')}
                                value={preset}
                                onChange={setPreset}
                                options={Object.entries(PREVIEW_PRESETS).map(([key, screen]) => ({ key, label: t(screen.label) }))}
                            />
                            <Segmented label={t('Words on the buttons')} value={lang} onChange={setLang} options={[{ key: 'vi', label: 'VI' }, { key: 'en', label: 'EN' }]} />
                            <Switch size="sm" isSelected={showZones} onValueChange={setShowZones}>
                                {t('Show areas to avoid')}
                            </Switch>
                        </div>
                        <BannerPreview
                            ref={preview}
                            draft={draft}
                            preset={preset}
                            lang={lang}
                            showZones={showZones}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onSpot={changeSpot}
                            slideLabel={draft.name || t('This banner')}
                        />
                    </SectionCard>
                </div>
            </div>

            {leaving && (
                <Modal isOpen onOpenChange={(open) => !open && setLeaving(false)} placement="center" classNames={{ base: 'adminPortal bnDialog' }}>
                    <ModalContent>
                        <ModalHeader>{t('Leave without saving?')}</ModalHeader>
                        <ModalBody>
                            <p>{t('Your changes to this banner will be lost.')}</p>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={() => setLeaving(false)}>
                                {t('Keep editing')}
                            </Button>
                            <Button color="danger" onPress={leave}>
                                {t('Leave without saving')}
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}
        </motion.div>
    );
};

export default BannerEditor;
