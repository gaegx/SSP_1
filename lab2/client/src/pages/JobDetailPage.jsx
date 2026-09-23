import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatError } from '../api.js';

const STATUS_LABELS = {
  open: 'Открыт',
  in_progress: 'В работе',
  done: 'Завершён',
  cancelled: 'Отменён',
};

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const [coverLetter, setCoverLetter] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [portfolio, setPortfolio] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [jobData, proposalData] = await Promise.all([
        api.getJob(id),
        api.getProposals(id),
      ]);
      setJob(jobData);
      setProposals(proposalData);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleDeleteJob() {
    if (!window.confirm('Удалить заказ и все отклики?')) return;
    try {
      await api.deleteJob(id);
      navigate('/');
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleDeleteProposal(proposalId) {
    if (!window.confirm('Удалить отклик?')) return;
    try {
      await api.deleteProposal(proposalId);
      setNotice('Отклик удалён');
      await load();
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleSubmitProposal(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const fd = new FormData();
      fd.append('coverLetter', coverLetter);
      fd.append('bidAmount', bidAmount);
      fd.append('estimatedDays', estimatedDays);
      if (portfolio) fd.append('portfolio', portfolio);
      await api.createProposal(id, fd);
      setCoverLetter('');
      setBidAmount('');
      setEstimatedDays('');
      setPortfolio(null);
      setNotice('Отклик отправлен');
      await load();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (!job && error) return <div className="banner error">{error}</div>;
  if (!job) return null;

  return (
    <section className="page">
      <Link to="/" className="back-link">
        ← К ленте заказов
      </Link>

      <article className="detail-hero">
        <div className="page-head">
          <div>
            <p className="eyebrow">Заказ #{job.id}</p>
            <h1>{job.title}</h1>
            <p className="lead">{job.description}</p>
          </div>
          <div className="actions">
            <Link className="btn ghost" to={`/jobs/${job.id}/edit`}>
              Редактировать
            </Link>
            <button type="button" className="btn danger" onClick={handleDeleteJob}>
              Удалить
            </button>
          </div>
        </div>

        <div className="meta-strip">
          <span className={`badge status-${job.status}`}>
            {STATUS_LABELS[job.status]}
          </span>
          <span className="budget">{job.budget.toLocaleString('ru-RU')} ₽</span>
          {job.attachmentPath && (
            <a className="file-link" href={job.attachmentPath} target="_blank" rel="noreferrer">
              Скачать вложение
            </a>
          )}
        </div>
      </article>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}

      <div className="split">
        <div>
          <h2 className="section-title">Отклики ({proposals.length})</h2>
          {proposals.length === 0 && (
            <p className="muted">Пока нет откликов.</p>
          )}
          <ul className="proposal-list">
            {proposals.map((p) => (
              <li key={p.id} className="proposal">
                <div className="proposal-head">
                  <strong>{p.bidAmount.toLocaleString('ru-RU')} ₽</strong>
                  <span>{p.estimatedDays} дн.</span>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => handleDeleteProposal(p.id)}
                  >
                    Удалить
                  </button>
                </div>
                <p>{p.coverLetter}</p>
                {p.portfolioPath && (
                  <a href={p.portfolioPath} target="_blank" rel="noreferrer">
                    Портфолио
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>

        <form className="panel sticky-panel" onSubmit={handleSubmitProposal}>
          <h2 className="section-title">Оставить отклик</h2>
          <label>
            Сопроводительное письмо
            <textarea
              required
              minLength={10}
              rows={5}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
          </label>
          <label>
            Ставка, ₽
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
            />
          </label>
          <label>
            Срок, дней
            <input
              type="number"
              min="1"
              max="365"
              required
              value={estimatedDays}
              onChange={(e) => setEstimatedDays(e.target.value)}
            />
          </label>
          <label>
            Портфолио (файл)
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => setPortfolio(e.target.files?.[0] || null)}
            />
          </label>
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? 'Отправка…' : 'Отправить'}
          </button>
        </form>
      </div>
    </section>
  );
}
