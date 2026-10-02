import { useEffect, useState } from 'react';
import { loadNotificationPreferences, saveNotificationPreferences } from '../services/notificationPreferences';

export function useNotificationPreferences() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void loadNotificationPreferences().then((preferences) => {
      if (!active) return;
      setEmailNotifications(preferences.emailEnabled);
      setSmsAlerts(preferences.smsEnabled);
      setHasLoaded(true);
      setError('');
    }).catch(() => {
      if (active) setError('Notification preferences could not be loaded. Try again.');
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [reload]);

  async function save() {
    if (!hasLoaded || isLoading || isSaving) return false;
    setIsSaving(true);
    setError('');
    try {
      await saveNotificationPreferences({ emailEnabled: emailNotifications, smsEnabled: smsAlerts });
      return true;
    } catch {
      setError('Notification preferences could not be saved. Try again.');
      return false;
    } finally { setIsSaving(false); }
  }
  function retry() { setIsLoading(true); setReload((value) => value + 1); }
  return { emailNotifications, setEmailNotifications, smsAlerts, setSmsAlerts, hasLoaded, isLoading, isSaving, error, save, retry };
}
