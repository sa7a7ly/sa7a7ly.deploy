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
    <div className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-3 flex gap-4">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-2 rounded-lg font-semibold ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-indigo-700 hover:bg-indigo-50'
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
