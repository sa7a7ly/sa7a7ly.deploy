import React, { useEffect, useState, useCallback } from 'react';
import { createTeacher, getUsers } from '../../services/api';

const AdminTeachers = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    adminSecret: localStorage.getItem('adminSecret') || '',
  });
  const [createdCode, setCreatedCode] = useState('');

  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getUsers();
      const onlyTeachers = response.data.filter((u) => u.role === 'TEACHER');
      setTeachers(onlyTeachers);
      setError('');
    } catch (err) {
      setError('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCreatedCode('');
    setSubmitting(true);

    try {
      if (!formData.adminSecret) {
        setError('Admin secret is required');
        return;
      }

      localStorage.setItem('adminSecret', formData.adminSecret);

      const response = await createTeacher(
        {
          name: formData.name,
          email: formData.email,
          password: formData.password,
        },
        formData.adminSecret
      );

      setCreatedCode(response.data?.assistantCode || '');
      setFormData((prev) => ({
        ...prev,
        name: '',
        email: '',
        password: '',
      }));
      fetchTeachers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create teacher');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Teacher</h2>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {createdCode && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            Assistant Code: <span className="font-mono font-bold">{createdCode}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Admin Secret</label>
            <input
              type="password"
              name="adminSecret"
              value={formData.adminSecret}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Teacher'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Teachers</h2>
        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : teachers.length === 0 ? (
          <p className="text-gray-600">No teachers found.</p>
        ) : (
          <div className="space-y-3">
            {teachers.map((t) => (
              <div
                key={t._id}
                className="border border-gray-200 rounded-lg px-4 py-3 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-600">{t.email}</p>
                </div>
                <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  TEACHER
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminTeachers;
