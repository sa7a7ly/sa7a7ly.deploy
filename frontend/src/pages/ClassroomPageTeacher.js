import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssignments, createAssignment, getClassrooms } from '../services/api';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

const ClassroomPageTeacher = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const subscriptionEnd = user?.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const subscriptionActive =
    user?.subscriptionStatus === 'ACTIVE' ||
    user?.subscriptionStatus === 'TRIAL';
  const subscriptionExpired =
    subscriptionActive && subscriptionEnd && new Date() > subscriptionEnd;
  const canManage = subscriptionActive && !subscriptionExpired;
  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeOffsetMs, setTimeOffsetMs] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchClassroom();
    fetchAssignments();
  }, [classroomId]);

  const fetchClassroom = async () => {
    try {
      const response = await getClassrooms();
      const currentClassroom = response.data.find((c) => c._id === classroomId);
      setClassroom(currentClassroom || null);
    } catch (err) {
      console.error('Failed to load classroom:', err);
      setClassroom(null);
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await getAssignments(classroomId);
      setAssignments(response.data);
      const serverTime = response.headers['x-server-time'];
      if (serverTime) {
        setTimeOffsetMs(Number(serverTime) - Date.now());
      }
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async (formData) => {
    try {
      await createAssignment(formData);
      setShowModal(false);
      fetchAssignments();
    } catch (err) {
      console.error('Failed to create assignment:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatDateTime = (value) => {
    if (!value) {
      return 'No deadline';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'No deadline' : date.toLocaleString();
  };

  const getTimeLeft = (value) => {
    if (!value) {
      return 'No deadline';
    }
    const due = new Date(value).getTime();
    if (Number.isNaN(due)) {
      return 'No deadline';
    }
    const diff = due - (Date.now() + timeOffsetMs);
    if (diff <= 0) {
      return 'Past due';
    }
    const minutes = Math.floor(diff / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    if (days > 0) {
      return `${days}d ${hours}h left`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m left`;
    }
    return `${mins}m left`;
  };

  const joinCode = classroom?.joinCode;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                navigate(
                  user?.role === 'ASSISTANT'
                    ? '/assistant-dashboard'
                    : '/teacher-dashboard'
                )
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← {t('common.back')}
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Sa7a7ly
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                {t('common.classroom')}
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
        {!canManage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-700">
            {subscriptionExpired
              ? t('subscription.expired')
              : t('subscription.inactive')}
          </div>
        )}
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
                    Classroom tools
                  </p>
                  <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                    {t('classroom.manageAssignments')}
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-700">
                Create assignments, share the join code, and keep students on
                track.
              </p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">
                  {assignments.length}
                </p>
                <p className="text-sm text-slate-600">Assignments</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">Share</p>
                <p className="text-sm text-slate-600">Join code</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">Quick</p>
                <p className="text-sm text-slate-600">Create tasks</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">Track</p>
                <p className="text-sm text-slate-600">Progress</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t('classroom.joinCode')}
            </p>
            <p className="mt-2 text-3xl font-mono font-bold text-emerald-700">
              {joinCode}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {t('classroom.shareCode')}
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => navigator.clipboard?.writeText(joinCode)}
            >
              {t('classroom.joinCode')}
            </button>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Assignments
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {t('classroom.manageAssignments')}
                </h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/submissions`)}
                  className="px-5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-semibold"
                >
                  {t('common.submissions')}
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-semibold"
                  disabled={!canManage}
                >
                  {t('classroom.createAssignment')}
                </button>
              </div>
            </div>

        {loading ? (
          <div className="text-center py-10">
            <p className="text-slate-600">{t('common.loading')}</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-slate-600 mb-4">{t('classroom.noAssignmentsTeacher')}</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              {t('classroom.createFirstAssignment')}
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {assignments.map((assignment) => (
              <div
                key={assignment._id}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold text-slate-900">
                    {assignment.title}
                  </h3>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {assignment.totalPoints} pts
                  </span>
                </div>
                <p className="mt-2 text-slate-600">{assignment.description}</p>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <p>{t('common.due')}: {formatDateTime(assignment.dueDate)}</p>
                  <p>{t('common.timeLeft')}: {getTimeLeft(assignment.dueDate)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
          </section>
        </div>
      </div>

      {showModal && (
        <CreateAssignmentModal
          classroomId={classroomId}
          userId={user._id}
          onClose={() => setShowModal(false)}
          onCreate={handleCreateAssignment}
        />
      )}
    </div>
  );
};

export default ClassroomPageTeacher;
