import React, { useEffect, useState, useCallback } from 'react';
import { createTeacher, getUsers } from '../../services/api';
import logo from '../../images/image.png';

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
    setSubmitting(true);

    try {
      if (!formData.adminSecret) {
        setError('Admin secret is required');
        return;
      }

      localStorage.setItem('adminSecret', formData.adminSecret);

      await createTeacher(
        {
          name: formData.name,
          email: formData.email,
          password: formData.password,
        },
        formData.adminSecret
      );

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
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-200/40 blur-2xl" />
        <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Sa7a7ly logo"
                className="h-11 w-11 rounded-xl bg-white p-2 shadow"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                  Admin
                </p>
                <h2 className="text-3xl font-bold text-slate-900">
                  Teacher management
                </h2>
              </div>
            </div>
            <p className="mt-3 text-slate-700">
              Create teacher accounts and track the teaching team in one place.
            </p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">
                {teachers.length}
              </p>
              <p className="text-sm text-slate-600">Teachers</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">Secure</p>
              <p className="text-sm text-slate-600">Access</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-4">
          Create Teacher
        </h3>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Admin Secret
            </label>
            <input
              type="password"
              name="adminSecret"
              value={formData.adminSecret}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Teacher'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-4">Teachers</h3>
        {loading ? (
          <p className="text-slate-600">Loading...</p>
        ) : teachers.length === 0 ? (
          <p className="text-slate-600">No teachers found.</p>
        ) : (
          <div className="space-y-3">
            {teachers.map((t) => (
              <div
                key={t._id}
                className="border border-slate-200 rounded-xl px-4 py-3 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-slate-900">{t.name}</p>
                  <p className="text-sm text-slate-600">{t.email}</p>
                </div>
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
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
