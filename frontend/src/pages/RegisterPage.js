import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerUser, registerAssistant } from '../services/api';
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

const RegisterPage = () => {
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [assistantFormData, setAssistantFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    assistantCode: '',
  });

  const [showAssistantForm, setShowAssistantForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useI18n();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const activeFormData = showAssistantForm ? assistantFormData : studentFormData;

  const getInputClassName = (hasError) =>
    `w-full px-4 py-2 border rounded-lg transition focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-400 bg-red-50/70 focus:ring-red-500'
        : 'border-slate-300 focus:ring-emerald-500'
    }`;

  const validateStudentForm = () => {
    const nextErrors = {};
    const name = studentFormData.name.trim();
    const email = studentFormData.email.trim();
    const password = studentFormData.password;
    const confirmPassword = studentFormData.confirmPassword;
    const missingRequiredField =
      !name || !email || !password || !confirmPassword;

    if (!name) {
      nextErrors.name = t('authErrors.nameRequired');
    } else if (name.length < 2) {
      nextErrors.name = t('authErrors.nameMin');
    }

    if (!email) {
      nextErrors.email = t('authErrors.emailRequired');
    } else if (!emailRegex.test(email)) {
      nextErrors.email = t('authErrors.emailInvalid');
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
    setFormNotice(
      Object.keys(nextErrors).length > 0
        ? missingRequiredField
          ? t('authErrors.missingFields')
          : t('authErrors.reviewHighlightedFields')
        : ''
    );
    return Object.keys(nextErrors).length === 0;
  };

  const validateAssistantForm = () => {
    const nextErrors = {};
    const name = assistantFormData.name.trim();
    const email = assistantFormData.email.trim();
    const password = assistantFormData.password;
    const confirmPassword = assistantFormData.confirmPassword;
    const assistantCode = assistantFormData.assistantCode.trim();
    const missingRequiredField =
      !name || !email || !password || !confirmPassword || !assistantCode;

    if (!name) {
      nextErrors.name = t('authErrors.nameRequired');
    } else if (name.length < 2) {
      nextErrors.name = t('authErrors.nameMin');
    }

    if (!email) {
      nextErrors.email = t('authErrors.emailRequired');
    } else if (!emailRegex.test(email)) {
      nextErrors.email = t('authErrors.emailInvalid');
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

    if (!assistantCode) {
      nextErrors.assistantCode = t('authErrors.assistantCodeRequired');
    } else if (!/^[A-Z0-9]{8}$/.test(assistantCode)) {
      nextErrors.assistantCode = t('authErrors.assistantCodeInvalid');
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

  const mapRegisterError = (err, isAssistant) => {
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

    if (status === 400) {
      return isAssistant
        ? t('authErrors.checkAssistantDetails')
        : t('authErrors.checkDetails');
    }
    if (status === 401 || status === 403) {
      return isAssistant
        ? t('authErrors.assistantCodeExpired')
        : t('authErrors.notAllowed');
    }
    if (status === 409) {
      return t('authErrors.emailExists');
    }
    if (status === 429) {
      return t('authErrors.tooManyAttempts');
    }
    if (status >= 500) {
      return t('authErrors.server');
    }

    return isAssistant
      ? t('authErrors.assistantRegisterFailed')
      : t('authErrors.registerFailed');
  };

  const handleStudentChange = (e) => {
    const { name, value } = e.target;
    setStudentFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    if (formNotice) setFormNotice('');
    if (error) setError('');
  };

  const handleAssistantChange = (e) => {
    const { name, value } = e.target;
    setAssistantFormData((prev) => ({
      ...prev,
      [name]: name === 'assistantCode' ? value.toUpperCase() : value,
    }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    if (formNotice) setFormNotice('');
    if (error) setError('');
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (loading) {
      return;
    }

    setError('');
    setFormNotice('');
    if (!validateStudentForm()) {
      return;
    }
    setLoading(true);

    try {
      const response = await registerUser({
        name: studentFormData.name.trim(),
        email: studentFormData.email.trim(),
        password: studentFormData.password,
      });

      const loggedInUser = await login({
        accessToken: response.data?.accessToken || response.data?.token,
      });
      if (loggedInUser?.role === 'ASSISTANT') {
        navigate('/assistant-dashboard');
      } else {
        navigate('/student-dashboard');
      }
    } catch (err) {
      setError(mapRegisterError(err, false));
    } finally {
      setLoading(false);
    }
  };

  const handleAssistantSubmit = async (e) => {
    e.preventDefault();
    if (loading) {
      return;
    }

    setError('');
    setFormNotice('');
    if (!validateAssistantForm()) {
      return;
    }
    setLoading(true);

    try {
      const response = await registerAssistant({
        name: assistantFormData.name.trim(),
        email: assistantFormData.email.trim(),
        password: assistantFormData.password,
        assistantCode: assistantFormData.assistantCode.trim().toUpperCase(),
      });

      const loggedInUser = await login({
        accessToken: response.data?.accessToken || response.data?.token,
      });
      if (loggedInUser?.role === 'TEACHER') {
        navigate('/teacher-dashboard');
      } else {
        navigate('/assistant-dashboard');
      }
    } catch (err) {
      setError(mapRegisterError(err, true));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-emerald-900 via-slate-800 to-slate-900 p-10 text-white">
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
                <h1 className="text-3xl font-bold">{t('auth.createAccount')}</h1>
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
                {t('auth.createAccount')}
              </h1>
            </div>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">
            {showAssistantForm
              ? t('auth.registerAssistant')
              : t('auth.registerStudent')}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {showAssistantForm
              ? t('auth.registerHelpAssistant')
              : t('auth.registerHelpStudent')}
          </p>

        {formNotice && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">{t('auth.validationTitle')}</p>
            <p className="mt-1">{formNotice}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-semibold">{t('auth.registrationIssue')}</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        <form
          onSubmit={showAssistantForm ? handleAssistantSubmit : handleStudentSubmit}
          className="mt-6 space-y-4"
          noValidate
        >
          <div>
            <label className="mb-2 block font-semibold text-slate-700">
              {t('common.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={activeFormData.name}
              onChange={showAssistantForm ? handleAssistantChange : handleStudentChange}
              autoComplete="name"
              className={getInputClassName(Boolean(fieldErrors.name))}
              placeholder="Your name"
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name && (
              <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block font-semibold text-slate-700">
              {t('common.email')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={activeFormData.email}
              onChange={showAssistantForm ? handleAssistantChange : handleStudentChange}
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
            <label className="mb-2 block font-semibold text-slate-700">
              {t('common.password')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={activeFormData.password}
                onChange={showAssistantForm ? handleAssistantChange : handleStudentChange}
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
            <label className="mb-2 block font-semibold text-slate-700">
              {t('auth.confirmPassword')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={activeFormData.confirmPassword}
                onChange={showAssistantForm ? handleAssistantChange : handleStudentChange}
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

          {showAssistantForm && (
            <div>
              <label className="mb-2 block font-semibold text-slate-700">
                {t('auth.assistantCode')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="assistantCode"
                value={assistantFormData.assistantCode}
                onChange={handleAssistantChange}
                maxLength={8}
                className={`${getInputClassName(Boolean(fieldErrors.assistantCode))} uppercase tracking-widest`}
                placeholder="8-character code"
                aria-invalid={Boolean(fieldErrors.assistantCode)}
              />
              {fieldErrors.assistantCode && (
                <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.assistantCode}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading
              ? 'Registering...'
              : showAssistantForm
              ? t('auth.registerAssistant')
              : t('auth.registerStudent')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setShowAssistantForm((prev) => !prev);
            setShowPassword(false);
            setShowConfirmPassword(false);
            setError('');
            setFormNotice('');
            setFieldErrors({});
          }}
          className="w-full mt-3 px-4 py-2 bg-white text-emerald-700 border border-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition"
        >
          {showAssistantForm ? t('auth.backToStudent') : t('auth.loginAsAssistant')}
        </button>

        <p className="text-center mt-6 text-slate-600">
          {t('auth.alreadyHave')}{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-emerald-700 font-semibold hover:underline"
          >
            {t('common.login')}
          </button>
        </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
