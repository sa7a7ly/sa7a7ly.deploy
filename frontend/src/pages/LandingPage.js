import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import logo from '../images/image.png';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  React.useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        navigate('/admin/users');
      } else if (user.role === 'TEACHER') {
        navigate('/teacher-dashboard');
      } else if (user.role === 'ASSISTANT') {
        navigate('/assistant-dashboard');
      } else {
        navigate('/student-dashboard');
      }
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-28 right-10 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="relative mx-auto flex min-h-[75vh] max-w-7xl flex-col gap-10 px-4 py-16 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Sa7a7ly logo"
                className="h-12 w-12 rounded-xl bg-white p-2 shadow"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                  Sa7a7ly
                </p>
                <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
                  {t('landing.headline')}
                </h1>
              </div>
            </div>
            <p className="mt-6 text-lg leading-relaxed text-slate-700">
              {t('landing.subhead')}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
              >
                {t('common.login')}
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-6 py-3 bg-white text-emerald-700 border border-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition"
              >
                {t('common.register')}
              </button>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full bg-emerald-600 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                {t('landing.studentSuccess')}
              </span>
              <span className="rounded-full bg-sky-600 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                {t('landing.teacherEfficiency')}
              </span>
              <span className="rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                {t('landing.clearFeedback')}
              </span>
            </div>
          </div>

          <div className="w-full max-w-xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t('landing.organize')}
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {t('landing.organizeTitle')}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {t('landing.organizeBody')}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t('landing.improve')}
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {t('landing.improveTitle')}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {t('landing.improveBody')}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t('landing.support')}
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {t('landing.supportTitle')}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {t('landing.supportBody')}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t('landing.connect')}
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {t('landing.connectTitle')}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {t('landing.connectBody')}
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                {t('landing.startToday')}
              </p>
              <p className="mt-2 text-slate-700">{t('landing.startBody')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
