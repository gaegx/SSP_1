import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api, formatError } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function LoginPage() {
  const { applyAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.login({ email, password });
      applyAuth(data);
      navigate(location.state?.from || '/');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page narrow">
      <p className="eyebrow">Вход</p>
      <h1>С возвращением</h1>
      <p className="lead">Войдите по email и паролю. После 5 ошибок аккаунт блокируется на 15 минут.</p>
      {error && <div className="banner error">{error}</div>}
      <form className="panel form-panel" onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Пароль
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? 'Вход…' : 'Войти'}
        </button>
      </form>
      <p className="muted pad">
        Нет аккаунта? <Link to="/register">Регистрация</Link>
        {' · '}
        <Link to="/forgot-password">Забыли пароль?</Link>
      </p>
      <p className="muted">Админ по умолчанию: admin@freelance.local / Admin123!</p>
    </section>
  );
}
