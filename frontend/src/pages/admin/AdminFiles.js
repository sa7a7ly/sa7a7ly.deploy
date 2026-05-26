import React, { useCallback, useEffect, useMemo, useState } from 'react';
import logo from '../../images/image.png';
import { useI18n } from '../../context/I18nContext';
import { getLocalStoredFiles, moveStoredFilesToCloudinary } from '../../services/api';

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const AdminFiles = () => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [resultById, setResultById] = useState({});
  const [moving, setMoving] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLocalStoredFiles();
      const items = Array.isArray(res.data?.files) ? res.data.files : [];
      setFiles(items);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const allIds = useMemo(() => files.map((f) => f._id), [files]);
  const allSelected = useMemo(
    () => allIds.length > 0 && allIds.every((id) => selectedIds.has(id)),
    [allIds, selectedIds]
  );

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMove = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || moving) return;

    try {
      setMoving(true);
      setError('');
      setSuccess('');
      setResultById({});

      const res = await moveStoredFilesToCloudinary(ids);
      const results = Array.isArray(res.data?.results) ? res.data.results : [];
      const nextMap = {};
      results.forEach((r) => {
        if (r?.fileId) nextMap[r.fileId] = r;
      });
      setResultById(nextMap);

      const hasErrors = results.some((r) => !r?.ok);
      setSuccess(hasErrors ? '' : 'All selected files moved successfully.');
      setError(hasErrors ? 'Some files failed to move. See per-file status.' : '');

      await fetchFiles();
      setSelectedIds(new Set());
    } catch (err) {
      setSuccess('');
      setError(err.response?.data?.message || 'Failed to move files');
    } finally {
      setMoving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-200/40 blur-2xl" />
        <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Sa7a7ly logo" className="h-11 w-11 rounded-xl bg-white p-2 shadow" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">Admin</p>
                <h2 className="text-3xl font-bold text-slate-900">{t('common.files')}</h2>
              </div>
            </div>
            <p className="mt-3 text-slate-700">
              Review files currently stored on the server and move them to Cloudinary.
            </p>
          </div>
          <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={fetchFiles}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={loading || moving}
            >
              {t('common.refresh')}
            </button>
            <button
              type="button"
              onClick={handleMove}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={moving || selectedIds.size === 0}
            >
              {moving ? t('common.loading') : 'Move to Cloudinary'}
            </button>
          </div>
        </div>
      </div>

      {(error || success) && (
        <div className="space-y-3">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            Select All ({selectedIds.size}/{files.length})
          </label>
          <div className="text-sm text-slate-600">Local files: {files.length}</div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-slate-600">{t('common.loading')}</div>
        ) : files.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-600">No local files found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {files.map((file) => {
              const result = resultById[file._id];
              const selected = selectedIds.has(file._id);
              return (
                <div key={file._id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleOne(file._id)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {file.originalName || file._id}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Type: {file.kind} • Size: {formatBytes(file.sizeBytes)} • Exists:{' '}
                        {file.exists ? 'Yes' : 'No'}
                      </p>
                      {file.studentName ? (
                        <p className="text-sm text-slate-600">Student: {file.studentName}</p>
                      ) : null}
                      <p className="text-xs text-slate-500">
                        Status: {file.status}
                        {file.lastError ? ` • ${file.lastError}` : ''}
                      </p>
                      {result ? (
                        <p
                          className={`mt-2 text-xs font-semibold ${
                            result.ok ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {result.ok
                            ? 'Moved successfully'
                            : `Failed: ${result.error || 'Unknown error'}`}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {file.assignmentId ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        Assignment
                      </span>
                    ) : null}
                    {file.submissionId ? (
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                        Submission
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminFiles;

