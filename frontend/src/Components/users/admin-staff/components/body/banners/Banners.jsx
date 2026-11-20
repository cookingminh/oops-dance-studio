import { Route, Routes, useParams } from 'react-router-dom';
import BannerList from './BannerList';
import BannerEditor from './BannerEditor';
import './banners.scss';

// /admin/banners (staff and admins): the homepage banners, and the editor for one (new or :id).
const Banners = () => (
    <Routes>
        <Route index element={<BannerList />} />
        <Route path="new" element={<BannerEditor key="new" />} />
        <Route path=":id" element={<BannerEditorFor />} />
    </Routes>
);

// A fresh editor per banner (switching from one banner to another starts over).
const BannerEditorFor = () => {
    const { id } = useParams();
    return <BannerEditor key={id} />;
};

export default Banners;
