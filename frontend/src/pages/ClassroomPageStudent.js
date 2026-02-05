import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssignments } from '../services/api';

const ClassroomPageStudent = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/student-dashboard')}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Classroom</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.name}</span>
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
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Assignments</h2>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No assignments available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assignments.map((assignment) => (
              <div
                key={assignment._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {assignment.title}
                </h3>
                <p className="text-gray-600 mb-4">{assignment.description}</p>
                <div className="mb-4 text-sm text-gray-500">
                  <p>Points: {assignment.totalPoints}</p>
                </div>
                <button
                  onClick={() =>
                    navigate(`/submit-assignment/${assignment._id}`)
                  }
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
                >
                  📤 Submit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassroomPageStudent;
