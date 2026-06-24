import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { useAuth } from '../context/AuthContext';
import {
  getAssignments,
  getClassroom,
  getSubmissions,
  deleteSubmission,
  submitAssignmentOnBehalf,
} from '../services/api';
import { useI18n } from '../context/I18nContext';
import logo from '../images/image.png';
import arabicEssayPdfLogo from '../images/ms_Eman_logo.jpeg';
import { drawFeedbackTextToPdf } from '../utils/feedbackPdf';

const PAGE_SIZE = 8;
const FETCH_LIMIT = 50;

const loadImageForPdf = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        format: 'PNG',
        width: img.width,
        height: img.height,
      });
    };
    img.onerror = reject;
    img.src = src;
  });

const GradeOnBehalfPage = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState('');
  const [error, setError] = useState('');
  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [savedFeedbacks, setSavedFeedbacks] = useState([]);
  const [savedPage, setSavedPage] = useState(1);

  const [studentName, setStudentName] = useState('');
  const [result, setResult] = useState(null);
  const [feedbackMeta, setFeedbackMeta] = useState({
    studentName: '',
    assignmentTitle: '',
    assignmentId: '',
  });
  const [formData, setFormData] = useState({
    assignmentId: '',
    pdf: null,
  });

  const getPdfLogoByProfile = (gradingProfile) =>
    String(gradingProfile || '').toUpperCase() === 'ARABIC_ESSAY'
      ? arabicEssayPdfLogo
      : logo;

  useEffect(() => {
    const fetchAllClassroomSubmissions = async (targetClassroomId) => {
      let page = 1;
      let allSubmissions = [];
      let totalCount = Infinity;

      while (allSubmissions.length < totalCount) {
        const response = await getSubmissions(null, targetClassroomId, {
          page,
          limit: FETCH_LIMIT,
        });
        const pageItems = response.data || [];
        const headerTotal = Number(response.headers?.['x-total-count']);

        if (Number.isFinite(headerTotal) && headerTotal >= 0) {
          totalCount = headerTotal;
        }

        allSubmissions = allSubmissions.concat(pageItems);

        if (pageItems.length === 0 || pageItems.length < FETCH_LIMIT) {
          break;
        }

        page += 1;
      }

      return allSubmissions;
    };

    const load = async () => {
      try {
        setLoading(true);
        const [classroomRes, assignmentsRes, submissions] = await Promise.all([
          getClassroom(classroomId),
          getAssignments(classroomId),
          fetchAllClassroomSubmissions(classroomId),
        ]);

        const assignmentTitleMap = new Map(
          (assignmentsRes.data || []).map((a) => [a._id, a.title])
        );

        const onBehalfSubmissions = (submissions || [])
          .filter(
            (s) =>
              s.submittedByRole === 'TEACHER' || s.submittedByRole === 'ASSISTANT'
          )
          .map((s) => ({
            ...s,
            assignmentTitle:
              s.assignmentId?.title ||
              assignmentTitleMap.get(
                typeof s.assignmentId === 'string'
                  ? s.assignmentId
                  : s.assignmentId?._id
              ) ||
              t('gradeOnBehalf.assignmentFallback'),
            studentDisplayName: s.studentName || s.studentId?.name || t('gradeOnBehalf.studentFallback'),
          }))
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        setClassroom(classroomRes.data);
        setAssignments(assignmentsRes.data || []);
        setSavedFeedbacks(onBehalfSubmissions);
        setSavedPage(1);
        setError('');
      } catch (err) {
        setError(err.response?.data?.message || t('errors.failedLoadSubmissions'));
      } finally {
        setLoading(false);
      }
    };

    if (classroomId) {
      load();
    }
  }, [classroomId, t]);

  const totalSavedPages = Math.max(1, Math.ceil(savedFeedbacks.length / PAGE_SIZE));

  useEffect(() => {
    if (savedPage > totalSavedPages) {
      setSavedPage(totalSavedPages);
    }
  }, [savedPage, totalSavedPages]);

  const paginatedSavedFeedbacks = useMemo(() => {
    const start = (savedPage - 1) * PAGE_SIZE;
    return savedFeedbacks.slice(start, start + PAGE_SIZE);
  }, [savedFeedbacks, savedPage]);

  const renderPaginationControls = () => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Showing {(savedPage - 1) * PAGE_SIZE + 1}-
          {Math.min(savedPage * PAGE_SIZE, savedFeedbacks.length)} of{' '}
          {savedFeedbacks.length} submissions
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSavedPage((p) => Math.max(1, p - 1))}
            disabled={savedPage === 1}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
            {savedPage} / {totalSavedPages}
          </span>
          <button
            type="button"
            onClick={() => setSavedPage((p) => Math.min(totalSavedPages, p + 1))}
            disabled={savedPage === totalSavedPages}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFormData((prev) => ({
      ...prev,
      pdf: file || null,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setError(t('common.selectStudent'));
      return;
    }
    if (!formData.assignmentId || !formData.pdf) {
      setError(t('common.uploadPdf'));
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setResult(null);
      setFeedbackMeta({ studentName: '', assignmentTitle: '', assignmentId: '' });

      const payload = new FormData();
      payload.append('assignmentId', formData.assignmentId);
      payload.append('studentName', studentName.trim());
      payload.append('submittedBy', user._id);
      payload.append('pdf', formData.pdf);

      const response = await submitAssignmentOnBehalf(payload);
      const createdSubmission = response?.data?.submission || null;
      setResult(createdSubmission);

      const assignmentTitle =
        assignments.find((a) => a._id === formData.assignmentId)?.title ||
        t('gradeOnBehalf.assignmentFallback');
      const normalizedStudentName = studentName.trim();
      setFeedbackMeta({
        studentName: normalizedStudentName,
        assignmentTitle,
        assignmentId: formData.assignmentId,
      });

      if (createdSubmission) {
        setSavedFeedbacks((prev) => [
          {
            ...createdSubmission,
            assignmentTitle,
            studentDisplayName:
              normalizedStudentName || createdSubmission.studentName || t('gradeOnBehalf.studentFallback'),
          },
          ...prev,
        ]);
        setSavedPage(1);
      }

      setFormData({ assignmentId: '', pdf: null });
      setStudentName('');
    } catch (err) {
      setError(err.response?.data?.message || t('errors.failedSubmitAssignment'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSavedSubmission = async (submissionId) => {
    const confirmed = window.confirm('Delete this submission?');
    if (!confirmed) return;

    try {
      setDeletingSubmissionId(submissionId);
      await deleteSubmission(submissionId);
      setSavedFeedbacks((prev) => prev.filter((item) => item._id !== submissionId));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete submission');
    } finally {
      setDeletingSubmissionId('');
    }
  };

  const buildFeedbackPdf = async ({
    student,
    assignmentTitle,
    grade,
    feedback,
    gradingProfile,
  }) => {
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
      const selectedPdfLogo = getPdfLogoByProfile(gradingProfile);
      const logoAsset = await loadImageForPdf(selectedPdfLogo);
      const maxLogoWidth = 22;
      const maxLogoHeight = 18;
      const ratio =
        logoAsset.width && logoAsset.height
          ? logoAsset.width / logoAsset.height
          : 1;
      let drawWidth = maxLogoWidth;
      let drawHeight = drawWidth / ratio;
      if (drawHeight > maxLogoHeight) {
        drawHeight = maxLogoHeight;
        drawWidth = drawHeight * ratio;
      }
      const drawY = 8 + (24 - drawHeight) / 2;
      doc.addImage(
        logoAsset.dataUrl,
        logoAsset.format,
        margin,
        drawY,
        drawWidth,
        drawHeight
      );
    } catch (_) {
      // If logo fails, continue without it.
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Assignment Feedback', margin + 30, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sa7a7ly', margin + 30, 28);

    y = 50;
    const summaryW = pageWidth - margin * 2;
    const summaryH = 24;
    const studentW = summaryW * 0.32;
    const assignmentW = summaryW * 0.48;
    const gradeW = summaryW - studentW - assignmentW;
    const studentX = margin;
    const assignmentX = studentX + studentW;
    const gradeX = assignmentX + assignmentW;

    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, summaryW, summaryH, 3, 3, 'S');
    doc.line(assignmentX, y, assignmentX, y + summaryH);
    doc.line(gradeX, y, gradeX, y + summaryH);

    const drawSectionValue = ({ label, value, x, width }) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(label, x + width / 2, y + 6, { align: 'center' });

      const valueText = String(value || 'N/A');
      const hasArabic = /[\u0600-\u06FF]/.test(valueText);

      if (!hasArabic) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(valueText, width - 8);
        const singleLine = lines[0] || 'N/A';
        doc.text(singleLine, x + width / 2, y + 14, { align: 'center' });
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        doc.text(valueText, x + width / 2, y + 14, { align: 'center' });
        return;
      }

      const arabicFontFamily = "'Noto Naskh Arabic','Amiri','Tahoma','Arial',sans-serif";
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.font = `46px ${arabicFontFamily}`;
      ctx.fillStyle = '#111827';

      const horizontalPadding = 30;
      const maxTextWidthPx = canvas.width - horizontalPadding * 2;
      const words = valueText.split(/\s+/).filter(Boolean);
      const lines = [];
      let current = '';
      words.forEach((word) => {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width <= maxTextWidthPx) {
          current = test;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      });
      if (current) lines.push(current);

      const singleLine = lines[0] || 'N/A';
      const displayLine = lines.length > 1 ? `${singleLine}...` : singleLine;
      ctx.fillText(displayLine, canvas.width - horizontalPadding, 10);

      const img = canvas.toDataURL('image/png');
      doc.addImage(img, 'PNG', x + 3, y + 8, width - 6, 8);
    };

    drawSectionValue({
      label: 'Student',
      value: student || 'N/A',
      x: studentX,
      width: studentW,
    });
    drawSectionValue({
      label: 'Assignment',
      value: assignmentTitle || 'N/A',
      x: assignmentX,
      width: assignmentW,
    });
    drawSectionValue({
      label: 'Grade',
      value: String(grade ?? 'N/A'),
      x: gradeX,
      width: gradeW,
    });

    y += 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Feedback Summary', margin, y);
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, pageWidth - margin * 2, pageHeight - y - margin, 3, 3, 'S');
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const feedbackText = String(feedback || '');

    drawFeedbackTextToPdf({
      doc,
      text: feedbackText,
      x: margin + 4,
      y,
      width: pageWidth - margin * 2 - 8,
      pageHeight,
      margin,
      addPageFrame: () => {
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
      },
    });
    return doc;
  };

  const downloadFeedbackPdf = async ({
    student,
    assignmentTitle,
    grade,
    feedback,
    gradingProfile,
  }) => {
    const doc = await buildFeedbackPdf({
      student,
      assignmentTitle,
      grade,
      feedback,
      gradingProfile,
    });
    const safeTitle = (assignmentTitle || 'assignment')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    doc.save(`feedback-${safeTitle || 'assignment'}.pdf`);
  };

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
                {t('common.gradeOnBehalf')}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm sm:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-200/40 blur-2xl" />
          <div className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-sky-200/40 blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
            <img
              src={logo}
              alt="Sa7a7ly logo"
              className="h-12 w-12 rounded-xl bg-white p-2 shadow"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                {classroom?.name || t('common.classroom')}
              </p>
                <h2 className="text-3xl font-bold text-slate-900">
                {t('common.gradeOnBehalf')}
              </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {t('gradeOnBehalf.heroBody')}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t('common.assignments')}
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">{assignments.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t('gradeOnBehalf.savedFeedbacks')}
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">{savedFeedbacks.length}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                {t('gradeOnBehalf.submissionForm')}
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">{t('common.uploadPdf')}</h3>
            </div>
            <p className="text-sm text-slate-600">{t('gradeOnBehalf.pdfOnly')}</p>
          </div>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t('gradeOnBehalf.studentName')}
              </span>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder={t('common.selectStudent')}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t('common.assignments')}
              </span>
              <select
                value={formData.assignmentId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, assignmentId: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">{t('common.selectAssignment')}</option>
                {assignments.map((assignment) => (
                  <option key={assignment._id} value={assignment._id}>
                    {assignment.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t('gradeOnBehalf.pdfFile')}
              </span>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="md:col-span-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? t('common.loading') : t('classroom.submitAssignment')}
            </button>
          </form>
        </section>

        {result && (
          <section className="bg-white rounded-3xl border border-emerald-200 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  {t('gradeOnBehalf.submissionReceived')}
                </div>
                <h3 className="mt-3 text-xl font-bold text-slate-900">{t('gradeOnBehalf.aiResult')}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {t('gradeOnBehalf.processedSuccessfully')}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  {t('submit.grade')}
                </p>
                <p className="text-2xl font-bold text-emerald-700">{result.grade}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadFeedbackPdf({
                  student: feedbackMeta.studentName,
                  assignmentTitle: feedbackMeta.assignmentTitle,
                  grade: result.grade,
                  feedback: result.feedback,
                  gradingProfile:
                    assignments.find((a) => a._id === feedbackMeta.assignmentId)
                      ?.gradingProfile || 'GENERAL',
                })
              }
              className="mt-5 inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              {t('common.downloadPdf')}
            </button>
          </section>
        )}

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-bold text-slate-900">{t('gradeOnBehalf.savedFeedbacks')}</h3>
            <p className="text-sm text-slate-600">{t('gradeOnBehalf.latestSubmissions')}</p>
          </div>
          {savedFeedbacks.length > 0 && <div className="mt-4">{renderPaginationControls()}</div>}
          {savedFeedbacks.length === 0 ? (
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {t('gradeOnBehalf.noSavedFeedbacks')}
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {paginatedSavedFeedbacks.map((submission) => (
                <div
                  key={submission._id}
                  className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
                >
                  <div className="grid gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        {t('common.assignments')}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {submission.assignmentTitle}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        {t('gradeOnBehalf.studentName')}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {submission.studentDisplayName}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        {t('submit.grade')}
                      </p>
                      <p className="text-sm font-semibold text-emerald-700">
                        {submission.grade ?? t('gradeOnBehalf.notAvailable')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadFeedbackPdf({
                          student:
                            submission.studentDisplayName ||
                            submission.studentName ||
                            submission.studentId?.name,
                          assignmentTitle:
                            submission.assignmentTitle ||
                            submission.assignmentId?.title,
                          grade: submission.grade,
                          feedback: submission.feedback,
                          gradingProfile:
                            assignments.find(
                              (a) =>
                                a._id ===
                                (typeof submission.assignmentId === 'string'
                                  ? submission.assignmentId
                                  : submission.assignmentId?._id)
                            )?.gradingProfile || 'GENERAL',
                        })
                      }
                      className="mt-1 inline-flex w-fit items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      {t('common.downloadPdf')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedSubmission(submission._id)}
                      disabled={deletingSubmissionId === submission._id}
                      className="mt-1 inline-flex w-fit items-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {deletingSubmissionId === submission._id ? t('common.loading') : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {savedFeedbacks.length > 0 && <div className="mt-5">{renderPaginationControls()}</div>}
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-slate-600">{t('common.loading')}</div>
        )}
      </div>
    </div>
  );
};

export default GradeOnBehalfPage;
