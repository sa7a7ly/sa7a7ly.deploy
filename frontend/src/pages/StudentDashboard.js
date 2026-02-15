import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClassrooms, joinClassroom } from '../services/api';
import logo from '../images/image.png';

const StudentDashboard = () => {
  const [joinCode, setJoinCode] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningError, setJoiningError] = useState('');
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Sa7a7ly Student
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              Student Dashboard
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              Welcome, {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
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
                    Helping you stay on top of assignments
                  </h1>
                </div>
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-700">
                We are a web app that helps students and teachers make life
                easier. We simplify assignments so students can work smarter and
                achieve higher grades.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full bg-emerald-600 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  Student Success
                </span>
                <span className="rounded-full bg-sky-600 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  Clear Progress
                </span>
                <span className="rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  Easy Assignments
                </span>
              </div>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">1 hub</p>
                <p className="text-sm text-slate-600">All classrooms</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">Clear</p>
                <p className="text-sm text-slate-600">Assignment steps</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">Fast</p>
                <p className="text-sm text-slate-600">Join & submit</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">Track</p>
                <p className="text-sm text-slate-600">Your progress</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_2fr]">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Quick Join
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  Join a Classroom
                </h2>
              </div>
              <div className="hidden md:flex flex-col items-end text-xs text-slate-500">
                <span>Need a code?</span>
                <span>Ask your teacher</span>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Enter the class code to instantly access assignments and updates.
            </p>
            <form
              onSubmit={handleJoinClassroom}
              className="mt-5 flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter join code"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={joining || !joinCode}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:opacity-50"
              >
                {joining ? 'Joining...' : 'Join Classroom'}
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
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  My Learning
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  My Classrooms
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                {classrooms.length} classrooms
              </span>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-10">
                <p className="text-slate-600">Loading classrooms...</p>
              </div>
            ) : classrooms.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-slate-600">
                  No classrooms yet. Join one using a code to get started.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {classrooms.map((classroom) => (
                  <div
                    key={classroom._id}
                    className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <h3 className="text-lg font-bold text-slate-900">
                      {classroom.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Access assignments, submissions, and updates.
                    </p>
                    <button
                      onClick={() =>
                        navigate(`/classroom/${classroom._id}/student`)
                      }
                      className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800"
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
    </div>
  );
};

export default StudentDashboard;
