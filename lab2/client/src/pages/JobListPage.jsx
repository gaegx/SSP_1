import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatError } from '../api.js';

const STATUS_LABELS = {
  open: 'Открыт',
  in_progress: 'В работе',
  done: 'Завершён',
  cancelled: 'Отменён',
};

export default function JobListPage() {
  const [jobs, setJobs] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getJobs(status || undefined)
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .catch((err) => {
        if (!cancelled) setError(formatError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <section className="page">
      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Маркетплейс заказов</p>
          <h1>
            Найдите исполнителя
            <br />
            или возьмите проект
          </h1>
          <p className="lead">
            Публикуйте ТЗ, прикладывайте файлы и собирайте отклики — без лишней
            бюрократии.
          </p>
          <div className="hero-actions">
            <Link className="btn primary" to="/jobs/new">
              Создать заказ
            </Link>
            <a className="btn ghost" href="#jobs">
              Смотреть ленту
            </a>
          </div>
        </div>
        <div className="hero-aside" aria-hidden="true">
          <div className="stat-chip">
            <strong>{jobs.length}</strong>
            <span>активных в ленте</span>
          </div>
        </div>
      </div>

      <div className="section-bar" id="jobs">
        <h2>Лента заказов</h2>
        <div className="toolbar">
          <label className="filter">
            <span>Статус</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Все</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      {loading && <p className="muted pad">Загрузка заказов…</p>}

      {!loading && !error && jobs.length === 0 && (
        <div className="empty">
          <h3>Пока пусто</h3>
          <p className="muted">Создайте первый заказ — и лента оживёт.</p>
          <Link className="btn primary" to="/jobs/new">
            Создать заказ
          </Link>
        </div>
      )}

      <ul className="job-grid">
        {jobs.map((job, i) => (
          <li key={job.id} style={{ animationDelay: `${i * 40}ms` }}>
            <Link to={`/jobs/${job.id}`} className="job-card">
              <div className="job-card-top">
                <span className={`badge status-${job.status}`}>
                  {STATUS_LABELS[job.status] || job.status}
                </span>
                <span className="budget">{job.budget.toLocaleString('ru-RU')} ₽</span>
              </div>
              <h3>{job.title}</h3>
              <p>
                {job.description.length > 140
                  ? `${job.description.slice(0, 140)}…`
                  : job.description}
              </p>
              <span className="job-card-link">Открыть →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
