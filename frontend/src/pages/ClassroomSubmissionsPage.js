import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getClassroom,
  getSubmissions,
  getSubmissionPdf,
  markSubmissionsReviewed,
  updateSubmission,
} from '../services/api';
import { useI18n } from '../context/I18nContext';
import logo from '../images/image.png';

const ClassroomSubmissionsPage = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classroom, setClassroom] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [openFeedback, setOpenFeedback] = useState({});
  const [editingFeedback, setEditingFeedback] = useState({});
  const [editingGrade, setEditingGrade] = useState({});
  const [savingSubmissionId, setSavingSubmissionId] = useState(null);
  const [publishingAll, setPublishingAll] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [classroomRes, submissionsRes] =
        await Promise.all([
          getClassroom(classroomId),
          getSubmissions(undefined, classroomId),
        ]);

      setClassroom(classroomRes.data);
      setSubmissions(submissionsRes.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || t('errors.failedLoadSubmissions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (classroomId) {
      fetchData();
    }
  }, [classroomId]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };


  const groupedSubmissions = useMemo(() => {
    const grouped = {};
    submissions.forEach((s) => {
      const assignmentTitle = s.assignmentId?.title || 'Assignment';
      if (!grouped[assignmentTitle]) grouped[assignmentTitle] = [];
      grouped[assignmentTitle].push(s);
    });
    return grouped;
  }, [submissions]);

  const studentProgress = useMemo(() => {
    const grouped = {};
    submissions.forEach((s) => {
      const name = s.studentId?.name || s.studentName || 'Student';
      const key = s.studentId?._id || `${name}-${s._id}`;
      if (!grouped[key]) {
        grouped[key] = {
          name,
          grades: [],
        };
      }
      if (typeof s.grade === 'number') {
        grouped[key].grades.push({
          value: s.grade,
          submittedAt: s.submittedAt,
        });
      }
    });

    return Object.values(grouped)
      .map((student) => {
        const sorted = student.grades.sort(
          (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)
        );
        const grades = sorted.map((g) => g.value);
        const average =
          grades.length > 0
            ? Math.round(grades.reduce((sum, v) => sum + v, 0) / grades.length)
            : null;
        const latest = grades.length > 0 ? grades[grades.length - 1] : null;
        return {
          name: student.name,
          grades,
          average,
          latest,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [submissions]);

  const buildSparkline = (grades) => {
    if (!grades || grades.length === 0) return '';
    const max = Math.max(...grades, 1);
    const min = Math.min(...grades, 0);
    const span = Math.max(max - min, 1);
    const points = grades.map((g, index) => {
      const x = (index / Math.max(grades.length - 1, 1)) * 100;
      const y = 24 - ((g - min) / span) * 24;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  };

  const toggleFeedback = (id) => {
    setOpenFeedback((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleFeedbackChange = (id, value) => {
    setEditingFeedback((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleGradeChange = (id, value) => {
    setEditingGrade((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSaveReview = async (submission) => {
    const nextFeedback = Object.prototype.hasOwnProperty.call(editingFeedback, submission._id)
      ? editingFeedback[submission._id]
      : submission.feedback || '';
    const nextGradeRaw = Object.prototype.hasOwnProperty.call(editingGrade, submission._id)
      ? editingGrade[submission._id]
      : submission.grade;

    const payload = { feedback: nextFeedback };
    if (nextGradeRaw !== '' && nextGradeRaw != null) {
      payload.grade = Number(nextGradeRaw);
    }

    try {
      setSavingSubmissionId(submission._id);
      const response = await updateSubmission(submission._id, payload);
      const updatedSubmission = response.data;
      setSubmissions((prev) =>
        prev.map((item) =>
          item._id === submission._id ? { ...item, ...updatedSubmission } : item
        )
      );
      setEditingFeedback((prev) => {
        const next = { ...prev };
        delete next[submission._id];
        return next;
      });
      setEditingGrade((prev) => {
        const next = { ...prev };
        delete next[submission._id];
        return next;
      });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || t('errors.failedSubmitAssignment'));
    } finally {
      setSavingSubmissionId(null);
    }
  };

  const handlePublishAllReviewed = async () => {
    try {
      setPublishingAll(true);
      await markSubmissionsReviewed({ classroomId });
      await fetchData();
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish reviewed submissions');
    } finally {
      setPublishingAll(false);
    }
  };

  const handleViewPdf = async (submissionId) => {
    try {
      const response = await getSubmissionPdf(submissionId);
      const blobUrl = window.URL.createObjectURL(response.data);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to open PDF');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← {t('common.back')}
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Sa7a7ly
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                {t('common.submissions')}
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

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
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
                    {classroom?.name || t('common.classroom')}
                  </p>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {t('common.submissions')}
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-slate-700">
                {t('resubmissions.review')}
              </p>
              <button
                type="button"
                onClick={handlePublishAllReviewed}
                disabled={publishingAll || submissions.length === 0}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {publishingAll ? t('common.loading') : 'Publish all as reviewed'}
              </button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-900">
                {submissions.length}
              </p>
              <p className="text-sm text-slate-600">{t('common.submissions')}</p>
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
        ) : submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
            {t('common.noSubmissionsFound')}
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Progress
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Student feedback trend
                  </h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                  {studentProgress.length} students
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {studentProgress.map((student) => (
                  <div
                    key={student.name}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        {student.name}
                      </p>
                      <span className="text-xs font-semibold text-emerald-700">
                        Avg: {student.average ?? 'N/A'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        Latest: {student.latest ?? 'N/A'}
                      </p>
                      <svg viewBox="0 0 100 24" className="h-6 w-28">
                        <path
                          d={buildSparkline(student.grades)}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {Object.keys(groupedSubmissions).map((title) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                <div className="mt-4 space-y-3">
                  {groupedSubmissions[title].map((submission) => (
                    <div
                      key={submission._id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {submission.studentId?.name || submission.studentName || 'Student'}
                          </p>
                          <p className="text-xs text-slate-600">
                            {new Date(submission.submittedAt).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                          {t('submit.grade')}: {submission.grade ?? 'N/A'}
                        </span>
                        <span
                          className={`text-xs font-semibold px-3 py-1 rounded-full ${
                            submission.reviewedByStaffAt
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {submission.reviewedByStaffAt ? 'Reviewed' : 'Pending review'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFeedback(submission._id)}
                        className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {openFeedback[submission._id]
                          ? t('common.close')
                          : t('submit.feedback')}
                      </button>
                      {submission.pdfPath && (
                        <button
                          type="button"
                          onClick={() => handleViewPdf(submission._id)}
                          className="mt-3 ml-2 inline-flex rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          {t('common.viewPdf')}
                        </button>
                      )}
                      {openFeedback[submission._id] && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {t('submit.grade')}
                            </p>
                            <input
                              type="number"
                              value={
                                Object.prototype.hasOwnProperty.call(editingGrade, submission._id)
                                  ? editingGrade[submission._id]
                                  : submission.grade ?? ''
                              }
                              onChange={(e) =>
                                handleGradeChange(submission._id, e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>

                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {t('submit.feedback')}
                            </p>
                            <textarea
                              rows={8}
                              value={
                                Object.prototype.hasOwnProperty.call(editingFeedback, submission._id)
                                  ? editingFeedback[submission._id]
                                  : submission.feedback || ''
                              }
                              onChange={(e) =>
                                handleFeedbackChange(submission._id, e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>

                          <button
                            type="button"
                            disabled={savingSubmissionId === submission._id}
                            onClick={() => handleSaveReview(submission)}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {savingSubmissionId === submission._id
                              ? t('common.loading')
                              : t('common.update')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassroomSubmissionsPage;
