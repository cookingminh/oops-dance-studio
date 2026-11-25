import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '@nextui-org/react';
import { LuBookOpenCheck, LuChevronRight, LuFilterX, LuPlus, LuSearch, LuSearchX, LuSparkles } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n/i18nContext';
import { formatDateTime } from '@/lib/format';
import { ErrorMessage, Loading } from '@/ui/feedback/AsyncState';
import { ARTICLE_CATEGORIES, categoryLabel, listArticles } from '@/services/knowledge';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import StatusSelect from '../../common/StatusSelect';
import { CATEGORY_KEYS, STATUSES, countBy, editedText, filterArticles } from './knowledgeModel';
import { CategoryIcon, StatusPill } from './KnowledgeParts';

const NO_ARTICLES = [];

// /admin/knowledge: every article, the last edited first, filtered by category and status (?category=, ?status=) and
// searched by title (?q=), so a filtered list can be shared and comes back with the Back button.
const KnowledgeList = () => {
    const i18n = useI18n();
    const { t, tn } = i18n;
    const navigate = useNavigate();
    const list = useAsync(listArticles, []);
    const [params, setParams] = useSearchParams();
    const category = CATEGORY_KEYS.includes(params.get('category')) ? params.get('category') : 'all';
    const status = params.get('status') in STATUSES ? params.get('status') : 'all';
    const [query, setQuery] = useState(params.get('q') ?? '');

    const setParam = (patch) =>
        setParams(
            (old) => {
                const next = new URLSearchParams(old);
                for (const [key, value] of Object.entries(patch)) {
                    if (!value || value === 'all') next.delete(key);
                    else next.set(key, value);
                }
                return next;
            },
            { replace: true }
        );
    const search = (value) => {
        setQuery(value);
        setParam({ q: value.trim() });
    };
    const clear = () => {
        setQuery('');
        setParam({ category: null, status: null, q: null });
    };

    const articles = list.data ?? NO_ARTICLES;
    const visible = filterArticles(articles, { category, status, query });
    const filtered = category !== 'all' || status !== 'all' || query.trim() !== '';

    const newButton = (
        <Button color="danger" startContent={<LuPlus aria-hidden="true" />} onPress={() => navigate('/admin/knowledge/new')}>
            {t('New article')}
        </Button>
    );

    return (
        <SectionCard
            className="kbList"
            icon={LuBookOpenCheck}
            title={t('Knowledge articles')}
            subtitle={t('What the assistant will be able to tell customers. It only uses published articles; they don’t show on the website.')}
            actions={
                <>
                    {/* A placeholder: the assistant doesn't exist yet. */}
                    <Button variant="flat" isDisabled startContent={<LuSparkles aria-hidden="true" />} endContent={<span className="kbSoon">{t('Coming later')}</span>}>
                        {t('Ask the assistant')}
                    </Button>
                    {newButton}
                </>
            }
        >
            {list.error && !list.data && <ErrorMessage error={list.error} onRetry={list.reload} />}
            {list.loading && !list.data && <Loading />}

            {list.data && articles.length === 0 && (
                <div className="kbEmpty">
                    <span className="kbEmptyIcon" aria-hidden="true">
                        <LuBookOpenCheck />
                    </span>
                    <strong>{t('No articles yet')}</strong>
                    <p>{t('Start with what customers ask most: prices, cancelling, which class to take.')}</p>
                    {newButton}
                </div>
            )}

            {articles.length > 0 && (
                <>
                    <div className="kbToolbar">
                        <Input
                            isClearable
                            aria-label={t('Search by title')}
                            placeholder={t('Search by title')}
                            className="kbSearch"
                            startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                            value={query}
                            onValueChange={search}
                            onClear={() => search('')}
                        />
                        <StatusSelect
                            label={t('Article category')}
                            options={[
                                { key: 'all', label: t('Any category'), count: articles.length },
                                ...ARTICLE_CATEGORIES.map((item) => ({ key: item.key, label: t(item.label), count: countBy(articles, 'category', item.key) })),
                            ]}
                            value={category}
                            onChange={(key) => setParam({ category: key })}
                        />
                        <Segmented
                            label={t('Article status')}
                            options={[
                                { key: 'all', label: t('All'), count: articles.length },
                                ...Object.entries(STATUSES).map(([key, item]) => ({ key, label: t(item.filter), count: countBy(articles, 'status', key) })),
                            ]}
                            value={status}
                            onChange={(key) => setParam({ status: key })}
                        />
                    </div>

                    <p className="kbSummary" aria-live="polite">
                        {tn(visible.length, '{count} article', '{count} articles')}
                    </p>

                    {visible.length === 0 ? (
                        <div className="kbEmpty">
                            <span className="kbEmptyIcon" aria-hidden="true">
                                <LuSearchX />
                            </span>
                            <strong>{t('No article fits')}</strong>
                            {filtered && (
                                <Button size="sm" variant="flat" startContent={<LuFilterX aria-hidden="true" />} onPress={clear}>
                                    {t('Show every article')}
                                </Button>
                            )}
                        </div>
                    ) : (
                        <ul className="kbRows" aria-label={t('Knowledge articles')}>
                            {visible.map((article) => (
                                <li key={article.id} data-article={article.id}>
                                    <Link to={`/admin/knowledge/${article.id}`} className={`kbRow is-${article.status}`}>
                                        <CategoryIcon category={article.category} />
                                        <span className="kbRowText">
                                            <strong>{article.title}</strong>
                                            <small>
                                                {t(categoryLabel(article.category))}
                                                {' · '}
                                                <span title={formatDateTime(article.updated_at)}>{editedText(article, i18n)}</span>
                                            </small>
                                        </span>
                                        <StatusPill status={article.status} />
                                        <LuChevronRight className="kbChevron" aria-hidden="true" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </SectionCard>
    );
};

export default KnowledgeList;
