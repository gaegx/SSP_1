import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import JobListPage from './pages/JobListPage.jsx';
import JobDetailPage from './pages/JobDetailPage.jsx';
import JobFormPage from './pages/JobFormPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

function Shell() {
  const { isAuthenticated, user, logout } = useAuth();

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
            {isAuthenticated ? (
              <>
                <NavLink to="/" end>
                  Заказы
                </NavLink>
                {(user.role === 'customer' || user.role === 'admin') && (
                  <NavLink to="/jobs/new">+ Новый заказ</NavLink>
                )}
                <NavLink to="/profile">{user.email}</NavLink>
                <button type="button" className="nav-cta btn-as-nav" onClick={logout}>
                  Выйти
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Вход</NavLink>
                <NavLink to="/register" className="nav-cta">
                  Регистрация
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <JobListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/new"
            element={
              <ProtectedRoute roles={['customer', 'admin']}>
                <JobFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:id/edit"
            element={
              <ProtectedRoute roles={['customer', 'admin']}>
                <JobFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <ProtectedRoute>
                <JobDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>Freelance Desk</span>
          <span className="muted">Лаба 3 · JWT · роли · Mailhog</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
