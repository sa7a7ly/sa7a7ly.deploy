import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getClassrooms,
  createClassroom,
  getTeacherAssistants,
  getTeacherAssistantCode,
} from '../services/api';
import CreateClassroomModal from '../components/CreateClassroomModal';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

const TeacherDashboard = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [assistantCode, setAssistantCode] = useState('');
  const [loadingAssistantCode, setLoadingAssistantCode] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const fetchClassrooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getClassrooms();
      const teacherClassrooms = response.data.filter(
        (c) => c.teacherId.toString() === user._id
      );

      setClassrooms(teacherClassrooms);
      setError('');
    } catch (err) {
      setError(t('errors.failedLoadClassrooms'));
    } finally {
      setLoading(false);
    }
  }, [user._id, t]);

  const fetchAssistants = useCallback(async () => {
    try {
      const response = await getTeacherAssistants(user._id);
      setAssistants(response.data);
    } catch (err) {
      console.error('Failed to load assistants:', err);
    }
  }, [user._id]);

  useEffect(() => {
    fetchClassrooms();
    fetchAssistants();
  }, [fetchClassrooms, fetchAssistants]);

  const handleCreateClassroom = async (classroomData) => {
    try {
      await createClassroom({
        name: classroomData.name,
        teacherId: user._id,
      });
      setShowModal(false);
      fetchClassrooms();
    } catch (err) {
      console.error('Failed to create classroom:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleViewAssistantCode = async () => {
    try {
      setLoadingAssistantCode(true);
      const response = await getTeacherAssistantCode(user._id);
      setAssistantCode(response.data?.assistantCode || '');
    } catch (err) {
      setError('Failed to load teacher assistant code');
    } finally {
      setLoadingAssistantCode(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Sa7a7ly Teacher
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              {t('dashboards.teacher')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              {t('dashboards.welcome')}, {user?.name}
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
                    Teaching hub
                  </p>
                  <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                    Keep classrooms organized and moving
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-700">
                Create classrooms, share join codes, and collaborate with
                assistants in one workspace.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full bg-emerald-600 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  Quick Setup
                </span>
                <span className="rounded-full bg-sky-600 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  Assistant Support
                </span>
                <span className="rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  Clear Progress
                </span>
              </div>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">
                  {classrooms.length}
                </p>
                <p className="text-sm text-slate-600">Classrooms</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">
                  {assistants.length}
                </p>
                <p className="text-sm text-slate-600">Assistants</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">Fast</p>
                <p className="text-sm text-slate-600">Create classes</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">Share</p>
                <p className="text-sm text-slate-600">Join codes</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_2fr]">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Assistants
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {t('common.assistants')}
                </h2>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Share your assistant code to invite help with grading and feedback.
            </p>
            <div className="mt-4">
              <button
                onClick={handleViewAssistantCode}
                disabled={loadingAssistantCode}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {loadingAssistantCode ? t('common.loading') : t('auth.assistantCode')}
              </button>
            </div>
            {assistantCode && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                Teacher Assistant Code:{' '}
                <span className="font-mono font-bold">{assistantCode}</span>
              </div>
            )}
            {assistants.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-600">
                {t('common.noUsersFound')}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {assistants.map((assistant) => (
                  <div
                    key={assistant._id}
                    className="border border-slate-200 rounded-lg px-4 py-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {assistant.name}
                      </p>
                      <p className="text-sm text-slate-600">
                        {assistant.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  My Classes
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {t('common.classrooms')}
                </h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => navigate('/resubmission-requests')}
                  className="px-5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-semibold"
                >
                  {t('resubmissions.title')}
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-semibold"
                >
                  {t('createClassroom.title')}
                </button>
              </div>
            </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">
            <p className="text-slate-600">{t('common.loading')}</p>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-slate-600 mb-4">{t('common.noClassroomsFound')}</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              {t('createClassroom.title')}
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((classroom) => (
              <div
                key={classroom._id}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {classroom.name}
                </h3>
                <div className="mb-4">
                  <p className="text-sm text-slate-600 mb-1">Join Code</p>
                  <p className="text-lg font-mono font-bold text-emerald-700 bg-emerald-50 p-2 rounded">
                    {classroom.joinCode}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/classroom/${classroom._id}`)}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  View Classroom
                </button>
              </div>
            ))}
          </div>
        )}
          </section>
        </div>
      </div>

      {showModal && (
        <CreateClassroomModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreateClassroom}
        />
      )}
    </div>
  );
};

export default TeacherDashboard;
