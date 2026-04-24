import React, { useEffect, useState, useCallback } from 'react';
import {
  deleteSubmission,
  getAllSubmissions,
  getSubmissionPdf,
  resubmitSubmission,
} from '../../services/api';
import logo from '../../images/image.png';
import { useI18n } from '../../context/I18nContext';

const RefreshIcon = ({ className = 'h-4 w-4' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 0 1-15.1 6.6" />
    <path d="M3 12A9 9 0 0 1 18.1 5.4" />
    <path d="M21 5v6h-6" />
    <path d="M3 19v-6h6" />
  </svg>
);

const AdminSubmissions = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState('');
  const [resubmittingSubmissionId, setResubmittingSubmissionId] = useState('');
  const [pendingResubmit, setPendingResubmit] = useState(null);
  const { t } = useI18n();

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAllSubmissions();
      setSubmissions(response.data);
      setError('');
    } catch (err) {
      setError(t('errors.failedLoadSubmissions'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleViewPdf = async (submissionId) => {
    try {
      const response = await getSubmissionPdf(submissionId);
      const blobUrl = window.URL.createObjectURL(response.data);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
      setError('');
      setSuccess('');
    } catch (err) {
      setSuccess('');
      setError(err.response?.data?.message || 'Failed to open PDF');
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    const confirmed = window.confirm('Delete this submission?');
    if (!confirmed) return;

    try {
      setDeletingSubmissionId(submissionId);
      await deleteSubmission(submissionId);
      setSubmissions((prev) => prev.filter((item) => item._id !== submissionId));
      setSuccess('');
      setError('');
    } catch (err) {
      setSuccess('');
      setError(err.response?.data?.message || 'Failed to delete submission');
    } finally {
      setDeletingSubmissionId('');
    }
  };

  const handleConfirmResubmit = async () => {
    if (!pendingResubmit || resubmittingSubmissionId) return;

    try {
      setResubmittingSubmissionId(pendingResubmit._id);
      const response = await resubmitSubmission(pendingResubmit._id);
      const nextSubmission = response.data?.submission;
      if (nextSubmission) {
        setSubmissions((prev) =>
          prev.map((item) => (item._id === pendingResubmit._id ? nextSubmission : item))
        );
      } else {
        await fetchSubmissions();
      }
      setPendingResubmit(null);
      setError('');
      setSuccess('Submission resubmitted successfully.');
    } catch (err) {
      setSuccess('');
      setError(err.response?.data?.message || 'Failed to resubmit submission.');
    } finally {
      setResubmittingSubmissionId('');
    }
  };

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-200/40 blur-2xl" />
        <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Sa7a7ly logo"
                className="h-11 w-11 rounded-xl bg-white p-2 shadow"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                  Admin
                </p>
                <h2 className="text-3xl font-bold text-slate-900">
                  {t('admin.overviewSubmissions')}
                </h2>
              </div>
            </div>
            <p className="mt-3 text-slate-700">{t('admin.submissionsOverview')}</p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">
                {submissions.length}
              </p>
              <p className="text-sm text-slate-600">{t('common.total')}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">Track</p>
              <p className="text-sm text-slate-600">Grades</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-4">
          {t('common.submissions')}
        </h3>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
          {success}
        </div>
      )}
      {loading ? (
        <p className="text-slate-600">{t('common.loading')}</p>
      ) : submissions.length === 0 ? (
        <p className="text-slate-600">{t('common.noSubmissionsFound')}</p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div
              key={s._id}
              className="flex flex-col gap-4 rounded-xl border border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  Submission {s._id}
                </p>
                <p className="text-sm text-slate-600">
                  Student:{' '}
                  {typeof s.studentId === 'object' && s.studentId !== null
                    ? `${s.studentId.name || 'Unknown'} (${s.studentId.email || 'No email'})`
                    : s.studentId || 'N/A'}
                </p>
                <p className="text-sm text-slate-600">
                  Assignment:{' '}
                  {typeof s.assignmentId === 'object' && s.assignmentId !== null
                    ? s.assignmentId.title || 'N/A'
                    : s.assignmentId || 'N/A'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                  Grade: {s.grade ?? 'N/A'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {s.status || 'Submitted'}
                </span>
                {s.pdfPath && (
                  <button
                    type="button"
                    onClick={() => handleViewPdf(s._id)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {t('common.viewPdf')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPendingResubmit(s)}
                  disabled={Boolean(resubmittingSubmissionId || deletingSubmissionId)}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshIcon />
                  {resubmittingSubmissionId === s._id ? t('common.loading') : 'Resubmit'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSubmission(s._id)}
                  disabled={deletingSubmissionId === s._id || resubmittingSubmissionId === s._id}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingSubmissionId === s._id ? t('common.loading') : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      {pendingResubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <RefreshIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">Resubmit assignment</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Are you sure you want to resubmit this assignment as a new submission?
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingResubmit(null)}
                disabled={resubmittingSubmissionId === pendingResubmit._id}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResubmit}
                disabled={resubmittingSubmissionId === pendingResubmit._id}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshIcon />
                {resubmittingSubmissionId === pendingResubmit._id
                  ? t('common.loading')
                  : 'Resubmit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminSubmissions;
