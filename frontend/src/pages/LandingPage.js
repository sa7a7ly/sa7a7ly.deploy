import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  React.useEffect(() => {
    if (user) {
      if (user.role === 'TEACHER') {
        navigate('/teacher-dashboard');
      } else {
        navigate('/student-dashboard');
      }
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">AI Classroom</h1>
        <p className="text-xl text-gray-600 mb-12">
          Intelligent assignment grading and feedback system
        </p>
        <div className="flex gap-6 justify-center">
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Login
          </button>
          <button
            onClick={() => navigate('/register')}
            className="px-8 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
