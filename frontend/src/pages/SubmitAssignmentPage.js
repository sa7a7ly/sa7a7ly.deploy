import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { submitAssignment, getAssignmentById } from '../services/api';
import { jsPDF } from 'jspdf';
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

  const loadImageAsDataUrl = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = src;
    });

  const handleDownloadFeedback = async () => {
    if (!result) {
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    let y = 20;

    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 38, pageWidth, 38);

    try {
      const logoDataUrl = await loadImageAsDataUrl(logo);
      doc.addImage(logoDataUrl, 'PNG', margin, 10, 16, 16);
    } catch (err) {
      // If logo fails, continue without it.
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Assignment Feedback', margin + 22, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sa7a7ly', margin + 22, 28);

    y = 50;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 3, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Student', margin + 4, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(user?.name || 'N/A', margin + 4, y + 18);

    doc.setFont('helvetica', 'bold');
    doc.text('Assignment', margin + 80, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(assignment?.title || 'N/A', margin + 80, y + 18);

    doc.setFont('helvetica', 'bold');
    doc.text('Grade', pageWidth - margin - 26, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${result.grade}${
        assignment?.totalPoints != null ? ` / ${assignment.totalPoints}` : ''
      }`,
      pageWidth - margin - 26,
      y + 18
    );

    y += 34;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Feedback Summary', margin, y);

    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, pageWidth - margin * 2, pageHeight - y - margin, 3, 3, 'S');

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const feedbackLines = doc.splitTextToSize(
      result.feedback || 'No feedback provided.',
      pageWidth - margin * 2 - 8
    );
    feedbackLines.forEach((line) => {
      if (y > pageHeight - margin - 6) {
        doc.addPage();
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(
          margin,
          margin,
          pageWidth - margin * 2,
          pageHeight - margin * 2,
          3,
          3,
          'S'
        );
        y = margin + 8;
      }
      doc.text(line, margin + 4, y);
      y += 6;
    });

    const safeTitle = (assignment?.title || 'assignment')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    doc.save(`feedback-${safeTitle || 'assignment'}.pdf`);
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

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                onClick={handleDownloadFeedback}
                className="px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-semibold"
              >
                Download Feedback PDF
              </button>
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
              >
                Back to Assignments
              </button>
            </div>
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
