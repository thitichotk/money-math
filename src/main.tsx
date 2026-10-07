import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './i18n/config';
import './styles/tokens.css';
import './styles/components.css';
import './styles/app.css';

import App from './app/App';

// The old site used hash URLs (/#/calculators/loan); turn them into real paths before routing.
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
