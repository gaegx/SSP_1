import { Routes, Route, NavLink, Link } from 'react-router-dom';
import JobListPage from './pages/JobListPage.jsx';
import JobDetailPage from './pages/JobDetailPage.jsx';
import JobFormPage from './pages/JobFormPage.jsx';

export default function App() {
  return (
    <div className="shell">
      <div className="bg-grid" aria-hidden="true" />
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-text">
              Freelance<span>Desk</span>
            </span>
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Заказы
            </NavLink>
            <NavLink to="/jobs/new" className="nav-cta">
              + Новый заказ
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<JobListPage />} />
          <Route path="/jobs/new" element={<JobFormPage />} />
          <Route path="/jobs/:id/edit" element={<JobFormPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>Freelance Desk</span>
          <span className="muted">Биржа заказов · SPA + REST</span>
        </div>
      </footer>
    </div>
  );
}
