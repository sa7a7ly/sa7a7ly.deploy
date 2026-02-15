import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../services/api';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useI18n();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await loginUser({
        email,
        password,
      });

      login(response.data);
      const loggedInUser = response.data?.user || response.data;

      if (loggedInUser.role === 'ADMIN') {
        navigate('/admin/users');
      } else if (loggedInUser.role === 'TEACHER') {
        navigate('/teacher-dashboard');
      } else if (loggedInUser.role === 'ASSISTANT') {
        navigate('/assistant-dashboard');
      } else {
        navigate('/student-dashboard');
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-10 text-white">
          <div>
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Sa7a7ly logo"
                className="h-12 w-12 rounded-xl bg-white/10 p-2"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
                  Sa7a7ly
                </p>
                <h1 className="text-3xl font-bold">{t('auth.welcomeBack')}</h1>
              </div>
            </div>
            <p className="mt-6 text-sm text-emerald-100/90">
              {t('landing.subhead')}
            </p>
          </div>
          <div className="text-xs text-emerald-100/70">
            {t('landing.startBody')}
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="flex items-center gap-3 lg:hidden">
            <img
              src={logo}
              alt="Sa7a7ly logo"
              className="h-10 w-10 rounded-xl bg-slate-100 p-2"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                Sa7a7ly
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                {t('auth.welcomeBack')}
              </h1>
            </div>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">
            {t('auth.loginTitle')}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t('auth.loginHelp')}
          </p>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('common.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('common.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('common.login')}
          </button>
        </form>

          <p className="text-center mt-6 text-slate-600">
            {t('auth.dontHave')}{' '}
            <button
              onClick={() => navigate('/register')}
              className="text-emerald-700 font-semibold hover:underline"
            >
              {t('common.register')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
