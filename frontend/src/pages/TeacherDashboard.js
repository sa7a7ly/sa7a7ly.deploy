import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClassrooms, createClassroom, getTeacherAssistants } from '../services/api';
import CreateClassroomModal from '../components/CreateClassroomModal';

const TeacherDashboard = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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
      setError('Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  }, [user._id]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Linked Assistants</h2>
          {assistants.length === 0 ? (
            <p className="text-gray-600">No assistants linked yet.</p>
          ) : (
            <div className="space-y-3">
              {assistants.map((assistant) => (
                <div
                  key={assistant._id}
                  className="border border-gray-200 rounded-lg px-4 py-3 flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{assistant.name}</p>
                    <p className="text-sm text-gray-600">{assistant.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">My Classrooms</h2>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
          >
            ➕ Create Classroom
          </button>
        </div>

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
            <p className="text-gray-600 mb-4">No classrooms yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Create your first classroom
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((classroom) => (
              <div
                key={classroom._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {classroom.name}
                </h3>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Join Code:</p>
                  <p className="text-lg font-mono font-bold text-indigo-600 bg-indigo-50 p-2 rounded">
                    {classroom.joinCode}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/classroom/${classroom._id}`)}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        )}
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
