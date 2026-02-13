import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAssignments, createAssignment } from '../services/api';
import CreateAssignmentModal from '../components/CreateAssignmentModal';

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                navigate(user?.role === 'ASSISTANT' ? '/assistant-dashboard' : '/teacher-dashboard')
              }
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
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Join Code:</p>
            <p className="text-3xl font-mono font-bold text-indigo-600">
              {joinCode}
            </p>
          </div>
          <p className="text-gray-600">
            Share this code with your students to let them join the classroom.
          </p>
        </div>

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Assignments</h2>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
          >
            ➕ Create Assignment
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No assignments yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Create your first assignment
            </button>
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
                <div className="text-sm text-gray-500">
                  <p>Points: {assignment.totalPoints}</p>
                </div>
              </div>
            ))}
          </div>
        )}
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
