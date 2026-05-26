import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';

const AdminNav = () => {
  const location = useLocation();
  const { t } = useI18n();
  const links = [
    { to: '/admin/users', label: t('common.users') },
    { to: '/admin/teachers', label: t('common.teachers') },
    { to: '/admin/classrooms', label: t('common.classrooms') },
    { to: '/admin/assignments', label: t('common.assignments') },
    { to: '/admin/submissions', label: t('common.submissions') },
    { to: '/admin/files', label: t('common.files') },
  ];

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap gap-3">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default AdminNav;
