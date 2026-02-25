import React from 'react';
import logo from '../images/image.png';
import { useI18n } from '../context/I18nContext';

const Footer = () => {
  const { t } = useI18n();

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
              <p className="text-lg font-bold">{t('footer.brandTitle')}</p>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            {t('footer.brandBody')}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">{t('footer.aboutTitle')}</p>
          <p className="text-sm text-slate-300">
            {t('footer.aboutBody')}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">{t('footer.joinTitle')}</p>
          <p className="text-sm text-slate-300">
            {t('footer.joinBody')}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">{t('footer.contactTitle')}</p>
          <div className="space-y-2 text-sm text-slate-300">
            <a
              href="https://wa.me/201095490525"
              className="block hover:text-white"
              rel="noreferrer"
              target="_blank"
            >
              {t('footer.whatsapp')}
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
          © {new Date().getFullYear()} {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
