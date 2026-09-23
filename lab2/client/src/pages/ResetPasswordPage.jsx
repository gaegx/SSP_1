import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api, formatError } from '../api.js';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.resetPassword(token, password);
      navigate('/login');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page narrow">
      <p className="eyebrow">Новый пароль</p>
      <h1>Сброс пароля</h1>
      {!token && <div className="banner error">В ссылке нет token</div>}
      {error && <div className="banner error">{error}</div>}
      <form className="panel form-panel" onSubmit={onSubmit}>
        <label>
          Новый пароль
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn primary" type="submit" disabled={loading || !token}>
          {loading ? 'Сохранение…' : 'Сохранить'}
        </button>
      </form>
      <p className="muted pad">
        <Link to="/login">Ко входу</Link>
      </p>
    </section>
  );
}
