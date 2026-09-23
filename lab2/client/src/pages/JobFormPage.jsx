import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, formatError } from '../api.js';

const STATUSES = [
  { value: 'open', label: 'Открыт' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Завершён' },
  { value: 'cancelled', label: 'Отменён' },
];

export default function JobFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState('open');
  const [attachment, setAttachment] = useState(null);
  const [existingAttachment, setExistingAttachment] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    api
      .getJob(id)
      .then((job) => {
        if (cancelled) return;
        setTitle(job.title);
        setDescription(job.description);
        setBudget(String(job.budget));
        setStatus(job.status);
        setExistingAttachment(job.attachmentPath);
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
  }, [id, isEdit]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('budget', budget);
      fd.append('status', status);
      if (attachment) fd.append('attachment', attachment);

      if (isEdit) {
        await api.updateJob(id, fd);
        navigate(`/jobs/${id}`);
      } else {
        const created = await api.createJob(fd);
        navigate(`/jobs/${created.id}`);
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;

  return (
    <section className="page narrow">
      <p className="eyebrow">{isEdit ? 'Редактирование' : 'Публикация'}</p>
      <h1>{isEdit ? 'Редактировать заказ' : 'Новый заказ'}</h1>
      <p className="lead">Опишите задачу и при необходимости приложите ТЗ.</p>

      {error && <div className="banner error">{error}</div>}

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <label>
          Название
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Описание
          <textarea
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Бюджет, ₽
          <input
            type="number"
            min="1"
            step="0.01"
            required
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </label>
        <label>
          Статус
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Вложение (PDF/DOC/изображение)
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            onChange={(e) => setAttachment(e.target.files?.[0] || null)}
          />
        </label>
        {existingAttachment && !attachment && (
          <p className="muted">
            Текущий файл:{' '}
            <a href={existingAttachment} target="_blank" rel="noreferrer">
              открыть
            </a>
          </p>
        )}
        <button className="btn primary" type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}
        </button>
      </form>
    </section>
  );
}
