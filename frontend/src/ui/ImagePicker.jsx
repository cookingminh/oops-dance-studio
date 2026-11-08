import { useRef, useState } from 'react';
import { Button } from '@nextui-org/react';
import { prepareImage } from '@/lib/image';

// Picks an image and prepares it for upload (HEIC → JPEG, resized, ≤ 5 MB).
// Calls onChange(File) with the prepared file, or onChange(null) if it can't be used.
const ImagePicker = ({ label = 'Upload Image', onChange, isDisabled, capture, color = 'primary', startContent }) => {
    const inputRef = useRef(null);
    const [fileName, setFileName] = useState('');
    const [preparing, setPreparing] = useState(false);
    const [error, setError] = useState('');

    const handleChange = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = ''; // allow picking the same file again
        if (!file) return;
        setError('');
        setPreparing(true);
        try {
            const prepared = await prepareImage(file);
            setFileName(`${file.name} (${(prepared.size / 1024 / 1024).toFixed(1)} MB)`);
            onChange(prepared);
        } catch (prepError) {
            setFileName('');
            setError(prepError.message);
            onChange(null);
        } finally {
            setPreparing(false);
        }
    };

    return (
        <div className="flex flex-col gap-2 mb-2">
            <Button color={color} variant="flat" startContent={preparing ? undefined : startContent} onPress={() => inputRef.current?.click()} isLoading={preparing} isDisabled={isDisabled}>
                {preparing ? 'Preparing image…' : label}
            </Button>
            <input ref={inputRef} type="file" accept="image/*,.heic,.heif" capture={capture} hidden onChange={handleChange} />
            {fileName && <span className="text-sm text-default-600">{fileName}</span>}
            {error && <span className="text-sm text-red-600" role="alert">{error}</span>}
        </div>
    );
};

export default ImagePicker;
