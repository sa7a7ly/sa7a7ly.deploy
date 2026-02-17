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

const parseFeedbackSections = (feedbackText) => {
  const text = String(feedbackText || '');
  const questionsMatch = text.match(
    /Question Breakdown:\s*([\s\S]*?)(?:\n\s*Overall Summary:|$)/i
  );
  const summaryMatch = text.match(
    /Overall Summary:\s*([\s\S]*?)(?:\n\s*Major Mistakes:|\n\s*How To Improve:|$)/i
  );
  const mistakesMatch = text.match(
    /Major Mistakes:\s*([\s\S]*?)(?:\n\s*How To Improve:|$)/i
  );
  const improvementsMatch = text.match(/How To Improve:\s*([\s\S]*?)$/i);

  const toList = (block) =>
    String(block || '')
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);

  const parseQuestions = (block) => {
    const src = String(block || '').trim();
    if (!src) return [];
    const chunks = src
      .split(/\n(?=Q\d+[^\n]*\n)/i)
      .map((s) => s.trim())
      .filter(Boolean);

    return chunks.map((chunk) => {
      const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
      const questionNumber = lines[0] || 'Question';
      const maxMarks = (chunk.match(/Max Marks:\s*([^\n]+)/i) || [])[1] || 'N/A';
      const studentMarks =
        (chunk.match(/Your Marks:\s*([^\n]+)/i) || [])[1] || 'N/A';
      const marksLost = (chunk.match(/Marks Lost:\s*([^\n]+)/i) || [])[1] || 'N/A';
      const reason = (chunk.match(/Reason:\s*([\s\S]*)$/i) || [])[1] || '';
      return {
        questionNumber,
        maxMarks: String(maxMarks).trim(),
        studentMarks: String(studentMarks).trim(),
        marksLost: String(marksLost).trim(),
        reason: String(reason).trim(),
      };
    });
  };

  return {
    questions: parseQuestions(questionsMatch ? questionsMatch[1] : ''),
    summary: summaryMatch ? summaryMatch[1].trim() : '',
    mistakes: toList(mistakesMatch ? mistakesMatch[1] : ''),
    improvements: toList(improvementsMatch ? improvementsMatch[1] : ''),
    raw: text.trim(),
  };
};

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
  const [gradingStep, setGradingStep] = useState(0);
  const [gameMode, setGameMode] = useState('catch');
  const [gameScore, setGameScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 });
  const [quizA, setQuizA] = useState(3);
  const [quizB, setQuizB] = useState(7);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizScore, setQuizScore] = useState(0);
  const [bestQuizScore, setBestQuizScore] = useState(0);
  const [xoBoard, setXoBoard] = useState(Array(9).fill(null));
  const [xoWins, setXoWins] = useState(0);
  const [xoLosses, setXoLosses] = useState(0);
  const [xoDraws, setXoDraws] = useState(0);
  const [xoMessage, setXoMessage] = useState('Your turn');
  const [reactionState, setReactionState] = useState('idle');
  const [reactionStart, setReactionStart] = useState(0);
  const [reactionBest, setReactionBest] = useState(null);
  const [reactionMessage, setReactionMessage] = useState('Press start');
  const fileInputRef = useRef(null);
  const reactionTimeoutRef = useRef(null);
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
  }, [assignmentId, user?._id, t]);

  useEffect(() => {
    if (!loading) {
      setGradingStep(0);
      return undefined;
    }

    const interval = setInterval(() => {
      setGradingStep((prev) => (prev + 1) % 4);
    }, 1500);

    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      setGameScore(0);
      setQuizScore(0);
      setQuizAnswer('');
      setReactionState('idle');
      setReactionMessage('Press start');
      setTargetPos({ x: 50, y: 50 });
      return undefined;
    }

    setGameScore(0);
    setQuizScore(0);
    setQuizAnswer('');
    setGameMode('catch');
    setQuizA(1 + Math.floor(Math.random() * 20));
    setQuizB(1 + Math.floor(Math.random() * 20));
    setXoBoard(Array(9).fill(null));
    setXoMessage('Your turn');
    setReactionState('idle');
    setReactionMessage('Press start');
    setTargetPos({ x: 50, y: 50 });

    const mover = setInterval(() => {
      setTargetPos({
        x: 12 + Math.random() * 76,
        y: 18 + Math.random() * 66,
      });
    }, 900);

    return () => clearInterval(mover);
  }, [loading]);

  useEffect(() => {
    return () => {
      if (reactionTimeoutRef.current) {
        clearTimeout(reactionTimeoutRef.current);
      }
    };
  }, []);

  const validateAndSetPdf = (file) => {
    if (!file) {
      return;
    }
    if (file.type === 'application/pdf') {
      setPdf(file);
      setError('');
      return;
    }
    setPdf(null);
    setError(t('common.uploadPdf'));
  };

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
    validateAndSetPdf(files && files[0] ? files[0] : null);
  };

  const handleFileChange = (e) => {
    validateAndSetPdf(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pdf) {
      setError(t('common.uploadPdf'));
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
  const feedbackSections = parseFeedbackSections(result?.feedback);

  const gradingMessages = [
    'Reading your PDF and understanding answers...',
    'Comparing with model answer carefully...',
    'Calculating marks and checking each question...',
    'Preparing feedback that helps you improve...',
  ];

  const handleCatchTarget = () => {
    setGameScore((prev) => {
      const next = prev + 1;
      setBestScore((best) => (next > best ? next : best));
      return next;
    });
    setTargetPos({
      x: 12 + Math.random() * 76,
      y: 18 + Math.random() * 66,
    });
  };

  const nextQuizQuestion = () => {
    setQuizA(1 + Math.floor(Math.random() * 20));
    setQuizB(1 + Math.floor(Math.random() * 20));
    setQuizAnswer('');
  };

  const handleQuizSubmit = (e) => {
    e.preventDefault();
    const parsed = Number(quizAnswer);
    if (!Number.isFinite(parsed)) return;
    if (parsed === quizA + quizB) {
      setQuizScore((prev) => {
        const next = prev + 1;
        setBestQuizScore((best) => (next > best ? next : best));
        return next;
      });
    }
    nextQuizQuestion();
  };

  const getWinner = (board) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  };

  const resetXo = () => {
    setXoBoard(Array(9).fill(null));
    setXoMessage('Your turn');
  };

  const handleXoMove = (idx) => {
    if (xoBoard[idx] || getWinner(xoBoard)) return;

    const nextBoard = [...xoBoard];
    nextBoard[idx] = 'X';
    const playerWinner = getWinner(nextBoard);
    if (playerWinner === 'X') {
      setXoBoard(nextBoard);
      setXoWins((v) => v + 1);
      setXoMessage('You win! Play again.');
      return;
    }

    const empty = nextBoard
      .map((cell, i) => (cell ? null : i))
      .filter((i) => i != null);
    if (empty.length === 0) {
      setXoBoard(nextBoard);
      setXoDraws((v) => v + 1);
      setXoMessage('Draw! Play again.');
      return;
    }

    const aiIndex = empty[Math.floor(Math.random() * empty.length)];
    nextBoard[aiIndex] = 'O';
    const aiWinner = getWinner(nextBoard);
    if (aiWinner === 'O') {
      setXoBoard(nextBoard);
      setXoLosses((v) => v + 1);
      setXoMessage('AI wins. Try again.');
      return;
    }

    const emptyAfterAi = nextBoard.some((cell) => cell == null);
    setXoBoard(nextBoard);
    if (!emptyAfterAi) {
      setXoDraws((v) => v + 1);
      setXoMessage('Draw! Play again.');
    } else {
      setXoMessage('Your turn');
    }
  };

  const startReactionRound = () => {
    if (reactionTimeoutRef.current) {
      clearTimeout(reactionTimeoutRef.current);
    }
    setReactionState('wait');
    setReactionMessage('Wait for GO...');
    reactionTimeoutRef.current = setTimeout(() => {
      setReactionState('go');
      setReactionStart(performance.now());
      setReactionMessage('GO! Tap now');
    }, 700 + Math.random() * 1600);
  };

  const handleReactionClick = () => {
    if (reactionState === 'idle') {
      startReactionRound();
      return;
    }
    if (reactionState === 'wait') {
      setReactionState('idle');
      setReactionMessage('Too early! Press start');
      return;
    }
    if (reactionState === 'go') {
      const time = Math.max(1, Math.round(performance.now() - reactionStart));
      setReactionBest((prev) => (prev == null || time < prev ? time : prev));
      setReactionState('idle');
      setReactionMessage(`${time} ms - Press start`);
    }
  };

  const gradingOverlay = loading ? (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-white p-8 shadow-2xl">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-200/70 blur-xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-sky-200/70 blur-xl" />

          <div className="relative">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
              <span className="text-2xl animate-pulse">AI</span>
            </div>

            <h3 className="text-center text-2xl font-bold text-slate-900">
              Grading in progress
            </h3>
            <p className="mt-2 text-center text-sm text-slate-600">
              {gradingMessages[gradingStep]}
            </p>

            <div className="mt-6">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-emerald-500" />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGameMode('catch')}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                      gameMode === 'catch'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    Catch Star
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameMode('math')}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                      gameMode === 'math'
                        ? 'bg-sky-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    Quick Math
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameMode('xo')}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                      gameMode === 'xo'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    X O
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameMode('reaction')}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                      gameMode === 'reaction'
                        ? 'bg-rose-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    Reaction
                  </button>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {gameMode === 'catch'
                    ? `Score: ${gameScore} | Best: ${bestScore}`
                    : gameMode === 'math'
                    ? `Score: ${quizScore} | Best: ${bestQuizScore}`
                    : gameMode === 'xo'
                    ? `W ${xoWins} / L ${xoLosses} / D ${xoDraws}`
                    : `Best: ${reactionBest == null ? '-' : `${reactionBest}ms`}`}
                </span>
              </div>
              {gameMode === 'catch' ? (
                <div className="relative h-40 rounded-xl border border-dashed border-slate-300 bg-white">
                  <button
                    type="button"
                    onClick={handleCatchTarget}
                    className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 text-lg shadow-md transition hover:scale-110"
                    style={{ left: `${targetPos.x}%`, top: `${targetPos.y}%` }}
                    aria-label="Catch star"
                  >
                    ★
                  </button>
                </div>
              ) : gameMode === 'math' ? (
                <form
                  onSubmit={handleQuizSubmit}
                  className="rounded-xl border border-dashed border-slate-300 bg-white p-4"
                >
                  <p className="text-sm font-semibold text-slate-800">
                    Solve quickly: {quizA} + {quizB} = ?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      value={quizAnswer}
                      onChange={(e) => setQuizAnswer(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Your answer"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                    >
                      Check
                    </button>
                  </div>
                </form>
              ) : gameMode === 'xo' ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">You (X) vs AI (O)</p>
                    <button
                      type="button"
                      onClick={resetXo}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Reset
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-slate-600">{xoMessage}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {xoBoard.map((cell, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleXoMove(idx)}
                        className="h-12 rounded-lg border border-slate-200 text-lg font-bold text-slate-800 hover:bg-slate-50"
                      >
                        {cell || ''}
                      </button>
                    ))}
                  </div>
                </div>
              ) : gameMode === 'reaction' ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">Reaction Tap</p>
                  <p className="mt-1 text-xs text-slate-600">{reactionMessage}</p>
                  <button
                    type="button"
                    onClick={handleReactionClick}
                    className={`mt-4 h-20 w-full rounded-xl text-lg font-bold text-white transition ${
                      reactionState === 'go'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : reactionState === 'wait'
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {reactionState === 'idle'
                      ? 'Start'
                      : reactionState === 'wait'
                      ? 'Wait...'
                      : 'TAP'}
                  </button>
                </div>
              ) : null}
            </div>

            <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              keep playing while grading
            </p>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (result) {
    return (
      <div className="min-h-screen bg-slate-50">
        {gradingOverlay}
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

        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{t('submit.resultTitle')}</h2>
                <p className="mt-1 text-sm text-slate-600">{t('submit.gradedByAi')}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  {t('submit.grade')}
                </p>
                <p className="text-2xl font-bold text-emerald-700">
                  {result.grade}
                  {assignment?.totalPoints != null ? ` / ${assignment.totalPoints}` : ''}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.35fr]">
              <div className="space-y-4">
                {infoMessage && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
                    {infoMessage}
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p>{t('common.due')}: {formatDateTime(assignment?.dueDate)}</p>
                  <p>{t('common.timeLeft')}: {getTimeLeft(assignment?.dueDate)}</p>
                </div>

                {resubmissionRequest?.status === 'PENDING' && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-700">
                    {t('submit.resubmitPending')}
                  </div>
                )}
                {resubmissionRequest?.status === 'DECLINED' && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                    {t('submit.resubmitDeclined')}
                  </div>
                )}
                {resubmissionRequest?.status === 'APPROVED' && !resubmissionRequest.used && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                    {t('submit.resubmitApproved')}
                  </div>
                )}

                {(!resubmissionRequest ||
                  resubmissionRequest.status === 'DECLINED' ||
                  (resubmissionRequest.status === 'APPROVED' &&
                    resubmissionRequest.used)) && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
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

                <div className="grid gap-3 sm:grid-cols-2">
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

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">{t('submit.feedback')}</p>
                {feedbackSections.questions.length > 0 && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">
                      Questions Feedback
                    </p>
                    <div className="mt-2 space-y-2">
                      {feedbackSections.questions.map((q) => (
                        <div
                          key={`${q.questionNumber}-${q.reason}`}
                          className="rounded-lg border border-indigo-100 bg-white p-3"
                        >
                          <p className="text-sm font-semibold text-slate-900">{q.questionNumber}</p>
                          <p className="mt-1 text-xs text-slate-700">
                            Max: <span className="font-semibold">{q.maxMarks}</span> | Your Marks:{' '}
                            <span className="font-semibold">{q.studentMarks}</span> | Lost:{' '}
                            <span className="font-semibold">{q.marksLost}</span>
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {q.reason || 'No reason provided.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
                    Summary
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {feedbackSections.summary || 'No summary provided.'}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                    Mistakes
                  </p>
                  {feedbackSections.mistakes.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                      {feedbackSections.mistakes.map((item, idx) => (
                        <li key={`${idx}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm leading-6 text-slate-700">No major mistakes listed.</p>
                  )}
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    Improvement Advice
                  </p>
                  {feedbackSections.improvements.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                      {feedbackSections.improvements.map((item, idx) => (
                        <li key={`${idx}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm leading-6 text-slate-700">No improvement advice listed.</p>
                  )}
                </div>
                {!feedbackSections.summary &&
                  feedbackSections.mistakes.length === 0 &&
                  feedbackSections.improvements.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {feedbackSections.raw || 'No feedback provided.'}
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {gradingOverlay}
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
