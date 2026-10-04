import { useState } from 'react';

export function useIdentityStep() {
  const [consent, setConsent] = useState(false);
  const [manual, setManual] = useState(false);
  return { consent, setConsent, manual, setManual };
}
