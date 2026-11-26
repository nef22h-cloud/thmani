import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import AddMethod from './pages/AddMethod.jsx';
import WarrantyForm from './pages/WarrantyForm.jsx';
import WarrantyDetails from './pages/WarrantyDetails.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="add" element={<AddMethod />} />
        <Route path="add/manual" element={<WarrantyForm />} />
        <Route path="w/:id" element={<WarrantyDetails />} />
        <Route path="w/:id/edit" element={<WarrantyForm />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
