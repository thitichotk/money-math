import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

import { TEXT_SCALES, usePreferencesStore, type ThemeChoice } from '../features/preferences/store';

export const CALCULATORS = [
  { path: '/loan', key: 'loan' },
  { path: '/savings', key: 'savings' },
  { path: '/fixed', key: 'fixed' },
  { path: '/tiered', key: 'tiered' },
  { path: '/future-value', key: 'futureValue' },
  { path: '/npv', key: 'npv' },
] as const;

function Toggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; aria?: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="toggles" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} aria-label={option.aria} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Layout() {
  const { t, i18n } = useTranslation();
  const { theme, textScale, setTheme, setTextScale } = usePreferencesStore();
  const language = i18n.resolvedLanguage === 'th' ? 'th' : 'en';
  const dark =
    theme === 'dark' ||
    (theme === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    root.style.setProperty('--font-scale', String(TEXT_SCALES[textScale]));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121417' : '#F7F7F5');
  }, [theme, textScale, dark]);

  return (
    <>
      <a className="skip" href="#main">{t('nav.skip')}</a>
      <div className="wrap">
        <header className="top">
          <NavLink to="/" className="brand" aria-label={t('nav.home')}>
            <img src={dark ? '/logo-inverse.svg' : '/logo.svg'} alt="Money-Math" width="180" height="36" />
          </NavLink>
          <nav aria-label={t('nav.calculators')}>
            {CALCULATORS.map((calc) => (
              <NavLink key={calc.path} to={calc.path}>
                {t(`nav.${calc.key}`)}
              </NavLink>
            ))}
          </nav>
          <div className="right">
            <Toggle
              label={t('nav.textSize')}
              value={textScale}
              onChange={setTextScale}
              options={[
                { value: 'normal', label: 'ก' },
                { value: 'large', label: 'ก+', aria: t('nav.largerText') },
              ]}
            />
            <Toggle<ThemeChoice>
              label={t('nav.theme')}
              value={dark ? 'dark' : 'light'}
              onChange={setTheme}
              options={[
                { value: 'light', label: t('nav.light') },
                { value: 'dark', label: t('nav.dark') },
              ]}
            />
            <Toggle
              label={t('nav.language')}
              value={language}
              onChange={(lng) => void i18n.changeLanguage(lng)}
              options={[
                { value: 'th', label: 'ไทย' },
                { value: 'en', label: 'EN' },
              ]}
            />
          </div>
        </header>
        <main id="main">
          <Outlet />
        </main>
        <footer className="site">
          <span>{t('footer.tagline')}</span>
          <nav aria-label={t('footer.links')}>
            <NavLink to="/about">{t('nav.about')}</NavLink>
            <a href="https://github.com/thitichotk/money-math" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </footer>
      </div>
    </>
  );
}
