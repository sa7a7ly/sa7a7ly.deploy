import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAssignments,
  getClassroom,
  submitAssignmentOnBehalf,
} from '../services/api';
import { useI18n } from '../context/I18nContext';
import logo from '../images/image.png';

const GradeOnBehalfPage = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [studentName, setStudentName] = useState('');
  const [formData, setFormData] = useState({
    assignmentId: '',
    pdf: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [classroomRes, assignmentsRes] = await Promise.all([
          getClassroom(classroomId),
          getAssignments(classroomId),
        ]);
        setClassroom(classroomRes.data);
        setAssignments(assignmentsRes.data || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || t('errors.failedLoadSubmissions'));
      } finally {
        setLoading(false);
      }
    };
    if (classroomId) {
      load();
    }
  }, [classroomId, t]);

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
    if (!studentName.trim()) {
      setError(t('common.selectStudent'));
      return;
    }
    if (!formData.assignmentId || !formData.pdf) {
      setError(t('common.uploadPdf'));
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const payload = new FormData();
      payload.append('assignmentId', formData.assignmentId);
      payload.append('studentName', studentName.trim());
      payload.append('submittedBy', user._id);
      payload.append('pdf', formData.pdf);
      await submitAssignmentOnBehalf(payload);
      setFormData({ assignmentId: '', pdf: null });
      setStudentName('');
    } catch (err) {
      setError(err.response?.data?.message || t('errors.failedSubmitAssignment'));
    } finally {
      setSubmitting(false);
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
                {t('common.gradeOnBehalf')}
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

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-200/40 blur-2xl" />
          <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-sky-200/40 blur-2xl" />
          <div className="relative flex items-center gap-4">
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
                {t('common.gradeOnBehalf')}
              </h2>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="mt-1 text-sm text-slate-600">
            {t('common.uploadPdf')}
          </p>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-4">
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder={t('common.selectStudent')}
            />
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

        {loading && (
          <div className="text-center py-8 text-slate-600">
            {t('common.loading')}
          </div>
        )}
      </div>
    </div>
  );
};

export default GradeOnBehalfPage;
