import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea } from '@nextui-org/react';
import { LuArrowLeft, LuEye, LuPenLine, LuTrash2 } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { ErrorMessage, Loading } from '@/ui/feedback/AsyncState';
import { ARTICLE_CATEGORIES, BODY_MAX, TITLE_MAX, categoryLabel, createArticle, deleteArticle, getArticle, updateArticle } from '@/services/knowledge';
import { toAppError } from '@/services/errors';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import { fadeUp } from '../../common/motion';
import { draftKey, editedText, fieldsOf, missingOf, payloadOf, whenText } from './knowledgeModel';
import { StatusPill, WritingTips } from './KnowledgeParts';

const KnowledgePreview = lazy(() => import('./KnowledgePreview'));
const LIST = '/admin/knowledge';

// /admin/knowledge/new and /admin/knowledge/:id: the article's title, category and Markdown text with a live preview.
// A draft is saved, published or deleted; a published one is changed (at once), unpublished or deleted.
const KnowledgeEditor = ({ id = null }) => {
    const i18n = useI18n();
    const { t } = i18n;
    const toast = useToast();
    const navigate = useNavigate();

    const [load, setLoad] = useState({ loading: id !== null, error: null, missing: false });
    const [article, setArticle] = useState(null); // as saved; null = a new one
    const [draft, setDraft] = useState(() => fieldsOf(null));
    const [attempted, setAttempted] = useState(null); // what was pressed last: 'save' | 'publish'
    const [busy, setBusy] = useState(null); // 'save' | 'publish' | 'unpublish' | 'delete'
    const [pane, setPane] = useState('text'); // narrow screens show the text or its preview
    const [asking, setAsking] = useState(null); // 'leave' | 'delete'

    const loadArticle = useCallback(async () => {
        if (id === null) return;
        setLoad({ loading: true, error: null, missing: false });
        try {
            const row = Number.isSafeInteger(id) ? await getArticle(id) : null;
            setArticle(row);
            setDraft(fieldsOf(row));
            setLoad({ loading: false, error: null, missing: !row });
        } catch (error) {
            setLoad({ loading: false, error: toAppError(error), missing: false });
        }
    }, [id]);
    useEffect(() => {
        loadArticle();
    }, [loadArticle]);

    const published = article?.status === 'published';
    const dirty = draftKey(draft) !== draftKey(fieldsOf(article));
    const missing = missingOf(draft, { published: published || attempted === 'publish' });

    // Closing the tab with unsaved changes asks the browser's own question.
    useEffect(() => {
        const warn = (event) => {
            if (!dirty) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const change = (patch) => setDraft((current) => ({ ...current, ...patch }));

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
            setArticle(row);
            toast.success(publishing ? 'Article published' : published ? 'Changes published' : 'Draft saved');
            if (!article) navigate(`${LIST}/${row.id}`, { replace: true });
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
            toast.success('Article deleted');
            navigate(LIST);
        } catch (error) {
            toast.error(error);
            setBusy(null);
        }
    };

    const back = () => (dirty ? setAsking('leave') : navigate(LIST));

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

    return (
        <motion.div variants={fadeUp} className="kbEditor">
            <header className="kbEditorTop">
                <Button isIconOnly variant="light" onPress={back} aria-label={t('Back to the articles')}>
                    <LuArrowLeft aria-hidden="true" />
                </Button>
                <div className="kbEditorTitle">
                    <h2>{article ? article.title : t('New article')}</h2>
                    {article && <StatusPill status={article.status} />}
                    {dirty && <span className="kbUnsaved">{t('Unsaved changes')}</span>}
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

            <div className="kbGrid" data-pane={pane}>
                <SectionCard icon={LuPenLine} title={t('The article')} className="kbTextCol">
                    <div className="kbForm">
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
                        <Textarea
                            label={t('Article text')}
                            description={t('Markdown: # heading, **bold**, - list, | table |, [link](https://…). {count} of {max} characters.', {
                                count: draft.body.length.toLocaleString(i18n.intl),
                                max: BODY_MAX.toLocaleString(i18n.intl),
                            })}
                            value={draft.body}
                            onValueChange={(body) => change({ body })}
                            maxLength={BODY_MAX}
                            minRows={16}
                            maxRows={32}
                        />
                    </div>
                </SectionCard>

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
            </div>

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
