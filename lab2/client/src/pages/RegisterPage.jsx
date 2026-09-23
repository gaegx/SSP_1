import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatError } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function RegisterPage() {
  const { applyAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.register({ email, password, role });
      applyAuth(data);
      navigate('/');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page narrow">
      <p className="eyebrow">Регистрация</p>
      <h1>Создать аккаунт</h1>
      <p className="lead">Выберите роль: заказчик или исполнитель.</p>
      {error && <div className="banner error">{error}</div>}
      <form className="panel form-panel" onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Пароль (мин. 8)
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Роль
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="customer">Заказчик (customer)</option>
            <option value="freelancer">Исполнитель (freelancer)</option>
          </select>
        </label>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? 'Создание…' : 'Зарегистрироваться'}
        </button>
      </form>
      <p className="muted pad">
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </section>
  );
}
