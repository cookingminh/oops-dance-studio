import { Button, Spinner } from '@nextui-org/react';

export function Loading({ label = 'Loading…' }) {
    return (
        <div className="flex justify-center items-center p-8 w-full">
            <Spinner color="danger" label={label} />
        </div>
    );
}

export function ErrorMessage({ error, onRetry }) {
    return (
        <div role="alert" className="flex flex-col items-center gap-3 p-6 w-full text-center">
            <p className="text-red-600 font-medium">{error?.message ?? 'Something went wrong.'}</p>
            {onRetry && (
                <Button size="sm" variant="flat" onPress={onRetry}>
                    Try again
                </Button>
            )}
        </div>
    );
}

export function Empty({ text = 'Nothing here yet.' }) {
    return <p className="p-6 w-full text-center text-gray-500">{text}</p>;
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
