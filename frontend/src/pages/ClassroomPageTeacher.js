import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { useAuth } from '../context/AuthContext';
import {
  getAssignments,
  createAssignment,
  getClassrooms,
  getClassroomStudents,
  getSubmissions,
  removeClassroomStudent,
  updateAssignment,
  deleteAssignment,
} from '../services/api';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

const REPORT_FETCH_LIMIT = 100;
const REPORT_CHART_WIDTH = 150;
const REPORT_CHART_HEIGHT = 70;
const REPORT_CHART_BINS = 5;

const loadImageDataUrl = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('Unable to prepare logo for PDF.'));
        return;
      }

      context.drawImage(image, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => reject(new Error('Unable to load logo for PDF.'));
    image.src = src;
  });

const ClassroomPageTeacher = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const subscriptionEnd = user?.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const subscriptionActive =
    user?.subscriptionStatus === 'ACTIVE' ||
    user?.subscriptionStatus === 'TRIAL';
  const subscriptionExpired =
    subscriptionActive && subscriptionEnd && new Date() > subscriptionEnd;
  const canManage = subscriptionActive && !subscriptionExpired;
  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState('');
  const [studentActionMessage, setStudentActionMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [timeOffsetMs, setTimeOffsetMs] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [savingAssignmentId, setSavingAssignmentId] = useState('');
  const [deletingAssignmentId, setDeletingAssignmentId] = useState('');
  const [exportingAssignmentId, setExportingAssignmentId] = useState('');
  const [removingStudentId, setRemovingStudentId] = useState('');

  useEffect(() => {
    fetchClassroom();
    fetchAssignments();
    fetchStudents();
  }, [classroomId]);

  const fetchClassroom = async () => {
    try {
      const response = await getClassrooms();
      const currentClassroom = response.data.find((c) => c._id === classroomId);
      setClassroom(currentClassroom || null);
    } catch (err) {
      console.error('Failed to load classroom:', err);
      setClassroom(null);
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await getAssignments(classroomId);
      setAssignments(response.data);
      const serverTime = response.headers['x-server-time'];
      if (serverTime) {
        setTimeOffsetMs(Number(serverTime) - Date.now());
      }
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setStudentsLoading(true);
      const response = await getClassroomStudents(classroomId);
      setStudents(response.data || []);
      setStudentsError('');
    } catch (err) {
      setStudents([]);
      setStudentsError(err.response?.data?.message || 'Failed to load students.');
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleRemoveStudent = async (student) => {
    const confirmed = window.confirm(t('classroom.removeStudentConfirm'));
    if (!confirmed) {
      return;
    }

    try {
      setRemovingStudentId(student._id);
      setStudentsError('');
      setStudentActionMessage('');
      await removeClassroomStudent(classroomId, student._id);
      setStudents((prev) => prev.filter((item) => item._id !== student._id));
      setStudentActionMessage(t('classroom.removeStudentSuccess'));
    } catch (err) {
      setStudentsError(err.response?.data?.message || t('classroom.removeStudentFailed'));
    } finally {
      setRemovingStudentId('');
    }
  };

  const handleCreateAssignment = async (formData) => {
    try {
      await createAssignment(formData);
      setShowModal(false);
      setActionError('');
      fetchAssignments();
    } catch (err) {
      console.error('Failed to create assignment:', err);
      setActionError(err.response?.data?.message || 'Failed to create assignment.');
      throw err;
    }
  };

  const startEditTitle = (assignment) => {
    setEditingAssignmentId(assignment._id);
    setEditingTitle(assignment.title || '');
    setActionError('');
  };

  const cancelEditTitle = () => {
    setEditingAssignmentId('');
    setEditingTitle('');
  };

  const saveTitle = async (assignmentId) => {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      setActionError('Assignment title is required.');
      return;
    }

    try {
      setSavingAssignmentId(assignmentId);
      const response = await updateAssignment(assignmentId, { title: nextTitle });
      const updated = response.data;
      setAssignments((prev) =>
        prev.map((item) => (item._id === assignmentId ? { ...item, ...updated } : item))
      );
      setEditingAssignmentId('');
      setEditingTitle('');
      setActionError('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update assignment title.');
    } finally {
      setSavingAssignmentId('');
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    const confirmed = window.confirm(
      `Delete assignment "${assignment.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeletingAssignmentId(assignment._id);
      await deleteAssignment(assignment._id);
      setAssignments((prev) => prev.filter((item) => item._id !== assignment._id));
      if (editingAssignmentId === assignment._id) {
        setEditingAssignmentId('');
        setEditingTitle('');
      }
      setActionError('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to delete assignment.');
    } finally {
      setDeletingAssignmentId('');
    }
  };

  const buildHistogram = (grades, totalPoints) => {
    const safeMax = Math.max(Number(totalPoints) || 0, ...grades, 1);
    const bins = Array.from({ length: REPORT_CHART_BINS }, (_, index) => ({
      labelStart: (safeMax / REPORT_CHART_BINS) * index,
      labelEnd: (safeMax / REPORT_CHART_BINS) * (index + 1),
      count: 0,
    }));

    grades.forEach((grade) => {
      const rawIndex = Math.floor((grade / safeMax) * REPORT_CHART_BINS);
      const binIndex = Math.min(REPORT_CHART_BINS - 1, Math.max(0, rawIndex));
      bins[binIndex].count += 1;
    });

    return bins;
  };

  const exportAssignmentReportPdf = async (assignment, rows) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    const grades = rows
      .map((row) => row.grade)
      .filter((grade) => typeof grade === 'number' && Number.isFinite(grade));
    const average =
      grades.length > 0
        ? grades.reduce((sum, value) => sum + value, 0) / grades.length
        : null;
    const highest = grades.length > 0 ? Math.max(...grades) : null;
    const lowest = grades.length > 0 ? Math.min(...grades) : null;
    const histogram = buildHistogram(grades, assignment.totalPoints);
    const maxCount = Math.max(1, ...histogram.map((bin) => bin.count));
    const chartX = margin;
    let cursorY = 18;
    const generatedAt = new Date().toLocaleString();
    const participationRate =
      rows.length > 0 ? Math.round((grades.length / rows.length) * 100) : 0;
    const topStudents = rows
      .filter((row) => typeof row.grade === 'number')
      .sort((a, b) => b.grade - a.grade || a.studentName.localeCompare(b.studentName))
      .slice(0, 3);

    const drawFooter = () => {
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Sa7a7ly assignment performance report', margin, pageHeight - 7);
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber}`,
        pageWidth - margin,
        pageHeight - 7,
        { align: 'right' }
      );
    };

    let logoAsset = null;
    try {
      logoAsset = await loadImageDataUrl(logo);
    } catch {
      logoAsset = null;
    }

    const heroY = 12;
    const heroHeight = 30;
    doc.setFillColor(240, 253, 250);
    doc.roundedRect(margin, heroY, contentWidth, heroHeight, 6, 6, 'F');
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, heroY, contentWidth, heroHeight, 6, 6);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin + 4, heroY + 4, 22, 22, 5, 5, 'F');
    doc.setDrawColor(220, 252, 231);
    doc.roundedRect(margin + 4, heroY + 4, 22, 22, 5, 5);
    if (logoAsset) {
      const maxLogoWidth = 16;
      const maxLogoHeight = 16;
      const aspectRatio = logoAsset.width / Math.max(logoAsset.height, 1);
      let drawWidth = maxLogoWidth;
      let drawHeight = drawWidth / aspectRatio;

      if (drawHeight > maxLogoHeight) {
        drawHeight = maxLogoHeight;
        drawWidth = drawHeight * aspectRatio;
      }

      const drawX = margin + 4 + (22 - drawWidth) / 2;
      const drawY = heroY + 4 + (22 - drawHeight) / 2;
      doc.addImage(logoAsset.dataUrl, 'PNG', drawX, drawY, drawWidth, drawHeight);
    }
    const leftTextX = margin + 30;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.text('SA7A7LY', leftTextX, heroY + 9);
    doc.setFontSize(16);
    doc.text('Assignment Performance Report', leftTextX, heroY + 17);
    doc.setFontSize(9);
    doc.setTextColor(6, 95, 70);
    doc.text(classroom?.name || 'Classroom', leftTextX, heroY + 24);

    const overviewY = 50;
    const overviewHeight = 34;
    const metaWidth = 44;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, overviewY, contentWidth, overviewHeight, 5, 5, 'FD');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text(assignment.title || 'Assignment', margin + 6, overviewY + 10);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const descriptionLines = doc.splitTextToSize(
      'This report presents the current grade distribution and the latest recorded mark for each student in this assignment.',
      contentWidth - metaWidth - 24
    );
    doc.text(descriptionLines, margin + 6, overviewY + 18);
    const metaX = pageWidth - margin - metaWidth - 6 + metaWidth / 2;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Total points', metaX, overviewY + 12, { align: 'center' });
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(`${assignment.totalPoints || 0}`, metaX, overviewY + 22, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('points', metaX, overviewY + 28, { align: 'center' });

    const summaryTopY = 88;
    const summaryCardHeight = 26;
    const cardGap = 4;
    const cardWidth = (contentWidth - cardGap * 3) / 4;
    const summaryCards = [
      { label: 'Students', value: String(rows.length) },
      { label: 'Graded', value: String(grades.length) },
      { label: 'Average grade', value: average != null ? average.toFixed(2) : 'N/A' },
      { label: 'Coverage', value: `${participationRate}%` },
    ];

    summaryCards.forEach((card, index) => {
      const x = margin + index * (cardWidth + cardGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, summaryTopY, cardWidth, summaryCardHeight, 4, 4, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(card.label, x + 5, summaryTopY + 9);
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(card.value, x + 5, summaryTopY + 19);
    });

    const chartY = 134;
    const chartWidth = contentWidth;
    const chartHeight = 64;
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Grade Distribution', margin, chartY - 8);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Latest grade per student grouped across score ranges.', margin, chartY - 2);
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, chartY, chartWidth, chartHeight, 5, 5, 'FD');

    const plotX = margin + 10;
    const plotY = chartY + 10;
    const plotWidth = chartWidth - 20;
    const plotHeight = chartHeight - 22;
    doc.setDrawColor(226, 232, 240);
    for (let i = 0; i <= 3; i += 1) {
      const y = plotY + (plotHeight / 3) * i;
      doc.line(plotX, y, plotX + plotWidth, y);
    }

    const barGap = 8;
    const barWidth = plotWidth / histogram.length - barGap;
    histogram.forEach((bin, index) => {
      const barHeight = (bin.count / maxCount) * (plotHeight - 6);
      const x = plotX + 4 + index * (barWidth + barGap);
      const y = plotY + plotHeight - barHeight;
      doc.setFillColor(15, 118, 110);
      doc.roundedRect(x, y, barWidth, barHeight, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(String(bin.count), x + barWidth / 2, y - 2, { align: 'center' });
      doc.text(
        `${Math.round(bin.labelStart)}-${Math.round(bin.labelEnd)}`,
        x + barWidth / 2,
        chartY + chartHeight - 5,
        { align: 'center' }
      );
    });

    const highlightsY = 206;
    const highlightsHeight = 42;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, highlightsY, contentWidth, highlightsHeight, 5, 5, 'FD');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Highlights', margin + 5, highlightsY + 9);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Highest grade', margin + 5, highlightsY + 19);
    doc.text('Lowest grade', margin + 55, highlightsY + 19);
    doc.text('Coverage', margin + 105, highlightsY + 19);
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(String(highest ?? 'N/A'), margin + 5, highlightsY + 28);
    doc.text(String(lowest ?? 'N/A'), margin + 55, highlightsY + 28);
    doc.text(`${participationRate}%`, margin + 105, highlightsY + 28);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Top students', margin + 5, highlightsY + 37);
    if (topStudents.length === 0) {
      doc.setTextColor(71, 85, 105);
      doc.text('No graded students yet.', margin + 40, highlightsY + 37);
    } else {
      const rankColors = [
        [245, 158, 11],
        [148, 163, 184],
        [180, 83, 9],
      ];
      const topCardsX = margin + 40;
      const topCardsWidth = contentWidth - 45;
      const topCardGap = 4;
      const topCardWidth = (topCardsWidth - topCardGap * 2) / 3;

      topStudents.forEach((student, index) => {
        const cardX = topCardsX + index * (topCardWidth + topCardGap);
        const [r, g, b] = rankColors[index] || [16, 185, 129];
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cardX, highlightsY + 31, topCardWidth, 9, 3, 3, 'FD');
        doc.setFillColor(r, g, b);
        doc.circle(cardX + 5, highlightsY + 35.5, 2.4, 'F');
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        doc.text(String(index + 1), cardX + 5, highlightsY + 36, {
          align: 'center',
          baseline: 'middle',
        });
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        const studentLabel = doc.splitTextToSize(student.studentName, topCardWidth - 18)[0];
        doc.text(studentLabel, cardX + 10, highlightsY + 36, {
          baseline: 'middle',
        });
        doc.setTextColor(15, 118, 110);
        doc.text(
          `${student.grade}/${assignment.totalPoints || 0}`,
          cardX + topCardWidth - 4,
          highlightsY + 36,
          { align: 'right', baseline: 'middle' }
        );
      });
    }

    drawFooter();
    doc.addPage();
    cursorY = 18;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text('Student Marks', margin, cursorY);
    cursorY += 8;

    const drawTableHeader = () => {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, cursorY, contentWidth, 8, 2, 2, 'F');
      doc.setFontSize(9);
      doc.text('Student', margin + 2, cursorY + 5.5);
      doc.text('Email', margin + 70, cursorY + 5.5);
      doc.text('Grade', pageWidth - 56, cursorY + 5.5);
      doc.text('Performance', pageWidth - 22, cursorY + 5.5, { align: 'right' });
      cursorY += 10;
    };

    drawTableHeader();

    rows.forEach((row, index) => {
      if (cursorY > pageHeight - 18) {
        drawFooter();
        doc.addPage();
        cursorY = 18;
        drawTableHeader();
      }

      const studentName = doc.splitTextToSize(row.studentName || 'Student', 60);
      const email = doc.splitTextToSize(row.email || '-', 55);
      const lineHeight = Math.max(studentName.length, email.length, 1) * 5;
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, cursorY - 1, contentWidth, lineHeight + 3, 'F');
      }
      doc.setFontSize(9);
      doc.text(studentName, margin + 2, cursorY + 4);
      doc.text(email, margin + 70, cursorY + 4);
      const performanceText =
        row.grade == null
          ? 'Pending'
          : row.grade >= (assignment.totalPoints || 0) * 0.85
          ? 'Excellent'
          : row.grade >= (assignment.totalPoints || 0) * 0.65
          ? 'Good'
          : 'Needs support';
      doc.text(
        row.grade != null ? `${row.grade}/${assignment.totalPoints || 0}` : 'N/A',
        pageWidth - 56,
        cursorY + 4
      );
      doc.text(performanceText, pageWidth - 22, cursorY + 4, { align: 'right' });
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, cursorY + lineHeight + 1, pageWidth - margin, cursorY + lineHeight + 1);
      cursorY += lineHeight + 4;
    });

    drawFooter();

    const safeTitle = String(assignment.title || 'assignment-report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    doc.save(`${safeTitle || 'assignment-report'}.pdf`);
  };

  const handleExportAssignmentReport = async (assignment) => {
    try {
      setExportingAssignmentId(assignment._id);
      setActionError('');

      let page = 1;
      let allSubmissions = [];
      let totalCount = Infinity;

      while (allSubmissions.length < totalCount) {
        const response = await getSubmissions(assignment._id, undefined, {
          page,
          limit: REPORT_FETCH_LIMIT,
        });
        const pageItems = Array.isArray(response.data) ? response.data : [];
        const headerTotal = Number(response.headers?.['x-total-count']);

        if (Number.isFinite(headerTotal) && headerTotal >= 0) {
          totalCount = headerTotal;
        }

        allSubmissions = allSubmissions.concat(pageItems);

        if (pageItems.length < REPORT_FETCH_LIMIT) {
          break;
        }

        page += 1;
      }

      const latestByStudent = {};
      allSubmissions.forEach((submission) => {
        const key =
          submission.studentId?._id ||
          `name:${String(submission.studentName || 'Student').trim().toLowerCase()}`;
        const submittedAt = submission.submittedAt ? new Date(submission.submittedAt) : new Date(0);

        if (!latestByStudent[key] || submittedAt > latestByStudent[key].submittedAt) {
          latestByStudent[key] = {
            studentName: submission.studentId?.name || submission.studentName || 'Student',
            email: submission.studentId?.email || '',
            grade:
              typeof submission.grade === 'number' && Number.isFinite(submission.grade)
                ? submission.grade
                : null,
            submittedAt,
          };
        }
      });

      const rows = Object.values(latestByStudent).sort((a, b) =>
        a.studentName.localeCompare(b.studentName)
      );

      exportAssignmentReportPdf(assignment, rows);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to export assignment report.');
    } finally {
      setExportingAssignmentId('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
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
      return `${days}d ${hours}h left`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m left`;
    }
    return `${mins}m left`;
  };

  const joinCode = classroom?.joinCode;
  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) {
      return students;
    }

    return students.filter((student) => {
      const name = String(student.name || '').toLowerCase();
      const email = String(student.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [studentSearch, students]);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                navigate(
                  user?.role === 'ASSISTANT'
                    ? '/assistant-dashboard'
                    : '/teacher-dashboard'
                )
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← {t('common.back')}
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                Sa7a7ly
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                {t('common.classroom')}
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

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {!canManage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-700">
            {subscriptionExpired
              ? t('subscription.expired')
              : t('subscription.inactive')}
          </div>
        )}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-200/40 blur-2xl" />
          <div className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-sky-200/40 blur-2xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="Sa7a7ly logo"
                  className="h-12 w-12 rounded-xl bg-white p-2 shadow"
                />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    {t('classroom.classroomTools')}
                  </p>
                  <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                    {t('classroom.manageAssignments')}
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-700">
                {t('classroom.teacherHubBody')}
              </p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">
                  {students.length}
                </p>
                <p className="text-sm text-slate-600">Students</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">{t('classroom.share')}</p>
                <p className="text-sm text-slate-600">{t('classroom.joinCode')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">{t('classroom.quick')}</p>
                <p className="text-sm text-slate-600">{t('classroom.createTasks')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">{t('classroom.track')}</p>
                <p className="text-sm text-slate-600">{t('studentDashboard.progress')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t('classroom.joinCode')}
            </p>
            <p className="mt-2 text-3xl font-mono font-bold text-emerald-700">
              {joinCode}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {t('classroom.shareCode')}
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => navigator.clipboard?.writeText(joinCode)}
            >
              {t('classroom.joinCode')}
            </button>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t('common.assignments')}
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {t('classroom.manageAssignments')}
                </h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/submissions`)}
                  className="px-5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-semibold"
                >
                  {t('common.submissions')}
                </button>
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/grade-on-behalf`)}
                  className="px-5 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-semibold"
                >
                  {t('common.gradeOnBehalf')}
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-semibold"
                  disabled={!canManage}
                >
                  {t('classroom.createAssignment')}
                </button>
              </div>
            </div>

        {actionError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">
            <p className="text-slate-600">{t('common.loading')}</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-slate-600 mb-4">{t('classroom.noAssignmentsTeacher')}</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              {t('classroom.createFirstAssignment')}
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {assignments.map((assignment) => (
              <div
                key={assignment._id}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  {editingAssignmentId === assignment._id ? (
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <h3 className="text-xl font-bold text-slate-900">
                      {assignment.title}
                    </h3>
                  )}
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {assignment.totalPoints} {t('common.points')}
                  </span>
                </div>
                <p className="mt-2 text-slate-600">{assignment.description}</p>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <p>{t('common.due')}: {formatDateTime(assignment.dueDate)}</p>
                  <p>{t('common.timeLeft')}: {getTimeLeft(assignment.dueDate)}</p>
                </div>
                {canManage && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {editingAssignmentId === assignment._id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveTitle(assignment._id)}
                          disabled={savingAssignmentId === assignment._id}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {savingAssignmentId === assignment._id ? t('common.loading') : t('common.update')}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditTitle}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditTitle(assignment)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Edit title
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(assignment)}
                      disabled={deletingAssignmentId === assignment._id}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingAssignmentId === assignment._id ? t('common.loading') : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportAssignmentReport(assignment)}
                      disabled={exportingAssignmentId === assignment._id}
                      className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {exportingAssignmentId === assignment._id
                        ? t('common.loading')
                        : 'Export PDF report'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
          </section>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t('classroom.studentsTitle')}
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                {students.length} Students
              </h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder={t('classroom.searchStudents')}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={fetchStudents}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t('common.refresh')}
              </button>
            </div>
          </div>

          {studentActionMessage && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {studentActionMessage}
            </div>
          )}

          {studentsError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {studentsError}
            </div>
          )}

          {studentsLoading ? (
            <div className="py-8 text-center text-slate-600">{t('common.loading')}</div>
          ) : students.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
              {t('classroom.noStudentsYet')}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
              {t('classroom.noStudentsMatch')}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border border-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Email</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Role</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student._id} className="border-t border-slate-200">
                      <td className="px-3 py-2 text-slate-900">{student.name || '-'}</td>
                      <td className="px-3 py-2 text-slate-700">{student.email || '-'}</td>
                      <td className="px-3 py-2 text-slate-700">{student.role || 'STUDENT'}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(student)}
                          disabled={removingStudentId === student._id}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {removingStudentId === student._id
                            ? t('common.loading')
                            : t('common.remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <CreateAssignmentModal
          classroomId={classroomId}
          userId={user._id}
          onClose={() => setShowModal(false)}
          onCreate={handleCreateAssignment}
        />
      )}
    </div>
  );
};

export default ClassroomPageTeacher;
