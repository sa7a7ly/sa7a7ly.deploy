import React, { useEffect, useState, useCallback } from 'react';
import { getAllAssignments } from '../../services/api';

const AdminAssignments = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignments, setAssignments] = useState([]);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAllAssignments();
      setAssignments(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Assignments</h2>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : assignments.length === 0 ? (
        <p className="text-gray-600">No assignments found.</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div
              key={a._id}
              className="border border-gray-200 rounded-lg px-4 py-3"
            >
              <p className="font-semibold text-gray-900">{a.title}</p>
              <p className="text-sm text-gray-600">Points: {a.totalPoints}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default AdminAssignments;
