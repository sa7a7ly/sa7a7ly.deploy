import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { submitAssignment, getAssignmentById } from '../services/api';

const SubmitAssignmentPage = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      if (files[0].type === 'application/pdf') {
        setPdf(files[0]);
        setError('');
      } else {
        setError('Please upload a PDF file');
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setPdf(file);
        setError('');
      } else {
        setError('Please upload a PDF file');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pdf) {
      setError('Please select a PDF file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('pdf', pdf);
      formData.append('assignmentId', assignmentId);
      formData.append('studentId', user._id);

      const response = await submitAssignment(formData);
      setResult(response.data);
      setPdf(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Submission Result
              </h1>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Assignment Submitted!
              </h2>
              <p className="text-gray-600">
                Your assignment has been graded by AI
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6">
                <p className="text-sm text-yellow-700 font-semibold mb-1">
                  ⭐ Grade
                </p>
                <p className="text-4xl font-bold text-yellow-600">
                  {result.grade}%
                </p>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
                <p className="text-sm text-blue-700 font-semibold mb-2">
                  📝 Feedback
                </p>
                <p className="text-gray-700">{result.feedback}</p>
              </div>

              {result.uploadedPdf && (
                <div className="bg-green-50 border-l-4 border-green-400 p-6">
                  <p className="text-sm text-green-700 font-semibold mb-2">
                    📄 Your Submission
                  </p>
                  <a
                    href={result.uploadedPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-800 underline"
                  >
                    View PDF
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate(-1)}
              className="w-full mt-8 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
            >
              Back to Assignments
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              Submit Assignment
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <form onSubmit={handleSubmit}>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                isDragActive
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-300 hover:border-indigo-500'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="mb-4 text-4xl">📤</div>
              <p className="text-lg font-semibold text-gray-900 mb-2">
                Drag and drop your PDF here
              </p>
              <p className="text-gray-600 mb-4">or click to select a file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {pdf && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 font-semibold">✓ Selected:</p>
                <p className="text-gray-700">{pdf.name}</p>
              </div>
            )}

            {error && (
              <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pdf}
              className="w-full mt-8 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Assignment'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitAssignmentPage;
