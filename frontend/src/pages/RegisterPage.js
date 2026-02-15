import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerUser, registerAssistant } from '../services/api';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

const RegisterPage = () => {
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [assistantFormData, setAssistantFormData] = useState({
    name: '',
    email: '',
    password: '',
    assistantCode: '',
  });

  const [showAssistantForm, setShowAssistantForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useI18n();

  const handleStudentChange = (e) => {
    const { name, value } = e.target;
    setStudentFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAssistantChange = (e) => {
    const { name, value } = e.target;
    setAssistantFormData((prev) => ({
      ...prev,
      [name]: name === 'assistantCode' ? value.toUpperCase() : value,
    }));
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await registerUser({
        name: studentFormData.name,
        email: studentFormData.email,
        password: studentFormData.password,
      });

      login(response.data);
      navigate('/student-dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAssistantSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await registerAssistant({
        name: assistantFormData.name,
        email: assistantFormData.email,
        password: assistantFormData.password,
        assistantCode: assistantFormData.assistantCode,
      });

      login(response.data);
      navigate('/assistant-dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Assistant registration failed');
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

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form
          onSubmit={showAssistantForm ? handleAssistantSubmit : handleStudentSubmit}
          className="mt-6 space-y-4"
        >
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('common.name')}
            </label>
            <input
              type="text"
              name="name"
              value={showAssistantForm ? assistantFormData.name : studentFormData.name}
              onChange={showAssistantForm ? handleAssistantChange : handleStudentChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('common.email')}
            </label>
            <input
              type="email"
              name="email"
              value={showAssistantForm ? assistantFormData.email : studentFormData.email}
              onChange={showAssistantForm ? handleAssistantChange : handleStudentChange}
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
              name="password"
              value={showAssistantForm ? assistantFormData.password : studentFormData.password}
              onChange={showAssistantForm ? handleAssistantChange : handleStudentChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>

          {showAssistantForm && (
            <div>
              <label className="block text-slate-700 font-semibold mb-2">
                {t('auth.assistantCode')}
              </label>
              <input
                type="text"
                name="assistantCode"
                value={assistantFormData.assistantCode}
                onChange={handleAssistantChange}
                required
                maxLength={8}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="8-character code"
              />
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
            setError('');
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
