import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { canAccessPath, homePathForRole, paths, viewFromPathname } from '@/app/router/routes';
import DashboardNavigation from '@/shared/components/DashboardNavigation';
import '@/styles/globals.css';

const role = new URLSearchParams(window.location.search).get('role') === 'client' ? 'client' : 'worker';
const profile = { userId: `${role}-account`, role, fullName: 'Test Account' };

function Journey() {
  const location = useLocation();
  const navigate = useNavigate();
  if (!canAccessPath(location.pathname, role)) return <Navigate replace to={homePathForRole(role)} />;
  return <>
    <DashboardNavigation sellerProfile={profile} onSearchChange={() => {}} currentView={viewFromPathname(location.pathname) || (role === 'worker' ? 'worker-dashboard' : 'client-dashboard')}
      onOpenDashboard={() => void navigate(paths.dashboard)} onOpenBrowseServices={() => void navigate(paths.services)} />
    <main className="px-4 pb-24 pt-24 min-[881px]:ml-[248px]">
      <h1 className="text-xl font-semibold">Separate {role} account</h1>
      <p data-testid="account-id">{profile.userId}</p>
      <p data-testid="account-role">{profile.role}</p>
      <p data-testid="current-route">{location.pathname}</p>
      <button type="button" className="min-h-11 rounded border p-3" onClick={() => void navigate(role === 'worker' ? paths.dashboard : paths.workerDashboard)}>Other role route</button>
      <button type="button" className="min-h-11 rounded border p-3" onClick={() => void navigate(role === 'worker' ? paths.bookings : paths.sellerOnboarding)}>Other role action</button>
    </main>
  </>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<BrowserRouter><Journey /></BrowserRouter>);
