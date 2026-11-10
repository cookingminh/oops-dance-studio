import { Fragment } from 'react';

// Fills the {placeholders} of an already translated template with React nodes, so amounts and
// class names can be bold inside a sentence: <RichText text={t('Paid {amount}…')} vars={{ amount: <strong>…</strong> }} />.
const RichText = ({ text, vars }) =>
    text.split(/\{(\w+)\}/g).map((part, index) => (index % 2 ? <Fragment key={index}>{vars[part] ?? `{${part}}`}</Fragment> : part));

export default RichText;
