import { Route, Routes, useParams } from 'react-router-dom';
import KnowledgeList from './KnowledgeList';
import KnowledgeEditor from './KnowledgeEditor';
import './knowledge.scss';

// /admin/knowledge (staff and admins): the articles written for the assistant, and the editor for one (new or :id).
const Knowledge = () => (
    <Routes>
        <Route index element={<KnowledgeList />} />
        <Route path="new" element={<KnowledgeEditor key="new" />} />
        <Route path=":id" element={<KnowledgeEditorFor />} />
    </Routes>
);

// A fresh editor per article.
const KnowledgeEditorFor = () => {
    const { id } = useParams();
    return <KnowledgeEditor key={id} id={Number(id)} />;
};

export default Knowledge;
