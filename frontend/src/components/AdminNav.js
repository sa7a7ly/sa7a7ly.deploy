import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const AdminNav = () => {
  const location = useLocation();
  const links = [
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/teachers', label: 'Teachers' },
    { to: '/admin/classrooms', label: 'Classrooms' },
    { to: '/admin/assignments', label: 'Assignments' },
    { to: '/admin/submissions', label: 'Submissions' },
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
