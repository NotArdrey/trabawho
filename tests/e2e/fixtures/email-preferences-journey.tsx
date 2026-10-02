import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Settings } from '@/features/profile';
import { supabase } from '@/integrations/supabase';
import '@/styles/globals.css';

const userId = '11111111-1111-4111-8111-111111111111';
supabase.auth.getUser = () => Promise.resolve({ data: { user: {
  id: userId, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test',
  app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
} }, error: null });
const root = document.getElementById('root');
if (root) createRoot(root).render(<BrowserRouter><Settings sellerProfile={{ userId, role: 'client' }} /></BrowserRouter>);
