import { Routes, Route } from 'react-router-dom';
import WorkspacePage from './pages/WorkspacePage.jsx';
import SharedPage from './pages/SharedPage.jsx';
import ToastViewport from './components/Toast.jsx';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<WorkspacePage />} />
        <Route path="/shared/:token" element={<SharedPage />} />
      </Routes>
      <ToastViewport />
    </>
  );
}
