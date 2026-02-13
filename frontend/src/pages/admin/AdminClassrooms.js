import React, { useEffect, useState, useCallback } from 'react';
import { getClassrooms } from '../../services/api';

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
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Classrooms</h2>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : classrooms.length === 0 ? (
        <p className="text-gray-600">No classrooms found.</p>
      ) : (
        <div className="space-y-3">
          {classrooms.map((c) => (
            <div
              key={c._id}
              className="border border-gray-200 rounded-lg px-4 py-3"
            >
              <p className="font-semibold text-gray-900">{c.name}</p>
              <p className="text-sm text-gray-600">Join Code: {c.joinCode}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default AdminClassrooms;
