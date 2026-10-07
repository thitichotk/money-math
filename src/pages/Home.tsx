import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useTitle } from '../ui/hooks';
import { CALCULATORS } from '../ui/Layout';

/** Every calculator, written as the question it answers. */
export default function HomePage() {
  const { t } = useTranslation();
  useTitle(t('home.title'));
  return (
    <section className="home" aria-labelledby="home-title">
      <h1 id="home-title">{t('home.title')}</h1>
      <p className="lede">{t('home.lede')}</p>
      <ul className="questions">
        {CALCULATORS.map((calc) => (
          <li key={calc.path}>
            <Link to={calc.path}>
              <span className="q">{t(`home.questions.${calc.key}`)}</span>
              <span className="name">{t(`nav.${calc.key}`)}</span>
              <span className="d">{t(`home.details.${calc.key}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
