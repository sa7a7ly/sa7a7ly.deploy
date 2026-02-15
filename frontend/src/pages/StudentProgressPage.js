import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStudentSubmissions } from '../services/api';
import { useI18n } from '../context/I18nContext';
import logo from '../images/image.png';

const StudentProgressPage = () => {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await getStudentSubmissions(user._id);
        setSubmissions(response.data || []);
        setError('');
      } catch (err) {
        setError(t('errors.failedLoadSubmissions'));
      } finally {
        setLoading(false);
      }
    };
    if (user?._id) {
      load();
    }
  }, [user?._id, t]);

  const metrics = useMemo(() => {
    const sorted = [...submissions].sort(
      (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)
    );
    const points = sorted.map((s) => {
      const total = s.assignmentId?.totalPoints || 100;
      const value = s.grade ?? 0;
      return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
    });
    const avg =
      points.length === 0
        ? 0
        : Math.round(points.reduce((acc, v) => acc + v, 0) / points.length);
    const last = points.length ? points[points.length - 1] : 0;
    const best = points.length ? Math.max(...points) : 0;
    return { sorted, points, avg, last, best };
  }, [submissions]);

  const advice = useMemo(() => {
    if (metrics.points.length < 2) {
      return t('progress.keepGoing');
    }
    if (metrics.avg >= 85) return t('progress.excellent');
    if (metrics.avg >= 70) return t('progress.good');
    return t('progress.needsWork');
  }, [metrics, t]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const renderLine = () => {
    if (metrics.points.length === 0) {
      return null;
    }
    const width = 520;
    const height = 160;
    const pad = 16;
    const max = 100;
    const step = metrics.points.length === 1 ? 0 : (width - pad * 2) / (metrics.points.length - 1);
    const points = metrics.points.map((v, i) => {
      const x = pad + step * i;
      const y = height - pad - (v / max) * (height - pad * 2);
      return `${x},${y}`;
    });
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          points={points.join(' ')}
        />
        <polygon
          fill="url(#lineFill)"
          points={`${pad},${height - pad} ${points.join(' ')} ${
            width - pad
          },${height - pad}`}
        />
        {points.map((p, idx) => {
          const [x, y] = p.split(',');
          return (
            <circle key={idx} cx={x} cy={y} r="4" fill="#0f766e" />
          );
        })}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/student-dashboard')}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← {t('common.back')}
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Sa7a7ly
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                {t('progress.title')}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              {t('dashboards.welcome')}, {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-200/40 blur-2xl" />
          <div className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-sky-200/40 blur-2xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="Sa7a7ly logo"
                  className="h-12 w-12 rounded-xl bg-white p-2 shadow"
                />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    {t('progress.subtitle')}
                  </p>
                  <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                    {t('progress.headline')}
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-700">
                {advice}
              </p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">
                  {metrics.avg}%
                </p>
                <p className="text-sm text-slate-600">{t('progress.average')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">
                  {metrics.best}%
                </p>
                <p className="text-sm text-slate-600">{t('progress.best')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">
                  {metrics.last}%
                </p>
                <p className="text-sm text-slate-600">{t('progress.latest')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">
                  {metrics.points.length}
                </p>
                <p className="text-sm text-slate-600">{t('progress.count')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-xl font-bold text-slate-900">
              {t('progress.trend')}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {t('progress.trendHelp')}
            </p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {metrics.points.length === 0 ? (
                <p className="text-sm text-slate-500">{t('progress.noData')}</p>
              ) : (
                renderLine()
              )}
            </div>
          </section>
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-xl font-bold text-slate-900">
              {t('progress.advice')}
            </h3>
            <p className="mt-3 text-sm text-slate-600">{advice}</p>
            <div className="mt-4 space-y-3">
              {metrics.sorted.slice(-5).reverse().map((submission) => (
                <div
                  key={submission._id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {submission.assignmentId?.title || t('common.assignments')}
                  </p>
                  <p className="text-xs text-slate-600">
                    {new Date(submission.submittedAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-slate-700 mt-2">
                    {t('submit.grade')}: {submission.grade ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-slate-600">
            {t('common.loading')}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProgressPage;
