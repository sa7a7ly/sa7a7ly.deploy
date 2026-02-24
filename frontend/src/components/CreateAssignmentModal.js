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
  const { t } = useI18n();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      pdf: e.target.files[0],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formDataToSend = new FormData();
    formDataToSend.append('title', formData.title);
    formDataToSend.append('description', formData.description);
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200">
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
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('common.title')}
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Assignment title"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('common.description')}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Assignment description"
              rows="3"
            />
            <p className="mt-2 text-sm text-slate-500">
              {t('createAssignment.descriptionHelp')}
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('createAssignment.totalPoints')}
            </label>
            <input
              type="number"
              name="totalPoints"
              value={formData.totalPoints}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="100"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              {t('createAssignment.dueDate')}
            </label>
            <input
              type="datetime-local"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="mt-2 text-sm text-slate-500">
              {t('createAssignment.dueDateHelp')}
            </p>
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
