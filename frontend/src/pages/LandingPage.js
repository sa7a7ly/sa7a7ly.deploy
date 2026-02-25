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
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:py-16">
          <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-6 shadow-sm sm:p-10">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-4 flex items-center justify-center gap-3">
                <img
                  src={logo}
                  alt="Sa7a7ly logo"
                  className="h-12 w-12 rounded-xl bg-white p-2 shadow"
                />
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                  Sa7a7ly
                </p>
              </div>
              <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
                {t('landing.headline')}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-700">
                {t('landing.subhead')}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700"
                >
                  {t('common.login')}
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="rounded-lg border border-emerald-600 bg-white px-6 py-3 font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  {t('common.register')}
                </button>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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
          </section>

          <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t('landing.organize')}
              </p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">
                {t('landing.organizeTitle')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {t('landing.organizeBody')}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t('landing.improve')}
              </p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">
                {t('landing.improveTitle')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {t('landing.improveBody')}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t('landing.support')}
              </p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">
                {t('landing.supportTitle')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {t('landing.supportBody')}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t('landing.connect')}
              </p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">
                {t('landing.connectTitle')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {t('landing.connectBody')}
              </p>
            </article>
          </section>

          <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {t('landing.startToday')}
            </p>
            <p className="mt-2 text-slate-700">{t('landing.startBody')}</p>
            <div className="mt-5">
              <img
                src={logo}
                alt="Sa7a7ly logo"
                className="h-10 w-10 rounded-xl bg-white p-2 shadow"
              />
              <p className="mt-2 text-sm font-semibold text-slate-800">Sa7a7ly</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
