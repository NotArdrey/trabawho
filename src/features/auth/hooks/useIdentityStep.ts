import { useState } from 'react';

export function useIdentityStep() {
  const [manual, setManual] = useState(false);
  return { manual, setManual };
}
