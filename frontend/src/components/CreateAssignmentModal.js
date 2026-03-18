import React, { useState } from 'react';
import { useI18n } from '../context/I18nContext';

const CreateAssignmentModal = ({ classroomId, userId, onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    totalPoints: '',
    pdf: null,
    dueDate: '',
    resultVisibility: 'IMMEDIATE',
    gradingProfile: 'GENERAL',
  });
  const [loading, setLoading] = useState(false);
  const [formNotice, setFormNotice] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const { t } = useI18n();

  const getInputClassName = (hasError) =>
    `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition ${
      hasError
        ? 'border-red-400 bg-red-50/70 focus:ring-red-500'
        : 'border-slate-300 focus:ring-emerald-500'
    }`;

  const validateForm = () => {
    const nextErrors = {};
    const title = formData.title.trim();
    const totalPoints = Number(formData.totalPoints);
    const requiresDueDate = formData.resultVisibility === 'AFTER_DEADLINE';

    if (!title) {
      nextErrors.title = t('createAssignmentErrors.titleRequired');
    }

    if (formData.totalPoints === '') {
      nextErrors.totalPoints = t('createAssignmentErrors.totalPointsRequired');
    } else if (!Number.isFinite(totalPoints) || totalPoints <= 0) {
      nextErrors.totalPoints = t('createAssignmentErrors.totalPointsInvalid');
    }

    if (requiresDueDate && !formData.dueDate) {
      nextErrors.dueDate = t('createAssignmentErrors.dueDateRequired');
    }

    if (!formData.pdf) {
      nextErrors.pdf = t('createAssignmentErrors.modelAnswerRequired');
    }

    setFieldErrors(nextErrors);
    setFormNotice(
      Object.keys(nextErrors).length > 0 ? t('authErrors.missingFields') : ''
    );
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    if (name === 'resultVisibility' && value !== 'AFTER_DEADLINE') {
      setFieldErrors((prev) => ({ ...prev, dueDate: '' }));
    }
    if (formNotice) setFormNotice('');
    if (submitError) setSubmitError('');
  };

  const handleFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      pdf: e.target.files[0],
    }));
    setFieldErrors((prev) => ({ ...prev, pdf: '' }));
    if (formNotice) setFormNotice('');
    if (submitError) setSubmitError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const formDataToSend = new FormData();
    formDataToSend.append('title', formData.title.trim());
    formDataToSend.append('description', formData.description.trim());
    formDataToSend.append('totalPoints', formData.totalPoints);
    formDataToSend.append('classroomId', classroomId);
    formDataToSend.append('createdBy', userId);
    if (formData.dueDate) {
      formDataToSend.append('dueDate', formData.dueDate);
    }
    formDataToSend.append('resultVisibility', formData.resultVisibility);
    formDataToSend.append('gradingProfile', formData.gradingProfile);
    if (formData.pdf) {
      formDataToSend.append('pdf', formData.pdf);
    }

    try {
      await onCreate(formDataToSend);
      setFieldErrors({});
      setFormNotice('');
    } catch (err) {
      setSubmitError(
        err?.response?.data?.message || t('createAssignmentErrors.createFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-4 sm:items-center sm:py-6">
      <div className="flex w-full max-w-2xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
              {t('createAssignment.title')}
            </p>
            <h2 className="text-2xl font-bold text-slate-900">
              {t('createAssignment.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t('common.close')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-6 space-y-5" noValidate>
          {formNotice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">{t('auth.validationTitle')}</p>
              <p className="mt-1">{formNotice}</p>
            </div>
          )}

          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-semibold">{t('createAssignment.issueTitle')}</p>
              <p className="mt-1">{submitError}</p>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('common.title')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={getInputClassName(Boolean(fieldErrors.title))}
              placeholder={t('createAssignment.titlePlaceholder')}
              aria-invalid={Boolean(fieldErrors.title)}
            />
            {fieldErrors.title && (
              <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('common.description')}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={getInputClassName(Boolean(fieldErrors.description))}
              placeholder={t('createAssignment.descriptionPlaceholder')}
              rows="3"
            />
            <p className="mt-2 text-sm text-slate-500">
              {t('createAssignment.descriptionHelp')}
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('createAssignment.totalPoints')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="totalPoints"
              value={formData.totalPoints}
              onChange={handleChange}
              className={getInputClassName(Boolean(fieldErrors.totalPoints))}
              placeholder="100"
              min="1"
              aria-invalid={Boolean(fieldErrors.totalPoints)}
            />
            {fieldErrors.totalPoints && (
              <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.totalPoints}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('createAssignment.dueDate')}
              {formData.resultVisibility === 'AFTER_DEADLINE' ? (
                <span className="text-red-500"> *</span>
              ) : null}
            </label>
            <input
              type="datetime-local"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleChange}
              className={getInputClassName(Boolean(fieldErrors.dueDate))}
              aria-invalid={Boolean(fieldErrors.dueDate)}
            />
            <p className="mt-2 text-sm text-slate-500">
              {t('createAssignment.dueDateHelp')}
            </p>
            {fieldErrors.dueDate && (
              <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.dueDate}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('createAssignment.resultVisibility')}
            </label>
            <select
              name="resultVisibility"
              value={formData.resultVisibility}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="IMMEDIATE">
                {t('createAssignment.visibilityImmediate')}
              </option>
              <option value="AFTER_DEADLINE">
                {t('createAssignment.visibilityAfterDeadline')}
              </option>
              <option value="AFTER_REVIEW">
                {t('createAssignment.visibilityAfterReview')}
              </option>
            </select>
            <p className="mt-2 text-sm text-slate-500">
              {t('createAssignment.resultVisibilityHelp')}
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('createAssignment.gradingProfile')}
            </label>
            <select
              name="gradingProfile"
              value={formData.gradingProfile}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="GENERAL">
                {t('createAssignment.gradingGeneral')}
              </option>
              <option value="ARABIC_ESSAY">
                {t('createAssignment.gradingArabicEssay')}
              </option>
            </select>
            <p className="mt-2 text-sm text-slate-500">
              {t('createAssignment.gradingProfileHelp')}
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('createAssignment.modelAnswer')}
            </label>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-700"
              />
              <p className="mt-2 text-sm text-slate-500">
                {t('landing.supportBody')}
              </p>
            </div>
            {fieldErrors.pdf && (
              <p className="mt-2 text-sm font-medium text-red-600">{fieldErrors.pdf}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('common.create')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg font-semibold hover:bg-slate-50 transition"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAssignmentModal;
