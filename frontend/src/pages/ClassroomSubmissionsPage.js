import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAssignments,
  getClassroom,
  getClassroomStudents,
  getSubmissions,
  submitAssignmentOnBehalf,
} from '../services/api';
import { useI18n } from '../context/I18nContext';
import logo from '../images/image.png';

const ClassroomSubmissionsPage = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [formData, setFormData] = useState({
    assignmentId: '',
    studentId: '',
    pdf: null,
  });
  const [openFeedback, setOpenFeedback] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
        const [classroomRes, assignmentsRes, studentsRes, submissionsRes] =
          await Promise.all([
            getClassroom(classroomId),
            getAssignments(classroomId),
            getClassroomStudents(classroomId),
            getSubmissions(undefined, classroomId),
          ]);

      setClassroom(classroomRes.data);
      setAssignments(assignmentsRes.data || []);
      setStudents(studentsRes.data || []);
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

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFormData((prev) => ({
      ...prev,
      pdf: file || null,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.assignmentId || !formData.studentId || !formData.pdf) {
      setError(t('common.uploadPdf'));
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const payload = new FormData();
      payload.append('assignmentId', formData.assignmentId);
      payload.append('studentId', formData.studentId);
      payload.append('submittedBy', user._id);
      payload.append('pdf', formData.pdf);
      await submitAssignmentOnBehalf(payload);
      setFormData({ assignmentId: '', studentId: '', pdf: null });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || t('errors.failedSubmitAssignment'));
    } finally {
      setSubmitting(false);
    }
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

  const toggleFeedback = (id) => {
    setOpenFeedback((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-900">
                {submissions.length}
              </p>
              <p className="text-sm text-slate-600">{t('common.submissions')}</p>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xl font-bold text-slate-900">
            {t('common.gradeOnBehalf')}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {t('common.uploadPdf')}
          </p>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-4">
            <select
              value={formData.studentId}
              onChange={(e) => handleChange('studentId', e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">{t('common.selectStudent')}</option>
              {students.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.name}
                </option>
              ))}
            </select>
            <select
              value={formData.assignmentId}
              onChange={(e) => handleChange('assignmentId', e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">{t('common.selectAssignment')}</option>
              {assignments.map((assignment) => (
                <option key={assignment._id} value={assignment._id}>
                  {assignment.title}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? t('common.loading') : t('classroom.submitAssignment')}
            </button>
          </form>
        </section>

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
                            {submission.studentId?.name || 'Student'}
                          </p>
                          <p className="text-xs text-slate-600">
                            {new Date(submission.submittedAt).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                          {t('submit.grade')}: {submission.grade ?? 'N/A'}
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
                      {openFeedback[submission._id] && (
                        <div className="mt-3 text-sm text-slate-700 whitespace-pre-line">
                          {submission.feedback}
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
