import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssignments, createAssignment } from '../services/api';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import logo from '../images/image.png';

const ClassroomPageTeacher = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, [classroomId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await getAssignments(classroomId);
      setAssignments(response.data);
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

  // Note: In a real app, you'd fetch the classroom details separately
  const joinCode = 'ABC123'; // This would come from classroom data

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
              ← Back
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Sa7a7ly
              </p>
              <h1 className="text-2xl font-bold text-slate-900">Classroom</h1>
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
              Logout
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
                    Classroom tools
                  </p>
                  <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                    Manage assignments with clarity
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
              Join Code
            </p>
            <p className="mt-2 text-3xl font-mono font-bold text-emerald-700">
              {joinCode}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Share this code with students so they can join the classroom.
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => navigator.clipboard?.writeText(joinCode)}
            >
              Copy Join Code
            </button>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Assignments
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  Manage assignments
                </h2>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-semibold"
              >
                Create Assignment
              </button>
            </div>

        {loading ? (
          <div className="text-center py-10">
            <p className="text-slate-600">Loading assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-slate-600 mb-4">No assignments yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              Create your first assignment
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
