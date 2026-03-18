import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgotPassword } from '../services/api';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
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

    if (!trimmedEmail) {
      nextErrors.email = t('authErrors.emailRequired');
    } else if (!emailRegex.test(trimmedEmail)) {
      nextErrors.email = t('authErrors.emailInvalid');
    }

    setFieldErrors(nextErrors);
    setFormNotice(
      Object.keys(nextErrors).length > 0 ? t('authErrors.reviewHighlightedFields') : ''
    );
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setFormNotice('');
    setSuccessMessage('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await forgotPassword({ email: email.trim() });
      setSuccessMessage(response.data?.message || t('auth.forgotPasswordSuccess'));
    } catch (err) {
      const status = Number(err?.response?.status);
      const serverMessage = err?.response?.data?.message;

      if (status === 404) {
        setFieldErrors((prev) => ({
          ...prev,
          email: serverMessage || t('authErrors.forgotPasswordEmailNotFound'),
        }));
        setFormNotice(t('authErrors.reviewHighlightedFields'));
        setError('');
        return;
      }

      setError(serverMessage || t('authErrors.server'));
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
                <h1 className="text-3xl font-bold">{t('auth.forgotPasswordTitle')}</h1>
              </div>
            </div>
            <p className="mt-6 text-sm text-emerald-100/90">{t('auth.forgotPasswordHelp')}</p>
          </div>
          <div className="text-xs text-emerald-100/70">{t('landing.startBody')}</div>
        </div>

        <div className="p-8 sm:p-10">
          <h2 className="mt-2 text-2xl font-bold text-slate-900">{t('auth.forgotPasswordTitle')}</h2>
          <p className="mt-2 text-sm text-slate-600">{t('auth.forgotPasswordHelp')}</p>

          {formNotice && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">{t('auth.validationTitle')}</p>
              <p className="mt-1">{formNotice}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-semibold">{t('auth.resetIssue')}</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="font-semibold">{t('auth.emailSentTitle')}</p>
              <p className="mt-1">{successMessage}</p>
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
                  if (successMessage) setSuccessMessage('');
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
              {fieldErrors.email && (
                <div className="mt-2 text-sm text-slate-600">
                  <span>{t('auth.noAccountPrompt')} </span>
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="font-semibold text-emerald-700 hover:underline"
                  >
                    {t('auth.registerIfNoAccount')}
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('auth.sendResetLink')}
            </button>
          </form>

          <p className="text-center mt-6 text-slate-600">
            <button onClick={() => navigate('/login')} className="text-emerald-700 font-semibold hover:underline">
              {t('common.login')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
