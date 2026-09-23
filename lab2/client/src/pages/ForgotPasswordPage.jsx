import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatError } from '../api.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await api.forgotPassword(email);
      setNotice(`${data.message}. Письмо смотрите в Mailhog: http://localhost:8025`);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page narrow">
      <p className="eyebrow">Восстановление</p>
      <h1>Забыли пароль?</h1>
      <p className="lead">Отправим ссылку для сброса на email (Mailhog).</p>
      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}
      <form className="panel form-panel" onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? 'Отправка…' : 'Отправить ссылку'}
        </button>
      </form>
      <p className="muted pad">
        <Link to="/login">Назад ко входу</Link>
      </p>
    </section>
  );
}
