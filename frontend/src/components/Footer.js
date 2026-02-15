import React from 'react';
import logo from '../images/image.png';

const Footer = () => {
  return (
    <footer className="bg-slate-900 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-12 grid gap-8 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Sa7a7ly logo"
              className="h-10 w-10 rounded-xl bg-white p-2"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Sa7a7ly
              </p>
              <p className="text-lg font-bold">Smarter Learning</p>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            We help students and teachers simplify assignments, improve learning,
            and achieve higher grades with AI-powered feedback.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Who We Are</p>
          <p className="text-sm text-slate-300">
            Sa7a7ly is an education web app built to make classrooms more
            efficient and outcomes more transparent for everyone.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Join Us</p>
          <p className="text-sm text-slate-300">
            Ready to modernize your classroom? Join Sa7a7ly and give your
            students faster, clearer feedback and better results.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Contact</p>
          <div className="space-y-2 text-sm text-slate-300">
            <a
              href="https://wa.me/201095490525"
              className="block hover:text-white"
              rel="noreferrer"
              target="_blank"
            >
              WhatsApp: 01095490525
            </a>
            <a
              href="https://www.instagram.com/sa7a7ly?igsh=MWwxbGRsdnM1NGtzdg=="
              className="block hover:text-white"
              rel="noreferrer"
              target="_blank"
            >
              Instagram
            </a>
            <a
              href="#"
              className="block hover:text-white"
              rel="noreferrer"
              target="_blank"
            >
              YouTube
            </a>
            <a
              href="#"
              className="block hover:text-white"
              rel="noreferrer"
              target="_blank"
            >
              Facebook
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-slate-400">
          © {new Date().getFullYear()} Sa7a7ly. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
