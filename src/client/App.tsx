import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Connect } from './pages/Connect';
import { ChooseRepositories } from './pages/ChooseRepositories';
import { Today } from './pages/Today';
import { AllWork } from './pages/AllWork';
import { Repositories } from './pages/Repositories';
import { Repository } from './pages/Repository';
import { Reviews } from './pages/Reviews';
import { Milestones } from './pages/Milestones';
import { SettingsPage } from './pages/Settings';
import { ErrorState, Shell } from './components';

const TITLES: [RegExp, string][] = [
  [/\/today$/, 'Today'],
  [/\/work$/, 'All work'],
  [/\/repositories\/[^/]+\/[^/]+$/, 'Repository'],
  [/\/repositories$/, 'Repositories'],
  [/\/reviews$/, 'Reviews'],
  [/\/milestones$/, 'Milestones'],
  [/\/settings$/, 'Settings'],
  [/\/setup\/repositories$/, 'Choose repositories'],
  [/\/connect$/, 'Connect GitHub'],
];

function useDocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(pathname))?.[1];
    const sample = pathname.startsWith('/sample') ? ' (sample)' : '';
    document.title = t ? `${t}${sample} · Dirigo` : 'Dirigo';
    window.scrollTo(0, 0);
  }, [pathname]);
}

function appRoutes(prefix: string) {
  return [
    <Route key={`${prefix}today`} path={`${prefix}/today`} element={<Today />} />,
    <Route key={`${prefix}work`} path={`${prefix}/work`} element={<AllWork />} />,
    <Route key={`${prefix}repos`} path={`${prefix}/repositories`} element={<Repositories />} />,
    <Route key={`${prefix}repo`} path={`${prefix}/repositories/:owner/:name`} element={<Repository />} />,
    <Route key={`${prefix}reviews`} path={`${prefix}/reviews`} element={<Reviews />} />,
    <Route key={`${prefix}ms`} path={`${prefix}/milestones`} element={<Milestones />} />,
    <Route key={`${prefix}settings`} path={`${prefix}/settings`} element={<SettingsPage />} />,
    <Route key={`${prefix}setup`} path={`${prefix}/setup/repositories`} element={<ChooseRepositories />} />,
  ];
}

export function App() {
  useDocumentTitle();
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/connect" element={<Connect />} />
      {appRoutes('')}
      {appRoutes('/sample')}
      <Route path="/sample" element={<Navigate to="/sample/today" replace />} />
      <Route path="*" element={<Shell><ErrorState error={{ code: 'not_found', message: 'Check the address, or go back to Today.' } as never} /></Shell>} />
    </Routes>
  );
}
