import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClassrooms, joinClassroom } from '../services/api';

const AssistantDashboard = () => {
  const [joinCode, setJoinCode] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningError, setJoiningError] = useState('');
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const fetchClassrooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getClassrooms();
      const assistantClassrooms = response.data.filter((c) =>
        c.assistantIds?.includes(user._id)
      );
      setClassrooms(assistantClassrooms);
      setError('');
    } catch (err) {
      setError('Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  }, [user._id]);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  const handleJoinClassroom = async (e) => {
    e.preventDefault();
    setJoiningError('');
    setJoining(true);

    try {
      await joinClassroom({
        joinCode,
        userId: user._id,
      });
      setJoinCode('');
      fetchClassrooms();
    } catch (err) {
      setJoiningError(err.response?.data?.message || 'Failed to join classroom');
    } finally {
      setJoining(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Assistant Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Welcome, {user?.name}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Join a Classroom
          </h2>
          <form onSubmit={handleJoinClassroom} className="flex gap-4">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter classroom code"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={joining || !joinCode}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold disabled:opacity-50"
            >
              {joining ? 'Joining...' : 'Join'}
            </button>
          </form>
          {joiningError && (
            <p className="text-red-600 mt-2 text-sm">{joiningError}</p>
          )}
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-8">My Classrooms</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading classrooms...</p>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">
              No classrooms yet. Join one using a code shared by a teacher.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((classroom) => (
              <div
                key={classroom._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {classroom.name}
                </h3>
                <button
                  onClick={() => navigate(`/classroom/${classroom._id}`)}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Manage Assignments
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistantDashboard;
