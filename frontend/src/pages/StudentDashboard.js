import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssignments, getClassrooms, getStudentSubmissions, joinClassroom } from '../services/api';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

const StudentDashboard = () => {
  const [joinCode, setJoinCode] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningError, setJoiningError] = useState('');
  const [joining, setJoining] = useState(false);
  const [assignmentsByClassroom, setAssignmentsByClassroom] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      const response = await getClassrooms();
      const studentClassrooms = response.data.filter((c) =>
        c.studentIds?.includes(user._id)
      );
      setClassrooms(studentClassrooms);
      const assignmentsResults = await Promise.all(
        studentClassrooms.map((c) =>
          getAssignments(c._id)
            .then((res) => ({ classroomId: c._id, data: res.data || [] }))
            .catch(() => ({ classroomId: c._id, data: [] }))
        )
      );
      const assignmentsMap = {};
      assignmentsResults.forEach((item) => {
        assignmentsMap[item.classroomId] = item.data;
      });
      setAssignmentsByClassroom(assignmentsMap);
      try {
        const submissionsRes = await getStudentSubmissions(user._id);
        setSubmissions(submissionsRes.data || []);
      } catch (err) {
        setSubmissions([]);
      }
      setError('');
    } catch (err) {
      setError('Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClassroom = async (e) => {
    e.preventDefault();
    setJoiningError('');
    setJoining(true);

    try {
      await joinClassroom({
        joinCode,
        studentId: user._id,
      });
      setJoinCode('');
      fetchClassrooms();
    } catch (err) {
      setJoiningError(
        err.response?.data?.message || 'Failed to join classroom'
      );
    } finally {
      setJoining(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const submittedAssignmentIds = new Set(
    submissions.map((s) => s.assignmentId?._id || s.assignmentId)
  );

  const allAssignments = Object.entries(assignmentsByClassroom).flatMap(
    ([classroomId, list]) =>
      list.map((a) => ({
        ...a,
        classroomId,
      }))
  );

  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcomingAssignments = allAssignments
    .filter((a) => a.dueDate)
    .map((a) => ({
      ...a,
      due: new Date(a.dueDate),
    }))
    .filter((a) => a.due >= now && a.due <= sevenDaysLater)
    .sort((a, b) => a.due - b.due)
    .slice(0, 5);

  const pendingAssignments = allAssignments.filter((a) => {
    if (!a.dueDate) return !submittedAssignmentIds.has(a._id);
    return new Date(a.dueDate) >= now && !submittedAssignmentIds.has(a._id);
  });

  const recentFeedback = submissions
    .filter((s) => s.feedback)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 3);

  const filteredClassrooms = classrooms.filter((c) => {
    const matchesSearch = c.name
      ?.toLowerCase()
      .includes(search.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'ALL') return true;
    const classroomAssignments = assignmentsByClassroom[c._id] || [];
    if (filter === 'ACTIVE') {
      return classroomAssignments.some(
        (a) => !a.dueDate || new Date(a.dueDate) >= now
      );
    }
    return classroomAssignments.length > 0
      ? classroomAssignments.every((a) => a.dueDate && new Date(a.dueDate) < now)
      : true;
  });

  const averageGrade =
    submissions.length > 0
      ? Math.round(
          submissions.reduce((sum, s) => sum + (s.grade || 0), 0) /
            submissions.length
        )
      : null;
  const latestGrade =
    submissions.length > 0
      ? submissions
          .slice()
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0]
          ?.grade ?? null
      : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Sa7a7ly logo"
              className="h-10 w-10 rounded-xl bg-white p-2 shadow"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Sa7a7ly
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                {t('dashboards.student')}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/student-progress')}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              {t('progress.title')}
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('join-classroom');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              {t('classroom.joinAClassroom')}
            </button>
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
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Today
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Upcoming due dates
            </h2>
            {upcomingAssignments.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No deadlines in the next 7 days.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {upcomingAssignments.map((assignment) => {
                  const classroom =
                    classrooms.find((c) => c._id === assignment.classroomId) ||
                    {};
                  return (
                    <div
                      key={assignment._id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {assignment.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {classroom.name || t('common.classroom')}
                      </p>
                      <p className="mt-1 text-xs text-emerald-700">
                        Due {assignment.due.toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Pending
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Assignments to submit
            </h2>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-3xl font-bold text-slate-900">
                {pendingAssignments.length}
              </p>
              <p className="text-sm text-slate-600">
                {pendingAssignments.length === 1
                  ? 'Assignment'
                  : 'Assignments'}{' '}
                pending
              </p>
            </div>
            {pendingAssignments.length > 0 && (
              <div className="mt-4 space-y-2">
                {pendingAssignments.slice(0, 3).map((assignment) => (
                  <button
                    key={assignment._id}
                    type="button"
                    onClick={() =>
                      navigate(`/submit-assignment/${assignment._id}`)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {assignment.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Progress
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Your performance
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-2xl font-bold text-slate-900">
                  {averageGrade ?? '--'}
                </p>
                <p className="text-xs text-slate-600">Average</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-2xl font-bold text-slate-900">
                  {latestGrade ?? '--'}
                </p>
                <p className="text-xs text-slate-600">Latest</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/student-progress')}
              className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              {t('progress.title')}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_2fr]">
          <section
            id="join-classroom"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Quick Join
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {t('classroom.joinAClassroom')}
                </h2>
              </div>
              <div className="hidden md:flex flex-col items-end text-xs text-slate-500">
                <span>Need a code?</span>
                <span>Ask your teacher</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Enter the class code to access assignments and feedback.
            </p>
            <form
              onSubmit={handleJoinClassroom}
              className="mt-5 flex flex-col gap-3"
            >
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter join code"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={joining || !joinCode}
                className="w-full px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:opacity-50"
              >
                {joining ? t('common.loading') : t('classroom.joinAClassroom')}
              </button>
            </form>
            {joiningError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {joiningError}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  My Classes
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {t('common.classrooms')}
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                {filteredClassrooms.length} {t('common.classrooms')}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                {['ALL', 'ACTIVE', 'ARCHIVED'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFilter(option)}
                    className={`rounded-full px-4 py-1 text-xs font-semibold ${
                      filter === option
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {option === 'ALL' && 'All'}
                    {option === 'ACTIVE' && 'Active'}
                    {option === 'ARCHIVED' && 'Archived'}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search classes"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-10">
                <p className="text-slate-600">{t('common.loading')}</p>
              </div>
            ) : filteredClassrooms.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-slate-600">
                  {t('common.noClassroomsFound')}
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredClassrooms.map((classroom) => {
                  const classroomAssignments =
                    assignmentsByClassroom[classroom._id] || [];
                  const pendingForClass = classroomAssignments.filter(
                    (a) => !submittedAssignmentIds.has(a._id)
                  );
                  const firstPending = pendingForClass[0];
                  const teacherName = classroom.teacherId?.name || 'Teacher';
                  return (
                  <div
                    key={classroom._id}
                    className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-bold text-slate-900">
                        {classroom.name}
                      </h3>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                        Active
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Assignments, submissions, and updates.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>{teacherName}</span>
                      <span>
                        {classroomAssignments.length} {t('common.assignments')}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        navigate(`/classroom/${classroom._id}/student`)
                      }
                      className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800"
                    >
                      {t('classroom.viewClassroom')}
                    </button>
                    {firstPending && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/submit-assignment/${firstPending._id}`)
                        }
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Submit assignment
                      </button>
                    )}
                  </div>
                );
                })}
              </div>
            )}
          </section>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Feedback
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Recent feedback
            </h2>
            {recentFeedback.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Submit assignments to receive feedback.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {recentFeedback.map((submission) => (
                  <div
                    key={submission._id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {submission.assignmentId?.title || 'Assignment'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Grade: {submission.grade ?? 'N/A'}
                    </p>
                    <p className="mt-2 text-xs text-slate-600 line-clamp-3">
                      {submission.feedback}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Help
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              How it works
            </h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                1. Join your classroom with the code from your teacher.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                2. Submit your assignment PDF before the deadline.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                3. Review AI feedback and improve your next submission.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StudentDashboard;
