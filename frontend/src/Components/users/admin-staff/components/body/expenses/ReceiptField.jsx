import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuFileText, LuImage, LuRefreshCw, LuTrash2, LuUndo2, LuUpload } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { MAX_RECEIPT_BYTES, RECEIPT_ACCEPT, canPreview, isPdfFile, isPdfPath } from './expensesModel';

const isHeic = (file) => /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

// Checks a picked file; returns an English error (translated by the caller) or null.
function receiptProblem(file) {
    if (isPdfFile(file)) return file.size > MAX_RECEIPT_BYTES ? 'That PDF is larger than 5 MB.' : null;
    if (file.type.startsWith('image/') || isHeic(file)) return null; // photos are shrunk before upload
    return 'Please choose a photo or a PDF.';
}

const sizeLabel = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// A local preview for an image that hasn't been uploaded yet.
function usePreview(file) {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        if (!canPreview(file)) {
            setUrl(null);
            return undefined;
        }
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);
    return url;
}

// Receipt: a photo (HEIC is converted on upload) or a PDF. It is uploaded after the expense is
// saved; an existing one can be viewed, replaced or removed.
//   existing: { path, url } | null   file: File | null   removed: boolean
const ReceiptField = ({ existing, file, removed, onFile, onRemove, onRestore, onView }) => {
    const { t } = useI18n();
    const inputRef = useRef(null);
    const id = useId();
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);
    const preview = usePreview(file);
    const showExisting = existing?.path && !file && !removed;

    const take = (picked) => {
        if (!picked) return;
        const problem = receiptProblem(picked);
        setError(problem ? t(problem) : '');
        if (!problem) onFile(picked);
    };

    const pick = () => inputRef.current?.click();

    const input = (
        <input
            ref={inputRef}
            id={id}
            type="file"
            accept={RECEIPT_ACCEPT}
            className="exFileInput"
            aria-label={t('Receipt (photo or PDF)')}
            onChange={(event) => {
                take(event.target.files?.[0]);
                event.target.value = ''; // the same file can be picked again
            }}
        />
    );

    let body;
    if (file) {
        body = (
            <div className="exReceiptPicked">
                {preview ? (
                    <img src={preview} alt={t('Receipt preview')} className="exReceiptThumb" />
                ) : (
                    <span className="exReceiptThumb isFile" aria-hidden="true">
                        {isPdfFile(file) ? <LuFileText /> : <LuImage />}
                    </span>
                )}
                <span className="exReceiptMeta">
                    <strong>{file.name}</strong>
                    <small>{`${sizeLabel(file.size)} · ${t('Uploads when you save')}`}</small>
                </span>
                <span className="exReceiptActions">
                    <Button size="sm" variant="flat" startContent={<LuRefreshCw aria-hidden="true" />} onPress={pick}>
                        {t('Change')}
                    </Button>
                    <Button size="sm" variant="light" isIconOnly aria-label={t('Remove this file')} onPress={() => onFile(null)}>
                        <LuTrash2 />
                    </Button>
                </span>
            </div>
        );
    } else if (showExisting) {
        const pdf = isPdfPath(existing.path);
        body = (
            <div className="exReceiptPicked">
                <button type="button" className="exReceiptThumbButton" onClick={onView} aria-label={t('View receipt')}>
                    {existing.url && !pdf ? (
                        <img src={existing.url} alt="" className="exReceiptThumb" />
                    ) : (
                        <span className="exReceiptThumb isFile" aria-hidden="true">
                            {pdf ? <LuFileText /> : <LuImage />}
                        </span>
                    )}
                </button>
                <span className="exReceiptMeta">
                    <strong>{pdf ? t('PDF receipt') : t('Receipt photo')}</strong>
                    <button type="button" className="exLinkButton" onClick={onView}>
                        {t('View')}
                    </button>
                </span>
                <span className="exReceiptActions">
                    <Button size="sm" variant="flat" startContent={<LuRefreshCw aria-hidden="true" />} onPress={pick}>
                        {t('Replace')}
                    </Button>
                    <Button size="sm" variant="light" isIconOnly aria-label={t('Remove the receipt')} onPress={onRemove}>
                        <LuTrash2 />
                    </Button>
                </span>
            </div>
        );
    } else {
        body = (
            <button
                type="button"
                className={`exDrop${dragging ? ' isDragging' : ''}`}
                onClick={pick}
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    take(event.dataTransfer.files?.[0]);
                }}
            >
                <LuUpload aria-hidden="true" />
                <span>
                    <strong>{t('Add a receipt')}</strong>
                    <small>{t('Photo or PDF, up to 5 MB. Optional.')}</small>
                </span>
            </button>
        );
    }

    return (
        <div className="exReceiptField">
            <span className="exFieldLabel">{t('Receipt')}</span>
            {input}
            {body}
            {removed && existing?.path && !file && (
                <p className="exHint">
                    {t('The receipt is removed when you save.')}{' '}
                    <button type="button" className="exLinkButton" onClick={onRestore}>
                        <LuUndo2 aria-hidden="true" />
                        {t('Keep it')}
                    </button>
                </p>
            )}
            {error && (
                <p className="exHint isError" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
};

export default ReceiptField;
