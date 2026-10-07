import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AboutPage from '../pages/About';
import FixedPage from '../pages/Fixed';
import FutureValuePage from '../pages/FutureValue';
import HomePage from '../pages/Home';
import LoanPage from '../pages/Loan';
import NotFoundPage from '../pages/NotFound';
import NpvPage from '../pages/Npv';
import SavingsPage from '../pages/Savings';
import TieredPage from '../pages/Tiered';
import { Layout } from '../ui/Layout';

// Addresses from the old Basic Financial Calculator, so bookmarks keep working.
const MOVED: Record<string, string> = {
  '/calculators/loan': '/loan',
  '/calculators/deposits/savings': '/savings',
  '/calculators/deposits/fixed': '/fixed',
  '/calculators/deposits/tiered': '/tiered',
  '/calculators/deposits': '/savings',
  '/calculators/time-value/future-value': '/future-value',
  '/calculators/time-value/net-present-value': '/npv',
  '/calculators/time-value': '/future-value',
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="loan" element={<LoanPage />} />
          <Route path="savings" element={<SavingsPage />} />
          <Route path="fixed" element={<FixedPage />} />
          <Route path="tiered" element={<TieredPage />} />
          <Route path="future-value" element={<FutureValuePage />} />
          <Route path="npv" element={<NpvPage />} />
          <Route path="about" element={<AboutPage />} />
          {Object.entries(MOVED).map(([from, to]) => (
            <Route key={from} path={from} element={<Navigate to={to} replace />} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
