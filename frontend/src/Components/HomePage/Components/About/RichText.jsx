// Copy with **double stars** around the words to stand out: those words become <strong>.
const RichText = ({ text }) =>
    String(text)
        .split(/\*\*(.+?)\*\*/g)
        .map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part));

export default RichText;
