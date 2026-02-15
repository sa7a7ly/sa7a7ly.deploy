import React from 'react';
import { useI18n } from '../context/I18nContext';

const LanguageToggle = () => {
  const { lang, toggleLang } = useI18n();
  const isArabic = lang === 'ar';

  return (
    <button
      onClick={toggleLang}
      className="fixed bottom-6 right-6 z-50 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg hover:bg-slate-50"
      aria-label="Toggle language"
    >
      {isArabic ? 'English' : 'العربية'}
    </button>
  );
};

export default LanguageToggle;
