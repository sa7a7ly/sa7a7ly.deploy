import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  submitAssignment,
  getAssignmentById,
  getStudentSubmission,
  createResubmissionRequest,
} from '../services/api';
import { jsPDF } from 'jspdf';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

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
  const [timeOffsetMs, setTimeOffsetMs] = useState(0);
  const [resubmissionRequest, setResubmissionRequest] = useState(null);
  const [resubmitReason, setResubmitReason] = useState('');
  const [requestingResubmit, setRequestingResubmit] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [infoMessage, setInfoMessage] = useState('');
  const fileInputRef = useRef(null);
  const { t } = useI18n();

  useEffect(() => {
    let isMounted = true;

    const loadAssignment = async () => {
      try {
        const response = await getAssignmentById(assignmentId);
        if (isMounted) {
          setAssignment(response.data);
          const serverTime = response.headers['x-server-time'];
          if (serverTime) {
            setTimeOffsetMs(Number(serverTime) - Date.now());
          }
        }
      } catch (_) {
        // If this fails, we can still show the grade without max points.
      }
    };

    const loadExistingSubmission = async () => {
      try {
        const response = await getStudentSubmission(assignmentId, user?._id);
        if (!isMounted) {
          return;
        }
        const submission = response.data?.submission || null;
        const latestRequest = response.data?.resubmissionRequest || null;
        setExistingSubmission(submission);
        setResubmissionRequest(latestRequest);

        if (
          submission &&
          (!latestRequest ||
            latestRequest.status !== 'APPROVED' ||
            latestRequest.used)
        ) {
          setResult(submission);
          setInfoMessage(t('submit.resultTitle'));
        }
      } catch (_) {
        // Ignore if no submission found.
      }
    };

    if (assignmentId) {
      loadAssignment();
      if (user?._id) {
        loadExistingSubmission();
      }
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
      const payload = response.data?.submission ? response.data : { submission: response.data };
      if (payload.alreadySubmitted) {
        setInfoMessage(t('submit.resultTitle'));
      } else {
        setInfoMessage('');
      }
      setResult(payload.submission);
      setResubmissionRequest(payload.resubmissionRequest || null);
      setExistingSubmission(payload.submission);
      setPdf(null);
    } catch (err) {
      setError(err.response?.data?.message || t('errors.failedSubmitAssignment'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isPastDue = assignment?.dueDate
    ? new Date(assignment.dueDate).getTime() - (Date.now() + timeOffsetMs) <= 0
    : false;

  const canSubmit =
    !isPastDue &&
    (!existingSubmission ||
      (resubmissionRequest?.status === 'APPROVED' && !resubmissionRequest.used));

  const handleRequestResubmission = async () => {
    if (!resubmitReason.trim()) {
      setError(t('submit.requestResubmit'));
      return;
    }
    setRequestingResubmit(true);
    setError('');
    try {
      const response = await createResubmissionRequest({
        assignmentId,
        studentId: user._id,
        reason: resubmitReason.trim(),
      });
      setResubmissionRequest(response.data);
      setResubmitReason('');
      setInfoMessage(t('submit.resubmitPending'));
    } catch (err) {
      setError(err.response?.data?.message || t('errors.failedRequestResubmit'));
    } finally {
      setRequestingResubmit(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) {
      return t('common.noDeadline');
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('common.noDeadline') : date.toLocaleString();
  };

  const getTimeLeft = (value) => {
    if (!value) {
      return t('common.noDeadline');
    }
    const due = new Date(value).getTime();
    if (Number.isNaN(due)) {
      return t('common.noDeadline');
    }
    const diff = due - (Date.now() + timeOffsetMs);
    if (diff <= 0) {
      return t('common.pastDue');
    }
    const minutes = Math.floor(diff / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
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
                ← {t('common.back')}
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                  Sa7a7ly
                </p>
                <h1 className="text-2xl font-bold text-slate-900">
                  {t('submit.resultTitle')}
                </h1>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              {t('common.logout')}
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
                  Sa7a7ly
                </p>
                <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                  {t('submit.submitted')}
                </h2>
                <p className="mt-2 text-slate-600">
                  {t('submit.gradedByAi')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            {infoMessage && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
                {infoMessage}
              </div>
            )}
            <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
                  {t('submit.grade')}
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
                  {t('submit.feedback')}
                </p>
                <p className="mt-3 text-slate-700">{result.feedback}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              <p>{t('common.due')}: {formatDateTime(assignment?.dueDate)}</p>
              <p>{t('common.timeLeft')}: {getTimeLeft(assignment?.dueDate)}</p>
            </div>

            {result.uploadedPdf && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  {t('classroom.submitAssignment')}
                </p>
                <a
                  href={result.uploadedPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 font-semibold text-emerald-700 hover:text-emerald-800 underline"
                >
                  {t('common.viewPdf')}
                </a>
              </div>
            )}

            {resubmissionRequest?.status === 'PENDING' && (
              <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-6 text-sky-700">
                {t('submit.resubmitPending')}
              </div>
            )}
            {resubmissionRequest?.status === 'DECLINED' && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
                {t('submit.resubmitDeclined')}
              </div>
            )}
            {resubmissionRequest?.status === 'APPROVED' && !resubmissionRequest.used && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">
                {t('submit.resubmitApproved')}
              </div>
            )}

            {(!resubmissionRequest ||
              resubmissionRequest.status === 'DECLINED' ||
              (resubmissionRequest.status === 'APPROVED' &&
                resubmissionRequest.used)) && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t('submit.requestResubmit')}
                </p>
                <textarea
                  value={resubmitReason}
                  onChange={(e) => setResubmitReason(e.target.value)}
                  rows={4}
                  className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={t('submit.requestReasonPlaceholder')}
                />
                <button
                  onClick={handleRequestResubmission}
                  disabled={requestingResubmit}
                  className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {requestingResubmit ? t('common.loading') : t('submit.requestResubmit')}
                </button>
              </div>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {resubmissionRequest?.status === 'APPROVED' &&
                !resubmissionRequest.used && (
                  <button
                    onClick={() => {
                      setResult(null);
                      setInfoMessage('');
                    }}
                    className="px-4 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-semibold"
                  >
                    {t('submit.submitNewVersion')}
                  </button>
                )}
              <button
                onClick={handleDownloadFeedback}
                className="px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-semibold"
              >
                {t('common.downloadPdf')}
              </button>
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
              >
                {t('common.back')}
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
              ← {t('common.back')}
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Sa7a7ly
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                {t('submit.submitTitle')}
              </h1>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            {t('common.logout')}
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
                {t('classroom.submitAssignment')}
              </p>
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                {t('submit.submitTitle')}
              </h2>
              <p className="mt-2 text-slate-600">
                {t('landing.supportBody')}
              </p>
            </div>
          </div>
        </div>

        {assignment && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
            <p>{t('common.due')}: {formatDateTime(assignment.dueDate)}</p>
            <p>{t('common.timeLeft')}: {getTimeLeft(assignment.dueDate)}</p>
          </div>
        )}

        {existingSubmission &&
          resubmissionRequest?.status !== 'APPROVED' &&
          !resubmissionRequest?.used && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-700">
              {t('submit.resultTitle')}
            </div>
          )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {isPastDue && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {t('submit.closed')}
            </div>
          )}
          {!isPastDue && !canSubmit && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
              {t('submit.requestResubmit')}
            </div>
          )}
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
              onClick={() => {
                if (canSubmit) {
                  fileInputRef.current?.click();
                }
              }}
            >
              <div className="mb-4 text-4xl">📤</div>
              <p className="text-lg font-semibold text-slate-900 mb-2">
                {t('classroom.submitAssignment')}
              </p>
              <p className="text-slate-600 mb-4">{t('common.view')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={!canSubmit}
                className="hidden"
              />
            </div>

            {pdf && (
              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-emerald-700 font-semibold">{t('common.view')}</p>
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
              disabled={loading || !pdf || !canSubmit}
              className="w-full mt-8 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('submit.submitTitle')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitAssignmentPage;
