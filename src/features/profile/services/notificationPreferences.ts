import { supabase } from '@/integrations/supabase';

export interface NotificationPreferences { emailEnabled: boolean; smsEnabled: boolean }

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in again to manage notification preferences.');
  return data.user.id;
}

export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const userId = await currentUserId();
  const { data, error } = await supabase.from('notification_preferences')
    .select('email_enabled,sms_enabled').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Notification preferences could not be loaded. Please try again.');
  return { emailEnabled: data?.email_enabled ?? true, smsEnabled: data?.sms_enabled ?? false };
}

export async function saveNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: userId, email_enabled: preferences.emailEnabled, sms_enabled: preferences.smsEnabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error('Notification preferences could not be saved. Please try again.');
}
