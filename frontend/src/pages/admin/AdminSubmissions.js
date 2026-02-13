import React, { useEffect, useState, useCallback } from 'react';
import { getAllSubmissions } from '../../services/api';

const AdminSubmissions = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState([]);

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAllSubmissions();
      setSubmissions(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Submissions</h2>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : submissions.length === 0 ? (
        <p className="text-gray-600">No submissions found.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div
              key={s._id}
              className="border border-gray-200 rounded-lg px-4 py-3"
            >
              <p className="font-semibold text-gray-900">Submission {s._id}</p>
              <p className="text-sm text-gray-600">Grade: {s.grade ?? 'N/A'}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default AdminSubmissions;
