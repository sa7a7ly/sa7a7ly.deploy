import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { useAuth } from '../context/AuthContext';
import {
  getAssignments,
  getClassroom,
  getSubmissions,
  submitAssignmentOnBehalf,
} from '../services/api';
import { useI18n } from '../context/I18nContext';
import logo from '../images/image.png';
import pdfLogo from '../images/ms_Eman_logo.jpeg';

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

const GradeOnBehalfPage = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [savedFeedbacks, setSavedFeedbacks] = useState([]);

  const [studentName, setStudentName] = useState('');
  const [result, setResult] = useState(null);
  const [feedbackMeta, setFeedbackMeta] = useState({
    studentName: '',
    assignmentTitle: '',
  });
  const [formData, setFormData] = useState({
    assignmentId: '',
    pdf: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [classroomRes, assignmentsRes, submissionsRes] = await Promise.all([
          getClassroom(classroomId),
          getAssignments(classroomId),
          getSubmissions(null, classroomId),
        ]);

        const assignmentTitleMap = new Map(
          (assignmentsRes.data || []).map((a) => [a._id, a.title])
        );

        const onBehalfSubmissions = (submissionsRes.data || [])
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
              'Assignment',
            studentDisplayName: s.studentName || s.studentId?.name || 'Student',
          }))
          .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        setClassroom(classroomRes.data);
        setAssignments(assignmentsRes.data || []);
        setSavedFeedbacks(onBehalfSubmissions);
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
      setFeedbackMeta({ studentName: '', assignmentTitle: '' });

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
        'Assignment';
      const normalizedStudentName = studentName.trim();
      setFeedbackMeta({
        studentName: normalizedStudentName,
        assignmentTitle,
      });

      if (createdSubmission) {
        setSavedFeedbacks((prev) => [
          {
            ...createdSubmission,
            assignmentTitle,
            studentDisplayName:
              normalizedStudentName || createdSubmission.studentName || 'Student',
          },
          ...prev,
        ]);
      }

      setFormData({ assignmentId: '', pdf: null });
      setStudentName('');
    } catch (err) {
      setError(err.response?.data?.message || t('errors.failedSubmitAssignment'));
    } finally {
      setSubmitting(false);
    }
  };

  const buildFeedbackPdf = async ({ student, assignmentTitle, grade, feedback }) => {
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
      const logoDataUrl = await loadImageAsDataUrl(pdfLogo);
      doc.addImage(logoDataUrl, 'PNG', margin, 8, 24, 24);
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
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 3, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Student', margin + 4, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(student || 'N/A', margin + 4, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.text('Assignment', margin + 80, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(assignmentTitle || 'N/A', margin + 80, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.text('Grade', pageWidth - margin - 26, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.text(String(grade ?? 'N/A'), pageWidth - margin - 26, y + 18);

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
    const feedbackText = String(feedback || '');
    const hasArabicFeedback = /[\u0600-\u06FF]/.test(feedbackText);

    if (!hasArabicFeedback) {
      const feedbackLines = doc.splitTextToSize(
        feedbackText || 'No feedback provided.',
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
    } else {
      const contentWidthMm = pageWidth - margin * 2 - 8;
      const lineHeightPx = 46;
      const canvasWidthPx = 1600;
      const maxTextWidthPx = canvasWidthPx - 40;
      const arabicFontFamily = "'Noto Naskh Arabic','Amiri','Tahoma','Arial',sans-serif";
      const estimatedLineHeightMm = (lineHeightPx * contentWidthMm) / canvasWidthPx;
      const wrapTextWithCanvas = (text) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `34px ${arabicFontFamily}`;

        const lines = [];
        String(text || '')
          .split(/\r?\n/)
          .forEach((rawLine) => {
            const words = rawLine.split(/\s+/).filter(Boolean);
            if (!words.length) {
              lines.push('');
              return;
            }
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
          });

        return lines;
      };

      const wrappedLines = wrapTextWithCanvas(feedbackText || 'لا توجد ملاحظات.');
      let lineIndex = 0;

      while (lineIndex < wrappedLines.length) {
        const availableHeightMm = pageHeight - margin - y;
        const linesPerPage = Math.max(1, Math.floor(availableHeightMm / estimatedLineHeightMm));
        const pageLines = wrappedLines.slice(lineIndex, lineIndex + linesPerPage);
        lineIndex += pageLines.length;

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidthPx;
        canvas.height = Math.max(120, pageLines.length * lineHeightPx + 20);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.font = `34px ${arabicFontFamily}`;
        ctx.fillStyle = '#111827';

        let py = 10;
        pageLines.forEach((line) => {
          ctx.fillText(line, canvas.width - 20, py);
          py += lineHeightPx;
        });

        const img = canvas.toDataURL('image/png');
        const imgHeightMm = (canvas.height * contentWidthMm) / canvas.width;
        doc.addImage(img, 'PNG', margin + 4, y, contentWidthMm, imgHeightMm);
        y += imgHeightMm;

        if (lineIndex < wrappedLines.length) {
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
      }
    }

    return doc;
  };

  const downloadFeedbackPdf = async ({
    student,
    assignmentTitle,
    grade,
    feedback,
  }) => {
    const doc = await buildFeedbackPdf({ student, assignmentTitle, grade, feedback });
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

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-200/40 blur-2xl" />
          <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-sky-200/40 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <img
              src={logo}
              alt="Sa7a7ly logo"
              className="h-11 w-11 rounded-xl bg-white p-2 shadow"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                {classroom?.name || t('common.classroom')}
              </p>
              <h2 className="text-3xl font-bold text-slate-900">
                {t('common.gradeOnBehalf')}
              </h2>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <p className="mt-1 text-sm text-slate-600">{t('common.uploadPdf')}</p>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-4">
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder={t('common.selectStudent')}
            />
            <select
              value={formData.assignmentId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, assignmentId: e.target.value }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">{t('common.selectAssignment')}</option>
              {assignments.map((assignment) => (
                <option key={assignment._id} value={assignment._id}>
                  {assignment.title}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? t('common.loading') : t('classroom.submitAssignment')}
            </button>
          </form>
        </section>

        {result && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900">AI Grading Result</h3>
            <p className="mt-2 text-sm text-slate-700">
              Grade: <span className="font-semibold">{result.grade}</span>
            </p>
            <button
              type="button"
              onClick={() =>
                downloadFeedbackPdf({
                  student: feedbackMeta.studentName,
                  assignmentTitle: feedbackMeta.assignmentTitle,
                  grade: result.grade,
                  feedback: result.feedback,
                })
              }
              className="mt-1 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              {t('common.downloadPdf')}
            </button>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900">Saved Feedbacks</h3>
          {savedFeedbacks.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              No saved grade-on-behalf feedbacks yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {savedFeedbacks.map((submission) => (
                <div
                  key={submission._id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="grid gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Assignment
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {submission.assignmentTitle}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Student
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {submission.studentDisplayName}
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
                        })
                      }
                      className="mt-1 inline-flex w-fit items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      {t('common.downloadPdf')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

