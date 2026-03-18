import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../services/api';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

function PasswordEyeButton({ visible, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute inset-y-0 right-3 flex items-center justify-center text-slate-500 transition hover:text-slate-700 focus:outline-none"
    >
      {visible ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-1.02 2.29-2.78 4.23-5 5.44M6.61 6.61C4.62 7.91 3.15 9.79 2 12c.69 1.57 1.78 3 3.16 4.16"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useI18n();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const getInputClassName = (hasError) =>
    `w-full px-4 py-2 border rounded-lg transition focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-400 bg-red-50/70 focus:ring-red-500'
        : 'border-slate-300 focus:ring-emerald-500'
    }`;

  const validateForm = () => {
    const nextErrors = {};
    const trimmedEmail = email.trim();
    const missingRequiredField = !trimmedEmail || !password;

    if (!trimmedEmail) {
      nextErrors.email = t('authErrors.emailRequired');
    } else if (!emailRegex.test(trimmedEmail)) {
      nextErrors.email = t('authErrors.emailInvalid');
    }

    if (!password) {
      nextErrors.password = t('authErrors.passwordRequired');
    }

    setFieldErrors(nextErrors);
    setFormNotice(
      Object.keys(nextErrors).length > 0
        ? missingRequiredField
          ? t('authErrors.missingFields')
          : t('authErrors.reviewHighlightedFields')
        : ''
    );
    return Object.keys(nextErrors).length === 0;
  };

  const mapLoginError = (err) => {
    if (!err?.response) {
      return t('authErrors.network');
    }

    const status = err.response.status;
    const serverMessage = err.response?.data?.message;
    const serverErrors = err.response?.data?.errors;

    if (Array.isArray(serverErrors) && serverErrors.length > 0) {
      const firstMessage = serverErrors[0]?.msg || serverErrors[0]?.message;
      if (firstMessage) {
        return firstMessage;
      }
    }

    if (typeof serverMessage === 'string' && serverMessage.trim()) {
      return serverMessage;
    }

    if (status === 400 || status === 401) {
      return t('authErrors.invalidCredentials');
    }
    if (status === 403) {
      return t('authErrors.loginForbidden');
    }
    if (status === 429) {
      return t('authErrors.tooManyAttempts');
    }
    if (status >= 500) {
      return t('authErrors.server');
    }

    return t('authErrors.loginFailed');
  };

  const mapLoginFieldErrors = (err) => {
    const status = Number(err?.response?.status);
    const serverMessage = String(err?.response?.data?.message || '').toLowerCase();

    if (status === 404 || serverMessage.includes('email')) {
      return { email: err.response?.data?.message || t('authErrors.emailNotFound') };
    }

    if (status === 401 || serverMessage.includes('password')) {
      return { password: err.response?.data?.message || t('authErrors.passwordIncorrect') };
    }

    return {};
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) {
      return;
    }

    setError('');
    setFormNotice('');
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await loginUser({
        email: email.trim(),
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
      const nextFieldErrors = mapLoginFieldErrors(err);
      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...nextFieldErrors }));
        setFormNotice(t('authErrors.reviewHighlightedFields'));
        setError('');
        return;
      }

      setError(mapLoginError(err));
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

        {formNotice && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">{t('auth.validationTitle')}</p>
            <p className="mt-1">{formNotice}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-semibold">{t('auth.loginIssue')}</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('common.email')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: '' }));
                if (formNotice) setFormNotice('');
                if (error) setError('');
              }}
              autoComplete="email"
              className={getInputClassName(Boolean(fieldErrors.email))}
              placeholder="your@email.com"
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email && (
              <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('common.password')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                  if (formNotice) setFormNotice('');
                  if (error) setError('');
                }}
                autoComplete="current-password"
                className={`${getInputClassName(Boolean(fieldErrors.password))} pr-12`}
                placeholder="••••••••"
                aria-invalid={Boolean(fieldErrors.password)}
              />
              <PasswordEyeButton
                visible={showPassword}
                onClick={() => setShowPassword((current) => !current)}
                label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              />
            </div>
            {fieldErrors.password && (
              <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.password}</p>
            )}
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm font-semibold text-emerald-700 hover:underline"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>
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
