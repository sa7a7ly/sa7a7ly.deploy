import React, { useEffect, useState, useCallback } from 'react';
import { getUsers } from '../../services/api';
import logo from '../../images/image.png';
import { useI18n } from '../../context/I18nContext';

const AdminUsers = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const { t } = useI18n();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getUsers();
      setUsers(response.data);
      setError('');
    } catch (err) {
      setError(t('errors.failedLoadUsers'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <section className="space-y-6">
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
                  Sa7a7ly
                </p>
                <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
                  {t('admin.panel')}
                </h1>
              </div>
            </div>
            <p className="mt-4 text-base leading-relaxed text-slate-700">
              {t('landing.subhead')}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
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
          <div className="grid w-full max-w-sm grid-cols-2 gap-4 text-center">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">{users.length}</p>
              <p className="text-sm text-slate-600">{t('common.users')}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">1</p>
              <p className="text-sm text-slate-600">{t('common.total')}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">Clear</p>
              <p className="text-sm text-slate-600">{t('landing.support')}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">Easy</p>
              <p className="text-sm text-slate-600">{t('landing.organize')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {t('common.users')}
        </h2>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {loading ? (
          <p className="text-gray-600">{t('common.loading')}</p>
        ) : users.length === 0 ? (
          <p className="text-gray-600">{t('common.noUsersFound')}</p>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u._id}
                className="border border-gray-200 rounded-lg px-4 py-3 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-gray-900">{u.name}</p>
                  <p className="text-sm text-gray-600">{u.email}</p>
                </div>
                <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminUsers;
