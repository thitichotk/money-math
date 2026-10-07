import { useTranslation } from 'react-i18next';

import { useTitle } from '../ui/hooks';

export default function AboutPage() {
  const { t } = useTranslation();
  useTitle(t('about.title'));
  const list = (key: string) => (t(key, { returnObjects: true }) as string[]).map((item) => <li key={item}>{item}</li>);
  return (
    <article className="prose">
      <h1>{t('about.title')}</h1>
      <p>{t('about.intro')}</p>
      <h2>{t('about.rulesTitle')}</h2>
      <ul>{list('about.rules')}</ul>
      <h2>{t('about.privacyTitle')}</h2>
      <p>{t('about.privacy')}</p>
      <h2>{t('about.dataTitle')}</h2>
      <p>{t('about.data')}</p>
      <h2>{t('about.disclaimerTitle')}</h2>
      <p>{t('about.disclaimer')}</p>
      <h2>{t('about.contactTitle')}</h2>
      <p>
        {t('about.contact')} <a href="mailto:thitichot.k@ku.th">thitichot.k@ku.th</a> ·{' '}
        <a href="https://github.com/thitichotk/money-math">github.com/thitichotk/money-math</a>
      </p>
    </article>
  );
}
