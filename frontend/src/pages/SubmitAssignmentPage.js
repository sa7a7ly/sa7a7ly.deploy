import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { submitAssignment, getAssignmentById } from '../services/api';
import logo from '../images/image.png';

const SubmitAssignmentPage = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadAssignment = async () => {
      try {
        const response = await getAssignmentById(assignmentId);
        if (isMounted) {
          setAssignment(response.data);
        }
      } catch (_) {
        // If this fails, we can still show the grade without max points.
      }
    };

    if (assignmentId) {
      loadAssignment();
    }

    return () => {
      isMounted = false;
    };
  }, [assignmentId]);
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
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ← Back
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                  Sa7a7ly
                </p>
                <h1 className="text-2xl font-bold text-slate-900">
                  Submission Result
                </h1>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              Logout
            </button>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-200/40 blur-2xl" />
            <div className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-sky-200/40 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <img
                src={logo}
                alt="Sa7a7ly logo"
                className="h-12 w-12 rounded-xl bg-white p-2 shadow"
              />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Great work
                </p>
                <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                  Assignment submitted!
                </h2>
                <p className="mt-2 text-slate-600">
                  Your submission has been graded by AI.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Grade
                </p>
                <p className="mt-2 text-4xl font-bold text-amber-700">
                  {result.grade}
                  {assignment?.totalPoints != null
                    ? ` / ${assignment.totalPoints}`
                    : ''}
                </p>
                <p className="mt-2 text-sm text-amber-700/80">
                  Keep improving for higher scores.
                </p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
                  Feedback
                </p>
                <p className="mt-3 text-slate-700">{result.feedback}</p>
              </div>
            </div>

            {result.uploadedPdf && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Your submission
                </p>
                <a
                  href={result.uploadedPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 font-semibold text-emerald-700 hover:text-emerald-800 underline"
                >
                  View PDF
                </a>
              </div>
            )}

            <button
              onClick={() => navigate(-1)}
              className="w-full mt-8 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
            >
              Back to Assignments
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Back
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Sa7a7ly
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                Submit Assignment
              </h1>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-200/40 blur-2xl" />
          <div className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-sky-200/40 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <img
              src={logo}
              alt="Sa7a7ly logo"
              className="h-12 w-12 rounded-xl bg-white p-2 shadow"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Upload your work
              </p>
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                Submit your assignment
              </h2>
              <p className="mt-2 text-slate-600">
                Send a PDF file and get AI feedback quickly.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <form onSubmit={handleSubmit}>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                isDragActive
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-slate-300 hover:border-emerald-500'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="mb-4 text-4xl">📤</div>
              <p className="text-lg font-semibold text-slate-900 mb-2">
                Drag and drop your PDF here
              </p>
              <p className="text-slate-600 mb-4">or click to select a file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {pdf && (
              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-emerald-700 font-semibold">Selected file</p>
                <p className="text-slate-700">{pdf.name}</p>
              </div>
            )}

            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pdf}
              className="w-full mt-8 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:opacity-50"
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
