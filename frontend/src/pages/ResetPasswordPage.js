import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/api';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

const PasswordEyeButton = ({ visible, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="absolute inset-y-0 right-3 inline-flex items-center justify-center text-slate-500 transition hover:text-emerald-700"
    aria-label={label}
    title={label}
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.88 5.09A9.77 9.77 0 0112 4.8c4.72 0 8.27 3.11 9.5 7.2a10.88 10.88 0 01-4.04 5.54M6.61 6.61A10.9 10.9 0 002.5 12c.54 1.8 1.57 3.44 2.95 4.72"
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
          d="M2.5 12C3.73 7.91 7.28 4.8 12 4.8s8.27 3.11 9.5 7.2c-1.23 4.09-4.78 7.2-9.5 7.2S3.73 16.09 2.5 12z"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )}
  </button>
);

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  const getInputClassName = (hasError) =>
    `w-full px-4 py-2 border rounded-lg transition focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-400 bg-red-50/70 focus:ring-red-500'
        : 'border-slate-300 focus:ring-emerald-500'
    }`;

  const validateForm = () => {
    const nextErrors = {};

    if (!token) {
      nextErrors.token = t('authErrors.resetTokenMissing');
    }
    if (!password) {
      nextErrors.password = t('authErrors.passwordRequired');
    } else if (password.length < 6) {
      nextErrors.password = t('authErrors.passwordMin');
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = t('authErrors.confirmPasswordRequired');
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = t('authErrors.passwordMismatch');
    }

    setFieldErrors(nextErrors);
    setNotice(
      Object.keys(nextErrors).length > 0 ? t('authErrors.reviewHighlightedFields') : ''
    );
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setNotice('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await resetPassword({ token, password });
      setNotice(response.data?.message || t('auth.passwordResetSuccess'));
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err?.response?.data?.message || t('authErrors.server'));
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
              <img src={logo} alt="Sa7a7ly logo" className="h-12 w-12 rounded-xl bg-white/10 p-2" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">Sa7a7ly</p>
                <h1 className="text-3xl font-bold">{t('auth.resetPasswordTitle')}</h1>
              </div>
            </div>
            <p className="mt-6 text-sm text-emerald-100/90">{t('auth.resetPasswordHelp')}</p>
          </div>
          <div className="text-xs text-emerald-100/70">{t('landing.startBody')}</div>
        </div>

        <div className="p-8 sm:p-10">
          <h2 className="mt-2 text-2xl font-bold text-slate-900">{t('auth.resetPasswordTitle')}</h2>
          <p className="mt-2 text-sm text-slate-600">{t('auth.resetPasswordHelp')}</p>

          {notice && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">{t('auth.validationTitle')}</p>
              <p className="mt-1">{notice}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-semibold">{t('auth.resetIssue')}</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {fieldErrors.token && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-semibold">{t('auth.resetIssue')}</p>
              <p className="mt-1">{fieldErrors.token}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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
                    setFieldErrors((prev) => ({ ...prev, password: '', confirmPassword: '' }));
                    if (notice) setNotice('');
                    if (error) setError('');
                  }}
                  autoComplete="new-password"
                  className={`${getInputClassName(Boolean(fieldErrors.password))} pr-20`}
                  placeholder="••••••••"
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                <PasswordEyeButton
                  visible={showPassword}
                  onClick={() => setShowPassword((prev) => !prev)}
                  label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                />
              </div>
              {fieldErrors.password && (
                <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-2">
                {t('auth.confirmPassword')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                    if (notice) setNotice('');
                    if (error) setError('');
                  }}
                  autoComplete="new-password"
                  className={`${getInputClassName(Boolean(fieldErrors.confirmPassword))} pr-20`}
                  placeholder="••••••••"
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                />
                <PasswordEyeButton
                  visible={showConfirmPassword}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                />
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('auth.resetPasswordButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
