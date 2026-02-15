import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getResubmissionRequests,
  updateResubmissionRequest,
} from '../services/api';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

const ResubmissionRequestsPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { t } = useI18n();

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getResubmissionRequests(user._id);
      setRequests(response.data);
      setError('');
    } catch (err) {
      setError(t('errors.failedLoadRequests'));
    } finally {
      setLoading(false);
    }
  }, [user._id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleDecision = async (requestId, status) => {
    try {
      await updateResubmissionRequest(requestId, {
        status,
        decidedBy: user._id,
      });
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update request');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Sa7a7ly logo"
              className="h-11 w-11 rounded-xl bg-white p-2 shadow"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Resubmissions
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                {t('resubmissions.title')}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              {user?.name}
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

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-200/40 blur-2xl" />
          <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-sky-200/40 blur-2xl" />
          <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {t('resubmissions.review')}
            </p>
            <h2 className="text-3xl font-bold text-slate-900">
              {t('resubmissions.title')}
            </h2>
            <p className="mt-2 text-slate-600">
              {t('resubmissions.review')}
            </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-900">
                {requests.length}
              </p>
              <p className="text-sm text-slate-600">Total requests</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-slate-600">
            {t('common.loading')}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
            {t('resubmissions.noRequests')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {requests.map((request) => (
              <div
                key={request._id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t('common.users')}</p>
                    <p className="font-semibold text-slate-900">
                      {request.studentId?.name || 'Unknown'} (
                      {request.studentId?.email || 'No email'})
                    </p>
                    <p className="mt-2 text-sm text-slate-500">{t('common.assignments')}</p>
                    <p className="font-semibold text-slate-900">
                      {request.assignmentId?.title || 'Untitled'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        request.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : request.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {request.status}
                    </span>
                    {request.submissionId?.grade != null && (
                      <span className="text-sm text-slate-600">
                        Grade: {request.submissionId.grade}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{t('resubmissions.reason')}</p>
                  <p className="mt-1">{request.reason}</p>
                </div>
                {request.status === 'PENDING' && (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => handleDecision(request._id, 'APPROVED')}
                      className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      {t('resubmissions.approve')}
                    </button>
                    <button
                      onClick={() => handleDecision(request._id, 'DECLINED')}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      {t('resubmissions.decline')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResubmissionRequestsPage;
