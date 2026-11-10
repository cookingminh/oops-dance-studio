import { Navigate, Route, Routes } from 'react-router-dom';
import ClassDirectory from './directory/ClassDirectory';
import ClassPage from './page/ClassPage';
import { HUB_BASE } from './hubModel';
import './classHub.scss';

// /admin/classes: the directory of every class (today / this month / upcoming / past / timetable)
// and one page per class with everything about it (HUB_BASE in hubModel.js).
const ClassHub = () => (
    <Routes>
        <Route index element={<ClassDirectory />} />
        <Route path=":id" element={<ClassPage />} />
        <Route path="*" element={<Navigate to={HUB_BASE} replace />} />
    </Routes>
);

export default ClassHub;
