import { Button, Spinner } from '@nextui-org/react';
import { useI18n } from '@/i18n/i18nContext';

export function Loading({ label = 'Loading…' }) {
    const { t } = useI18n();
    return (
        <div className="flex justify-center items-center p-8 w-full">
            <Spinner color="danger" label={t(label)} />
        </div>
    );
}

export function ErrorMessage({ error, onRetry }) {
    const { t } = useI18n();
    return (
        <div role="alert" className="flex flex-col items-center gap-3 p-6 w-full text-center">
            <p className="text-red-600 font-medium">{t(error?.message ?? 'Something went wrong.')}</p>
            {onRetry && (
                <Button size="sm" variant="flat" onPress={onRetry}>
                    {t('Try again')}
                </Button>
            )}
        </div>
    );
}

// `text` may be a string (English source, translated here) or an element (already translated).
export function Empty({ text = 'Nothing here yet.' }) {
    const { t } = useI18n();
    return <p className="p-6 w-full text-center text-gray-500">{typeof text === 'string' ? t(text) : text}</p>;
}

// Renders loading / error / empty states for a useAsync() result, otherwise its children.
// Pass isEmpty={false} for views (like tables) that render their own empty state.
export default function AsyncState({ state, isEmpty, emptyText, children }) {
    const { data, error, loading, reload } = state;
    if (error) return <ErrorMessage error={error} onRetry={reload} />;
    if (loading && data === undefined) return <Loading />;
    const empty = isEmpty ?? (Array.isArray(data) && data.length === 0);
    if (empty) return <Empty text={emptyText} />;
    return typeof children === 'function' ? children(data) : children;
}
