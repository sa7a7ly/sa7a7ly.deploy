import React, { useState } from 'react';

const CreateAssignmentModal = ({ classroomId, userId, onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    totalPoints: '',
    pdf: null,
  });
  const [loading, setLoading] = useState(false);

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
              New Assignment
            </p>
            <h2 className="text-2xl font-bold text-slate-900">
              Create Assignment
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
              Title
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
              Description
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
              Add clear instructions to help students complete the task.
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              Total Points
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
              Model Answer PDF
            </label>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-700"
              />
              <p className="mt-2 text-sm text-slate-500">
                Upload an optional PDF to help students understand expectations.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAssignmentModal;
