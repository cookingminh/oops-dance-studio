import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '@/i18n/i18nContext';

// Loaded on demand (KnowledgeEditor): the Markdown renderer is its own chunk.
// Raw HTML in the text is shown as text, never run, and images aren't loaded.
const PLUGINS = [remarkGfm];

const NoImage = () => {
    const { t } = useI18n();
    return <em className="kbNoImage">{t('(image: the assistant only reads text)')}</em>;
};

// The article's title is the card's h2, so headings in the text start below it.
const COMPONENTS = {
    h1: ({ children }) => <h3>{children}</h3>,
    h2: ({ children }) => <h4>{children}</h4>,
    h3: ({ children }) => <h5>{children}</h5>,
    h4: ({ children }) => <h6>{children}</h6>,
    h5: ({ children }) => <h6>{children}</h6>,
    h6: ({ children }) => <h6>{children}</h6>,
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    ),
    img: NoImage,
    table: ({ children }) => (
        <div className="kbTableScroll">
            <table>{children}</table>
        </div>
    ),
};

const KnowledgePreview = ({ text }) => (
    <div className="kbMarkdown">
        <Markdown remarkPlugins={PLUGINS} components={COMPONENTS}>
            {text}
        </Markdown>
    </div>
);

export default KnowledgePreview;
