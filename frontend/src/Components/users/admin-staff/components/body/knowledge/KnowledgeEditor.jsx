import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea } from '@nextui-org/react';
import { LuArrowLeft, LuCode2, LuEye, LuPenLine, LuTrash2, LuType } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { ErrorMessage, Loading } from '@/ui/feedback/AsyncState';
import { ARTICLE_CATEGORIES, BODY_MAX, TITLE_MAX, categoryLabel, createArticle, deleteArticle, getArticle, updateArticle } from '@/services/knowledge';
import { toAppError } from '@/services/errors';
import { dropUnsaved, keepUnsaved, readUnsaved } from '@/lib/unsavedArticles';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import { fadeUp } from '../../common/motion';
import { draftKey, editedText, excerptOf, fieldsOf, missingOf, payloadOf, whenText } from './knowledgeModel';
import { DiscardDialog, StatusPill, WritingTips } from './KnowledgeParts';

const VisualEditor = lazy(() => import('./editor/VisualEditor'));
const KnowledgePreview = lazy(() => import('./KnowledgePreview'));
const LIST = '/admin/knowledge';

// The visual editor didn't load or broke: the Markdown box takes over (the text is the page's, nothing is lost).
class EditorBoundary extends Component {
    state = { broken: false };

    static getDerivedStateFromError() {
        return { broken: true };
    }

    componentDidCatch() {
        this.props.onBroken();
    }

    render() {
        return this.state.broken ? null : this.props.children;
    }
}

// /admin/knowledge/new and /admin/knowledge/:id: the article's title, category and text. The text is written as it will
// look (editor/VisualEditor.jsx) and stored as Markdown; the Markdown itself, with a live preview, is a button away, and
// opens by itself for a text the visual editor can't show.
// A draft is saved, published or deleted; a published one is changed (at once), unpublished or deleted.
// What isn't saved is kept in this browser (lib/unsavedArticles.js): leaving loses nothing, and coming back asks whether
// to carry on with it (or carries on right away, from the list's unsaved draft: location.state.restore).
const KnowledgeEditor = ({ id = null }) => {
    const i18n = useI18n();
    const { t } = i18n;
    const { user } = useAuth();
    const userId = user.id;
    const toast = useToast();
    const navigate = useNavigate();
    const restore = useLocation().state?.restore === true;
    const [unsavedNew] = useState(() => (id === null ? readUnsaved(userId, null) : null));

    const [load, setLoad] = useState({ loading: id !== null, error: null, missing: false });
    const [article, setArticle] = useState(null); // as saved; null = a new one
    const [draft, setDraft] = useState(() => fieldsOf(restore ? unsavedNew : null));
    const [offer, setOffer] = useState(restore ? null : unsavedNew); // unsaved text from before, waiting for an answer
    const [kept, setKept] = useState(true); // what isn't saved is kept in this browser
    const [attempted, setAttempted] = useState(null); // what was pressed last: 'save' | 'publish'
    const [busy, setBusy] = useState(null); // 'save' | 'publish' | 'unpublish' | 'delete'
    const [mode, setMode] = useState('visual'); // 'visual' | 'markdown'
    const [whyMarkdown, setWhyMarkdown] = useState(null); // why the visual editor isn't used: what the text has in it (English labels), or 'broken'
    const [pane, setPane] = useState('text'); // Markdown on a narrow screen: the text or its preview
    const [asking, setAsking] = useState(null); // 'leave' | 'discard' | 'delete'
    const latest = useRef(draft);
    latest.current = draft;

    const loadArticle = useCallback(async () => {
        if (id === null) return;
        setLoad({ loading: true, error: null, missing: false });
        try {
            const row = Number.isSafeInteger(id) ? await getArticle(id) : null;
            const unsaved = row && readUnsaved(userId, row.id);
            const differs = Boolean(unsaved) && draftKey(unsaved) !== draftKey(fieldsOf(row));
            setArticle(row);
            setDraft(fieldsOf(differs && restore ? unsaved : row));
            setOffer(differs && !restore ? unsaved : null);
            setLoad({ loading: false, error: null, missing: !row });
        } catch (error) {
            setLoad({ loading: false, error: toAppError(error), missing: false });
        }
    }, [id, userId, restore]);
    useEffect(() => {
        loadArticle();
    }, [loadArticle]);

    const published = article?.status === 'published';
    const dirty = draftKey(draft) !== draftKey(fieldsOf(article));
    const missing = missingOf(draft, { published: published || attempted === 'publish' });

    // Every change is kept at once; nothing is written while the text from before waits for an answer.
    const ready = !load.loading && !load.error && !load.missing && !offer;
    const base = article?.updated_at ?? null;
    useEffect(() => {
        if (!ready) return;
        if (dirty) {
            setKept(keepUnsaved(userId, id, draft, base));
        } else {
            dropUnsaved(userId, id);
            setKept(true);
        }
    }, [ready, dirty, draft, base, userId, id]);

    // Only when the browser can't keep it: closing the tab asks the browser's own question, going back asks ours.
    const atRisk = dirty && !kept;
    useEffect(() => {
        const warn = (event) => {
            if (!atRisk) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [atRisk]);

    const change = (patch) => setDraft((current) => ({ ...current, ...patch }));
    const changeBody = useCallback((body) => setDraft((current) => ({ ...current, body })), []);
    const toMarkdown = useCallback((why) => {
        setWhyMarkdown(why);
        setMode('markdown');
    }, []);
    const switchMode = () => {
        setWhyMarkdown(null);
        setMode(mode === 'visual' ? 'markdown' : 'visual');
    };

    // Saves the fields, and publishes when asked to. What is typed meanwhile stays (and counts as unsaved).
    const save = async (action) => {
        setAttempted(action);
        const publishing = action === 'publish';
        if (missingOf(draft, { published: published || publishing }).length) return;
        setBusy(action);
        try {
            const fields = { ...payloadOf(draft), ...(publishing && { status: 'published' }) };
            const row = article ? await updateArticle(article.id, fields) : await createArticle(fields);
            setAttempted(null);
            toast.success(publishing ? 'Article published' : published ? 'Changes published' : 'Draft saved');
            if (article) {
                setArticle(row);
                return;
            }
            // The new article's own page takes over, with what was typed while it was saved.
            dropUnsaved(userId, null);
            const typedOn = latest.current !== draft;
            if (typedOn) keepUnsaved(userId, row.id, latest.current, row.updated_at);
            navigate(`${LIST}/${row.id}`, { replace: true, state: typedOn ? { restore: true } : null });
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    // Only the status: changes not saved yet stay in the form.
    const unpublish = async () => {
        setBusy('unpublish');
        try {
            setArticle(await updateArticle(article.id, { status: 'draft' }));
            toast.success('Article unpublished');
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    const remove = async () => {
        setBusy('delete');
        try {
            await deleteArticle(article.id);
            dropUnsaved(userId, article.id);
            toast.success('Article deleted');
            navigate(LIST);
        } catch (error) {
            toast.error(error);
            setBusy(null);
        }
    };

    const back = () => (atRisk ? setAsking('leave') : navigate(LIST));

    // Back to what is saved (a new article: to the list).
    const discard = () => {
        dropUnsaved(userId, id);
        setAsking(null);
        setAttempted(null);
        if (article) setDraft(fieldsOf(article));
        else navigate(LIST);
    };
    const carryOn = () => {
        setDraft(fieldsOf(offer));
        setOffer(null);
    };
    const discardOffer = () => {
        dropUnsaved(userId, id);
        setOffer(null);
    };

    if (load.loading) return <Loading />;
    if (load.error) return <ErrorMessage error={load.error} onRetry={loadArticle} />;
    if (load.missing) {
        return (
            <SectionCard title={t('This article doesn’t exist any more')}>
                <Button variant="flat" startContent={<LuArrowLeft aria-hidden="true" />} onPress={() => navigate(LIST)}>
                    {t('Back to the articles')}
                </Button>
            </SectionCard>
        );
    }

    const counted = t('{count} of {max} characters', { count: draft.body.length.toLocaleString(i18n.intl), max: BODY_MAX.toLocaleString(i18n.intl) });

    return (
        <motion.div variants={fadeUp} className="kbEditor">
            <header className="kbEditorTop">
                <Button isIconOnly variant="light" onPress={back} aria-label={t('Back to the articles')}>
                    <LuArrowLeft aria-hidden="true" />
                </Button>
                <div className="kbEditorTitle">
                    <h2>{article ? article.title : t('New article')}</h2>
                    {article && <StatusPill status={article.status} />}
                    {dirty && (
                        <span className="kbUnsaved">
                            {kept ? t('Not saved yet, kept on this device') : t('Unsaved changes')}
                            <button type="button" onClick={() => setAsking('discard')} disabled={Boolean(busy)}>
                                {t('Discard changes')}
                            </button>
                        </span>
                    )}
                    {article && (
                        <small>
                            {editedText(article, i18n)}
                            {published && ` · ${t('Published {time}', { time: whenText(article.published_at, i18n) })}`}
                        </small>
                    )}
                </div>
                <div className="kbEditorActions">
                    {article && (
                        <Button variant="light" color="danger" startContent={<LuTrash2 aria-hidden="true" />} onPress={() => setAsking('delete')} isDisabled={Boolean(busy)}>
                            {t('Delete')}
                        </Button>
                    )}
                    {published ? (
                        <>
                            <Button variant="flat" onPress={unpublish} isLoading={busy === 'unpublish'} isDisabled={Boolean(busy)}>
                                {t('Unpublish')}
                            </Button>
                            <Button color="danger" onPress={() => save('save')} isLoading={busy === 'save'} isDisabled={!dirty || Boolean(busy)}>
                                {t('Save changes')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="flat" onPress={() => save('save')} isLoading={busy === 'save'} isDisabled={(!dirty && Boolean(article)) || Boolean(busy)}>
                                {t('Save draft')}
                            </Button>
                            <Button color="danger" onPress={() => save('publish')} isLoading={busy === 'publish'} isDisabled={Boolean(busy)}>
                                {t('Publish')}
                            </Button>
                        </>
                    )}
                </div>
            </header>

            {attempted && missing.length > 0 && (
                <div className="kbMissing" role="alert">
                    <strong>{attempted === 'publish' ? t('Before publishing:') : t('Before saving:')}</strong>
                    <ul>
                        {missing.map((key) => (
                            <li key={key}>{t(key)}</li>
                        ))}
                    </ul>
                </div>
            )}
            {published && (
                <p className="kbNotice">{t('This article is published: saving changes the published text at once. To rework it out of sight, unpublish it first.')}</p>
            )}

            <WritingTips />

            {mode === 'markdown' && (
                <Segmented
                    className="kbPanes"
                    label={t('Show the text or its preview')}
                    value={pane}
                    onChange={setPane}
                    options={[
                        { key: 'text', label: t('Edit text') },
                        { key: 'preview', label: t('Preview') },
                    ]}
                />
            )}

            <div className={`kbGrid is-${mode}`} data-pane={pane}>
                <SectionCard
                    icon={LuPenLine}
                    title={t('The article')}
                    className="kbTextCol"
                    actions={
                        <Button size="sm" variant="light" startContent={mode === 'visual' ? <LuCode2 aria-hidden="true" /> : <LuType aria-hidden="true" />} onPress={switchMode}>
                            {mode === 'visual' ? t('Write in Markdown') : t('Write as it looks')}
                        </Button>
                    }
                >
                    <div className="kbForm">
                        <div className="kbFormTop">
                            <Input
                                label={t('Article title')}
                                description={t('As a customer would ask it: “How much back if I cancel?”')}
                                value={draft.title}
                                onValueChange={(title) => change({ title })}
                                maxLength={TITLE_MAX}
                                isRequired
                            />
                            <Select
                                label={t('Article category')}
                                selectedKeys={draft.category ? [draft.category] : []}
                                onChange={(event) => change({ category: event.target.value })}
                                classNames={{ popoverContent: 'adminPortal' }}
                                isRequired
                            >
                                {ARTICLE_CATEGORIES.map((category) => (
                                    <SelectItem key={category.key} textValue={t(category.label)}>
                                        {t(category.label)}
                                    </SelectItem>
                                ))}
                            </Select>
                        </div>
                        {whyMarkdown && (
                            <p className="kbNotice" role="status">
                                {whyMarkdown === 'broken'
                                    ? t('The visual editor didn’t open, so the text is edited as Markdown: nothing is lost. Reload the page to try again.')
                                    : t('This text has things only Markdown can show ({things}), so it is edited as Markdown: nothing is lost.', { things: whyMarkdown.map((label) => t(label)).join(', ') })}
                            </p>
                        )}
                        {mode === 'visual' ? (
                            <>
                                {ready && (
                                    <EditorBoundary onBroken={() => toMarkdown('broken')}>
                                        <Suspense fallback={<Loading />}>
                                            <VisualEditor label={t('Article text')} value={draft.body} saved={article?.body ?? ''} onChange={changeBody} onUnsupported={toMarkdown} />
                                        </Suspense>
                                    </EditorBoundary>
                                )}
                                <p className="kbCount">{counted}</p>
                            </>
                        ) : (
                            <Textarea
                                label={t('Article text')}
                                description={`${t('Markdown: ## heading, **bold**, - list, | table |, [link](https://…).')} ${counted}`}
                                value={draft.body}
                                onValueChange={changeBody}
                                maxLength={BODY_MAX}
                                minRows={16}
                                maxRows={32}
                            />
                        )}
                    </div>
                </SectionCard>

                {mode === 'markdown' && (
                    <SectionCard icon={LuEye} title={t('Preview')} className="kbPreviewCol">
                        {draft.category && <span className="kbPreviewCategory">{t(categoryLabel(draft.category))}</span>}
                        {draft.title.trim() && <h2 className="kbPreviewTitle">{draft.title.trim()}</h2>}
                        {draft.body.trim() ? (
                            <Suspense fallback={<Loading />}>
                                <KnowledgePreview text={draft.body} />
                            </Suspense>
                        ) : (
                            <p className="kbHint">{t('The text shows here as you write.')}</p>
                        )}
                    </SectionCard>
                )}
            </div>

            {offer && (
                <Modal isOpen hideCloseButton isDismissable={false} isKeyboardDismissDisabled placement="center" classNames={{ base: 'adminPortal kbDialog' }}>
                    <ModalContent>
                        <ModalHeader>{t('Carry on with your unsaved text?')}</ModalHeader>
                        <ModalBody>
                            <p>{t('You left “{name}” without saving ({time}). The text is kept on this device.', { name: offer.title.trim() || t('Untitled article'), time: whenText(offer.at, i18n) })}</p>
                            {offer.body.trim() && <blockquote className="kbExcerpt">{excerptOf(offer.body)}</blockquote>}
                            {article && offer.base !== article.updated_at && (
                                <p className="kbChanged">{t('The saved article has changed since then ({edited}). Saving your text replaces it.', { edited: editedText(article, i18n) })}</p>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={discardOffer}>
                                {t('Discard it')}
                            </Button>
                            <Button color="danger" onPress={carryOn}>
                                {t('Carry on writing')}
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}
            {asking === 'discard' && <DiscardDialog isNew={!article} onClose={() => setAsking(null)} onDiscard={discard} />}
            {asking === 'leave' && (
                <Modal isOpen onOpenChange={(open) => !open && setAsking(null)} placement="center" classNames={{ base: 'adminPortal kbDialog' }}>
                    <ModalContent>
                        <ModalHeader>{t('Leave without saving?')}</ModalHeader>
                        <ModalBody>
                            <p>{t('Your changes to this article will be lost.')}</p>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={() => setAsking(null)}>
                                {t('Keep editing')}
                            </Button>
                            <Button color="danger" onPress={() => navigate(LIST)}>
                                {t('Leave without saving')}
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}
            {asking === 'delete' && (
                <Modal isOpen onOpenChange={(open) => !open && busy !== 'delete' && setAsking(null)} placement="center" classNames={{ base: 'adminPortal kbDialog' }}>
                    <ModalContent>
                        <ModalHeader>{t('Delete the article “{name}”?', { name: article.title })}</ModalHeader>
                        <ModalBody>
                            <p>
                                {published
                                    ? t('It’s published: the assistant won’t be able to use it any more. This can’t be undone.')
                                    : t('This draft is gone for good. This can’t be undone.')}
                            </p>
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="flat" onPress={() => setAsking(null)} isDisabled={busy === 'delete'}>
                                {t('Keep it')}
                            </Button>
                            <Button color="danger" onPress={remove} isLoading={busy === 'delete'}>
                                {t('Delete article')}
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}
        </motion.div>
    );
};

export default KnowledgeEditor;
