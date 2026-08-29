import React, { useEffect, useState } from 'react';
import DashboardNavigation from '../../../shared/components/DashboardNavigation';
import { getThemeTokens } from '../../../shared/styles/themeTokens';

const Settings = ({
  currentView,
  searchQuery,
  onSearchChange,
  onLogout,
  onOpenSellerSetup,
  onOpenMyBookings,
  onOpenChatPage,
  sellerProfile,
  onOpenMyWork,
  onOpenProfile,
  onOpenAccountSettings,
  onOpenSettings,
  onOpenDashboard,
  onOpenBrowseServices,
  onOpenAdminDashboard,
  onBack,
  appTheme = 'light',
  themeMode = 'system',
  appLanguage = 'en',
  onThemeChange,
  onLanguageChange,
}) => {
  const isDarkMode = appTheme === 'dark';
  const language = appLanguage === 'fil' ? 'fil' : 'en';

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isBackHovered = false;
  const [isLangHovered, setIsLangHovered] = useState(false);
  const [isLangFocused, setIsLangFocused] = useState(false);
  const [isSystemHovered, setIsSystemHovered] = useState(false);
  const [isSaveHovered, setIsSaveHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const translations = {
    en: {
      title: 'Preferences',
      subtitle: 'Manage your preferences and account options',
      backButton: '< Back',
      generalSettings: 'General Preferences',
      settingsSubtitle: 'Customize your experience',
      language: 'Language',
      languageDesc: 'Choose your preferred language for the app',
      english: 'English',
      tagalog: 'Filipino (Tagalog)',
      theme: 'Theme',
      themeDesc: 'Choose between light and dark mode',
      followSystem: 'Use Device Appearance',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
      notifications: 'Notifications',
      notificationsDesc: 'Manage your notification preferences',
      emailNotifications: 'Email Notifications',
      emailDesc: 'Receive notification updates via email',
      smsAlerts: 'SMS Alerts',
      smsDesc: 'Receive important alerts via SMS',
      saveButton: 'Save Changes',
      savingButton: 'Saving...',
      saveSuccess: 'Settings saved successfully!',
      on: 'On',
      off: 'Off',
    },
    fil: {
      title: 'Mga Preference',
      subtitle: 'Pamahalaan ang iyong mga preference at opsyon ng account',
      backButton: '< Bumalik',
      generalSettings: 'Pangkalahatang Preference',
      settingsSubtitle: 'I-customize ang iyong karanasan',
      language: 'Wika',
      languageDesc: 'Piliin ang iyong ginustong wika para sa app',
      english: 'English',
      tagalog: 'Filipino (Tagalog)',
      theme: 'Tema',
      themeDesc: 'Pumili sa pagitan ng light at dark mode',
      followSystem: 'Gamitin ang Tema ng Device',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
      notifications: 'Mga Notification',
      notificationsDesc: 'Pamahalaan ang iyong mga kagustuhan sa notification',
      emailNotifications: 'Email Notifications',
      emailDesc: 'Makatanggap ng notification updates sa pamamagitan ng email',
      smsAlerts: 'Makatanggap ng mahalagang alerto sa pamamagitan ng SMS',
      smsDesc: 'Makatanggap ng mahalagang alerto sa pamamagitan ng SMS',
      saveButton: 'I-save ang Mga Pagbabago',
      savingButton: 'I-save...',
      saveSuccess: 'Matagumpay na na-save ang mga setting!',
      on: 'On',
      off: 'Off',
    },
  };

  const t = translations[language];

  const themeTokens = getThemeTokens(appTheme);

  const handleLanguageChange = (e) => {
    if (onLanguageChange) {
      onLanguageChange(e.target.value);
    }
  };

  const handleThemeToggle = () => {
    if (onThemeChange) {
      onThemeChange(isDarkMode ? 'light' : 'dark');
    }
  };

  const handleEmailToggle = () => {
    setEmailNotifications(!emailNotifications);
  };

  const handleSmsToggle = () => {
    setSmsAlerts(!smsAlerts);
  };

  const handleSave = () => {
    setSaveMessage('');
    setIsSaving(true);

    setTimeout(() => {
      setSaveMessage(t.saveSuccess);
      setIsSaving(false);

      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    }, 800);
  };

  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: themeTokens.bgPrimary,
      color: themeTokens.textPrimary,
      transition: 'background-color 0.3s ease, color 0.3s ease',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    header: {
      backgroundColor: themeTokens.cardBg,
      borderBottom: `1px solid ${themeTokens.borderColor}`,
      padding: isMobile ? '12px 14px' : '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    },
    backBtn: {
      padding: '8px 14px',
      backgroundColor: isBackHovered ? themeTokens.bgSecondary : 'transparent',
      color: isBackHovered ? themeTokens.accent : themeTokens.textPrimary,
      border: `1px solid ${isBackHovered ? themeTokens.accent : themeTokens.borderColor}`,
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    title: {
      fontSize: isMobile ? '20px' : '24px',
      fontWeight: 700,
      color: themeTokens.textPrimary,
      margin: 0,
    },
    spacer: { width: isMobile ? '0' : '100px' },
    main: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: isMobile ? '20px 12px' : '32px 16px',
    },
    card: {
      backgroundColor: themeTokens.cardBg,
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      padding: isMobile ? '20px 14px' : '32px',
      border: `1px solid ${themeTokens.borderColor}`,
    },
    cardHeader: {
      marginBottom: '32px',
      borderBottom: `1px solid ${themeTokens.borderColor}`,
      paddingBottom: '24px',
    },
    h2: {
      fontSize: '22px',
      fontWeight: 700,
      color: themeTokens.textPrimary,
      margin: '0 0 8px 0',
    },
    cardSubtitle: {
      fontSize: '14px',
      color: themeTokens.textSecondary,
      margin: 0,
    },
    content: {
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
    },
    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
    h3: {
      fontSize: '16px',
      fontWeight: 700,
      color: themeTokens.textPrimary,
      margin: '0 0 4px 0',
    },
    sectionDesc: {
      fontSize: '13px',
      color: themeTokens.textSecondary,
      margin: 0,
    },
    settingItem: {
      display: 'flex',
      alignItems: isMobile ? 'stretch' : 'center',
      flexDirection: isMobile ? 'column' : 'row',
      gap: '12px',
    },
    languageSelect: {
      flex: 1,
      padding: '10px 14px',
      backgroundColor: themeTokens.inputBg,
      color: themeTokens.textPrimary,
      border: `1px solid ${isLangFocused || isLangHovered ? themeTokens.accent : themeTokens.inputBorder}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: 'inherit',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      outline: 'none',
      boxShadow: isLangFocused ? `0 0 0 3px ${themeTokens.accentRing}` : 'none',
    },
    languageIndicator: {
      width: '36px',
      height: '36px',
      borderRadius: '999px',
      border: `1px solid ${themeTokens.inputBorder}`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeTokens.inputBg,
      color: themeTokens.textPrimary,
      flexShrink: 0,
      alignSelf: isMobile ? 'flex-start' : 'center',
    },
    themeToggleContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
      gap: '20px',
      backgroundColor: themeTokens.inputBg,
      padding: isMobile ? '14px' : '20px',
      borderRadius: '10px',
      border: `1px solid ${themeTokens.inputBorder}`,
    },
    themeOption: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      fontSize: '13px',
      color: themeTokens.textSecondary,
      fontWeight: 500,
    },
    themeIcon: {
      width: '26px',
      height: '26px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: themeTokens.textSecondary,
    },
    themeSwitch: {
      position: 'relative',
      display: 'inline-block',
      width: '54px',
      height: '28px',
    },
    hiddenInput: {
      opacity: 0,
      width: 0,
      height: 0,
      position: 'absolute',
    },
    slider: {
      position: 'absolute',
      cursor: 'pointer',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isDarkMode ? themeTokens.accent : themeTokens.borderColor,
      transition: '0.3s',
      borderRadius: '34px',
    },
    sliderThumb: {
      position: 'absolute',
      content: "''",
      height: '22px',
      width: '22px',
      left: isDarkMode ? '29px' : '3px',
      bottom: '3px',
      backgroundColor: 'white',
      transition: '0.3s',
      borderRadius: '50%',
    },
    systemThemeBtn: {
      marginTop: '12px',
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${(themeMode === 'system' || isSystemHovered) ? themeTokens.accent : themeTokens.inputBorder}`,
      borderRadius: '8px',
      backgroundColor: themeMode === 'system' ? themeTokens.accentSoft : 'transparent',
      color: themeTokens.textPrimary,
      fontSize: '13px',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    notificationItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'flex-start' : 'center',
      flexDirection: isMobile ? 'column' : 'row',
      padding: isMobile ? '14px' : '16px',
      backgroundColor: themeTokens.inputBg,
      borderRadius: '10px',
      border: `1px solid ${themeTokens.inputBorder}`,
      gap: '16px',
    },
    notificationInfo: { flex: 1 },
    notificationLabel: {
      display: 'block',
      fontSize: '14px',
      fontWeight: 600,
      color: themeTokens.textPrimary,
      marginBottom: '4px',
      cursor: 'pointer',
    },
    notificationDesc: {
      fontSize: '12px',
      color: themeTokens.textSecondary,
      margin: 0,
    },
    toggleSwitch: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: 'fit-content',
    },
    toggleSlider: {
      position: 'relative',
      display: 'inline-block',
      width: '44px',
      height: '24px',
      backgroundColor: themeTokens.borderColor,
      borderRadius: '12px',
      cursor: 'pointer',
      transition: 'background-color 0.3s',
    },
    toggleSliderChecked: {
      backgroundColor: themeTokens.accent,
    },
    toggleThumb: {
      position: 'absolute',
      height: '20px',
      width: '20px',
      left: '2px',
      bottom: '2px',
      backgroundColor: 'white',
      borderRadius: '50%',
      transition: 'transform 0.3s',
      transform: 'translateX(0)',
    },
    toggleThumbChecked: {
      transform: 'translateX(20px)',
    },
    toggleLabel: {
      fontSize: '12px',
      fontWeight: 700,
      color: themeTokens.textPrimary,
      minWidth: '28px',
      textAlign: 'center',
    },
    saveSuccessMessage: {
      margin: '24px 0 16px 0',
      padding: '12px 16px',
      backgroundColor: themeTokens.successBg,
      color: themeTokens.successText,
      border: `1px solid ${themeTokens.successBorder}`,
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: 600,
      textAlign: 'center',
      transform: 'translateY(0)',
      opacity: 1,
      transition: 'transform 0.3s ease, opacity 0.3s ease',
    },
    footer: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: '32px',
      paddingTop: '24px',
      borderTop: `1px solid ${themeTokens.borderColor}`,
    },
    saveChangesBtn: {
      padding: '12px 32px',
      width: isMobile ? '100%' : 'auto',
      backgroundColor: isSaveHovered && !isSaving ? themeTokens.accentHover : themeTokens.accent,
      color: '#ffffff',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 700,
      cursor: isSaving ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s ease',
      opacity: isSaving ? 0.6 : 1,
      transform: isSaveHovered && !isSaving ? 'translateY(-2px)' : 'translateY(0)',
      boxShadow: isSaveHovered && !isSaving ? themeTokens.accentShadow : 'none',
    },
  };

  return (
    <div style={styles.page} data-testid="settings-page">
      <DashboardNavigation
        appTheme={appTheme}
        themeMode={themeMode}
        onThemeChange={onThemeChange}
        currentView={currentView}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onLogout={onLogout}
        onOpenSellerSetup={onOpenSellerSetup}
        onOpenMyBookings={onOpenMyBookings}
        onOpenChatPage={onOpenChatPage}
        sellerProfile={sellerProfile}
        onOpenMyWork={onOpenMyWork}
        onOpenProfile={onOpenProfile}
        onOpenAccountSettings={onOpenAccountSettings}
        onOpenSettings={onOpenSettings}
        onOpenDashboard={onOpenDashboard}
        onOpenBrowseServices={onOpenBrowseServices}
        isAdminView={false}
        onToggleAdminView={() => { if (typeof onOpenAdminDashboard === 'function') onOpenAdminDashboard(); }}
      />

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.h2}>{t.generalSettings}</h2>
            <p style={styles.cardSubtitle}>{t.settingsSubtitle}</p>
          </div>

          <div style={styles.content}>
            <div style={styles.section}>
              <div>
                <h3 style={styles.h3}>{t.language}</h3>
                <p style={styles.sectionDesc}>{t.languageDesc}</p>
              </div>

              <div style={styles.settingItem}>
                <select
                  style={styles.languageSelect}
                  value={language}
                  onChange={handleLanguageChange}
                  onMouseEnter={() => setIsLangHovered(true)}
                  onMouseLeave={() => setIsLangHovered(false)}
                  onFocus={() => setIsLangFocused(true)}
                  onBlur={() => setIsLangFocused(false)}
                >
                  <option value="en">{t.english}</option>
                  <option value="fil">{t.tagalog}</option>
                </select>
                <span style={styles.languageIndicator} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M2 12h20"></path>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                </span>
              </div>
            </div>

            <div style={styles.section}>
              <div>
                <h3 style={styles.h3}>{t.theme}</h3>
                <p style={styles.sectionDesc}>{t.themeDesc}</p>
              </div>

              <div style={styles.themeToggleContainer}>
                <div style={styles.themeOption}>
                  <span style={styles.themeIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                      <circle cx="12" cy="12" r="5"></circle>
                      <g stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M12 1v4"></path>
                        <path d="M12 19v4"></path>
                        <path d="M4.22 4.22l2.83 2.83"></path>
                        <path d="M16.95 16.95l2.83 2.83"></path>
                        <path d="M1 12h4"></path>
                        <path d="M19 12h4"></path>
                        <path d="M4.22 19.78l2.83-2.83"></path>
                        <path d="M16.95 7.05l2.83-2.83"></path>
                      </g>
                    </svg>
                  </span>
                  <span>{t.lightMode}</span>
                </div>

                <label style={styles.themeSwitch}>
                  <input
                    type="checkbox"
                    checked={isDarkMode}
                    onChange={handleThemeToggle}
                    style={styles.hiddenInput}
                  />
                  <span style={styles.slider}>
                    <span style={styles.sliderThumb}></span>
                  </span>
                </label>

                <div style={styles.themeOption}>
                  <span style={styles.themeIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3c0 .1 0 .21 0 .31A7 7 0 0 0 20.69 13c.1 0 .21 0 .31-.01z"></path>
                    </svg>
                  </span>
                  <span>{t.darkMode}</span>
                </div>
              </div>

              <button
                type="button"
                style={styles.systemThemeBtn}
                onMouseEnter={() => setIsSystemHovered(true)}
                onMouseLeave={() => setIsSystemHovered(false)}
                onClick={() => onThemeChange && onThemeChange('system')}
              >
                {t.followSystem}
              </button>
            </div>

            <div style={styles.section}>
              <div>
                <h3 style={styles.h3}>{t.notifications}</h3>
                <p style={styles.sectionDesc}>{t.notificationsDesc}</p>
              </div>

              <div style={styles.notificationItem}>
                <div style={styles.notificationInfo}>
                  <label htmlFor="email-toggle" style={styles.notificationLabel}>
                    {t.emailNotifications}
                  </label>
                  <p style={styles.notificationDesc}>{t.emailDesc}</p>
                </div>
                <label style={styles.toggleSwitch}>
                  <input
                    id="email-toggle"
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={handleEmailToggle}
                    style={styles.hiddenInput}
                  />
                  <span style={{ ...styles.toggleSlider, ...(emailNotifications ? styles.toggleSliderChecked : {}) }}>
                    <span style={{ ...styles.toggleThumb, ...(emailNotifications ? styles.toggleThumbChecked : {}) }}></span>
                  </span>
                  <span style={styles.toggleLabel}>
                    {emailNotifications ? t.on : t.off}
                  </span>
                </label>
              </div>

              <div style={styles.notificationItem}>
                <div style={styles.notificationInfo}>
                  <label htmlFor="sms-toggle" style={styles.notificationLabel}>
                    {t.smsAlerts}
                  </label>
                  <p style={styles.notificationDesc}>{t.smsDesc}</p>
                </div>
                <label style={styles.toggleSwitch}>
                  <input
                    id="sms-toggle"
                    type="checkbox"
                    checked={smsAlerts}
                    onChange={handleSmsToggle}
                    style={styles.hiddenInput}
                  />
                  <span style={{ ...styles.toggleSlider, ...(smsAlerts ? styles.toggleSliderChecked : {}) }}>
                    <span style={{ ...styles.toggleThumb, ...(smsAlerts ? styles.toggleThumbChecked : {}) }}></span>
                  </span>
                  <span style={styles.toggleLabel}>
                    {smsAlerts ? t.on : t.off}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {saveMessage && (
            <div style={styles.saveSuccessMessage}>
              ? {saveMessage}
            </div>
          )}

          <div style={styles.footer}>
            <button
              style={styles.saveChangesBtn}
              onMouseEnter={() => setIsSaveHovered(true)}
              onMouseLeave={() => setIsSaveHovered(false)}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? t.savingButton : t.saveButton}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
