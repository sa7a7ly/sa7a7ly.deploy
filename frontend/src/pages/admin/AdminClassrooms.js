import React, { useEffect, useState, useCallback } from 'react';
import { getClassrooms } from '../../services/api';
import logo from '../../images/image.png';

const AdminClassrooms = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classrooms, setClassrooms] = useState([]);

  const fetchClassrooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getClassrooms();
      setClassrooms(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  return (
    <section className="space-y-6">
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
                  Classrooms overview
                </h2>
              </div>
            </div>
            <p className="mt-3 text-slate-700">
              Track classroom setup and keep join codes visible.
            </p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">
                {classrooms.length}
              </p>
              <p className="text-sm text-slate-600">Total</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">Share</p>
              <p className="text-sm text-slate-600">Join codes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-4">Classrooms</h3>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-slate-600">Loading...</p>
      ) : classrooms.length === 0 ? (
        <p className="text-slate-600">No classrooms found.</p>
      ) : (
        <div className="space-y-3">
          {classrooms.map((c) => (
            <div
              key={c._id}
              className="border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-slate-900">{c.name}</p>
                <p className="text-sm text-slate-600">
                  Classroom ID: {c._id}
                </p>
              </div>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                {c.joinCode}
              </span>
            </div>
          ))}
        </div>
      )}
      </div>
    </section>
  );
};

export default AdminClassrooms;
