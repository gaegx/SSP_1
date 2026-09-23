import { useEffect, useState } from 'react';
import { api, formatError } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const ROLE_LABELS = {
  admin: 'Администратор',
  customer: 'Заказчик',
  freelancer: 'Исполнитель',
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    try {
      setSessions(await api.getSessions());
    } catch (err) {
      setError(formatError(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(id) {
    try {
      await api.revokeSession(id);
      setNotice('Сессия отозвана');
      await load();
    } catch (err) {
      setError(formatError(err));
    }
  }

  return (
    <section className="page">
      <p className="eyebrow">Профиль</p>
      <h1>{user.email}</h1>
      <p className="lead">Роль: {ROLE_LABELS[user.role] || user.role}</p>
      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn danger" onClick={logout}>
          Выйти
        </button>
      </div>
      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}
      <h2 className="section-title">Активные подключения</h2>
      <ul className="proposal-list">
        {sessions.map((s) => (
          <li key={s.id} className="proposal">
            <div className="proposal-head">
              <strong>#{s.id}</strong>
              <span className={`badge ${s.active ? 'status-open' : 'status-cancelled'}`}>
                {s.active ? 'Активна' : 'Отозвана/истекла'}
              </span>
              {s.active && (
                <button type="button" className="linkish" onClick={() => revoke(s.id)}>
                  Отозвать
                </button>
              )}
            </div>
            <p className="muted">
              {s.userAgent || '—'} · {s.ip || '—'}
              <br />
              до {new Date(s.expiresAt).toLocaleString('ru-RU')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
