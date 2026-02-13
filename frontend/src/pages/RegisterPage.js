import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerUser, registerAssistant } from '../services/api';

const RegisterPage = () => {
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [assistantFormData, setAssistantFormData] = useState({
    name: '',
    email: '',
    password: '',
    assistantCode: '',
  });

  const [showAssistantForm, setShowAssistantForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleStudentChange = (e) => {
    const { name, value } = e.target;
    setStudentFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAssistantChange = (e) => {
    const { name, value } = e.target;
    setAssistantFormData((prev) => ({
      ...prev,
      [name]: name === 'assistantCode' ? value.toUpperCase() : value,
    }));
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await registerUser({
        name: studentFormData.name,
        email: studentFormData.email,
        password: studentFormData.password,
      });

      login(response.data);
      navigate('/student-dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAssistantSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await registerAssistant({
        name: assistantFormData.name,
        email: assistantFormData.email,
        password: assistantFormData.password,
        assistantCode: assistantFormData.assistantCode,
      });

      login(response.data);
      navigate('/assistant-dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Assistant registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-96">
        <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          {showAssistantForm ? 'Assistant Registration' : 'Register as Student'}
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={showAssistantForm ? handleAssistantSubmit : handleStudentSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Name</label>
            <input
              type="text"
              name="name"
              value={showAssistantForm ? assistantFormData.name : studentFormData.name}
              onChange={showAssistantForm ? handleAssistantChange : handleStudentChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Your name"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={showAssistantForm ? assistantFormData.email : studentFormData.email}
              onChange={showAssistantForm ? handleAssistantChange : handleStudentChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="your@email.com"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={showAssistantForm ? assistantFormData.password : studentFormData.password}
              onChange={showAssistantForm ? handleAssistantChange : handleStudentChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          {showAssistantForm && (
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                Teacher Assistant Code
              </label>
              <input
                type="text"
                name="assistantCode"
                value={assistantFormData.assistantCode}
                onChange={handleAssistantChange}
                required
                maxLength={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="8-character code"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading
              ? 'Registering...'
              : showAssistantForm
              ? 'Register as Assistant'
              : 'Register as Student'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setShowAssistantForm((prev) => !prev);
            setError('');
          }}
          className="w-full mt-3 px-4 py-2 bg-white text-indigo-600 border border-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition"
        >
          {showAssistantForm ? 'Back to Student Registration' : 'Login as Assistant'}
        </button>

        <p className="text-center mt-4 text-gray-600">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-indigo-600 font-semibold hover:underline"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
