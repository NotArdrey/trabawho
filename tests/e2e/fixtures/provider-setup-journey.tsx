import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SellerOnboarding } from '@/features/onboarding';
import '@/styles/globals.css';
function Journey() {
  const [saved, setSaved] = useState(false);
  return saved ? <h1>Provider setup saved</h1> : <SellerOnboarding verifiedName="Maria Isabel de la Cruz Santos" onComplete={() => setSaved(true)} />;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Journey />);
