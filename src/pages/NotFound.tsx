import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useTitle } from '../ui/hooks';

export default function NotFoundPage() {
  const { t } = useTranslation();
  useTitle(t('notFound.title'));
  return (
    <article className="prose">
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.body')}</p>
      <p>
        <Link to="/">{t('notFound.home')}</Link>
      </p>
    </article>
  );
}
