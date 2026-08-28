import { useEffect, useState } from 'react';
import {
  BriefcaseBusiness,
  Check,
  Network,
  Star,
  Target,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import Navigation from '../../../shared/components/Navigation';
import HeroSlider from '../components/HeroSlider';
import AuthPage from '../../auth/pages/AuthPage';
import IdentityRegistrationPage from '../../auth/pages/IdentityRegistrationPage';
import BrowseServicesPage from '../../marketplace/pages/BrowseServicesPage';

const LANDING_STATS = [
  { id: 1, value: '80+', label: 'Active service categories' },
  { id: 2, value: '1,240+', label: 'Bookings completed this week' },
  { id: 3, value: '< 15 min', label: 'Average response time' },
];

const FOOTER_COLUMNS = [
  {
    title: 'Categories',
    links: [
      'Tutoring',
      'Technician Services',
      'Cleaning',
      'Graphic Design',
      'Gaming Coach',
      'Electrical Repair',
      'Pet Grooming',
      'Aircon Cleaning',
    ],
  },
  {
    title: 'For Clients',
    links: [
      'How TrabaWho Works',
      'Find a Professional',
      'Book by Schedule',
      'Track Bookings',
      'Client Support',
    ],
  },
  {
    title: 'For Freelancers',
    links: [
      'Become a Seller',
      'Set Your Rates',
      'Manage Your Slots',
      'Build Portfolio',
      'My Work Dashboard',
    ],
  },
  {
    title: 'Company',
    links: [
      'About TrabaWho',
      'Trust & Safety',
      'Terms of Service',
      'Privacy Policy',
      'Contact Us',
    ],
  },
];

const SOCIAL_LINKS = [
  { id: 'facebook', label: 'Facebook', href: 'https://facebook.com' },
  { id: 'instagram', label: 'Instagram', href: 'https://instagram.com' },
  { id: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com' },
  { id: 'tiktok', label: 'TikTok', href: 'https://tiktok.com' },
  { id: 'youtube', label: 'YouTube', href: 'https://youtube.com' },
];

function SocialIcon({ id }) {
  if (id === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M13.5 21v-7h2.3l.4-3h-2.7V9.2c0-.9.3-1.5 1.6-1.5h1.2V5c-.2 0-1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3h2.3v7h2.7z" fill="currentColor" />
      </svg>
    );
  }

  if (id === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4" y="4" width="16" height="16" rx="4" ry="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
      </svg>
    );
  }

  if (id === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6.6 8.9h-3V20h3V8.9zm.2-3.3a1.8 1.8 0 11-3.6 0 1.8 1.8 0 013.6 0zM20.5 20h-3v-5.5c0-1.3-.5-2.2-1.7-2.2-.9 0-1.4.6-1.7 1.2-.1.2-.1.5-.1.8V20h-3V8.9h3v1.5c.4-.7 1.2-1.8 3-1.8 2.1 0 3.5 1.4 3.5 4.3V20z" fill="currentColor" />
      </svg>
    );
  }

  if (id === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M15.7 4.5c.7 1.4 1.9 2.4 3.3 2.7v2.4c-1.2-.1-2.3-.5-3.3-1.1v5.8c0 2.8-2.2 5.1-5 5.1S5.7 17 5.7 14.2c0-2.6 2-4.8 4.5-5.1v2.5c-1.1.3-1.9 1.3-1.9 2.5 0 1.4 1.1 2.5 2.5 2.5s2.4-1.1 2.4-2.5V4.5h2.5z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M21.8 8.7a3 3 0 00-2.1-2.1C17.8 6 12 6 12 6s-5.8 0-7.7.6a3 3 0 00-2.1 2.1C1.6 10.5 1.6 12 1.6 12s0 1.5.6 3.3a3 3 0 002.1 2.1C6.2 18 12 18 12 18s5.8 0 7.7-.6a3 3 0 002.1-2.1c.6-1.8.6-3.3.6-3.3s0-1.5-.6-3.3zM10 15.1V8.9l5.2 3.1-5.2 3.1z" fill="currentColor" />
    </svg>
  );
}

const GOAL_CARDS = [
  {
    id: 1,
    icon: Target,
    title: 'Academic Tutors',
    description: 'Find patient tutors for school subjects, exam prep, review sessions, and recurring study support.',
    tag: 'Learning',
    color: 'var(--gl-blue)',
  },
  {
    id: 2,
    icon: Wrench,
    title: 'Home Repair',
    description: 'Book practical help for repairs, troubleshooting, installations, and maintenance work.',
    tag: 'Home Services',
    color: 'var(--gl-green)',
  },
  {
    id: 3,
    icon: TrendingUp,
    title: 'Cleaning Services',
    description: 'Compare cleaners by location, rates, booking type, and availability before starting a chat.',
    tag: 'Household',
    color: 'var(--gl-amber)',
  },
  {
    id: 4,
    icon: Network,
    title: 'Creative Design',
    description: 'Hire freelancers for posters, social posts, layouts, branding assets, and quick creative work.',
    tag: 'Creative',
    color: 'var(--gl-blue)',
  },
  {
    id: 5,
    icon: Star,
    title: 'Beauty & Wellness',
    description: 'Discover rated local providers for care, grooming, wellness, and appointment-based services.',
    tag: 'Personal Care',
    color: 'var(--gl-blue)',
  },
  {
    id: 6,
    icon: BriefcaseBusiness,
    title: 'Event Support',
    description: 'Coordinate reliable help for small events, setup tasks, photo support, and short-term gigs.',
    tag: 'Events',
    color: 'var(--gl-text-3)',
  },
];

const getAuthModeFromHash = () => {
  if (typeof window === 'undefined') return null;

  if (window.location.hash === '#login') return 'login';
  if (window.location.hash === '#register') return 'register';
  if (window.location.hash === '#forgot-password') return 'forgot';

  return null;
};

const getAuthHash = (mode) => {
  if (mode === 'register') return 'register';
  if (mode === 'forgot') return 'forgot-password';
  return 'login';
};

const isIdentityRegisterHash = () =>
  typeof window !== 'undefined' && window.location.hash === '#identity-register';

function GoalCard({ icon, title, description, tag, color, onSet }) {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = icon;

  const styles = {
    goalCard: {
      position: 'relative',
      backgroundColor: 'var(--bg-surface)',
      border: isHovered ? `1px solid ${color}` : '1px solid var(--border-default)',
      borderRadius: '8px',
      padding: '22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      cursor: 'pointer',
      transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s ease, background 0.2s ease, box-shadow 0.25s ease',
      overflow: 'hidden',
      transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
      background: isHovered ? 'var(--gl-surface-2)' : 'var(--gl-surface)',
      boxShadow: isHovered ? 'var(--gl-shadow-soft), 0 0 0 1px ' + color + ' inset' : '0 1px 0 rgba(15, 23, 42, 0.03)',
    },
    goalCardAccentBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      background: color,
      borderRadius: '8px 8px 0 0',
      opacity: isHovered ? 1 : 0,
      transform: isHovered ? 'scaleX(1)' : 'scaleX(0.4)',
      transformOrigin: 'left',
      transition: 'opacity 0.2s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    goalCardIcon: {
      width: '42px',
      height: '42px',
      borderRadius: '8px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `color-mix(in srgb, ${color} 12%, var(--gl-surface))`,
      color,
      marginBottom: '4px',
    },
    goalCardTag: {
      fontSize: '11px',
      letterSpacing: 0,
      textTransform: 'uppercase',
      color: color,
      fontWeight: 800,
    },
    goalCardTitle: {
      fontSize: '20px',
      fontWeight: 850,
      color: 'var(--text-primary)',
      margin: 0,
      lineHeight: 1.25,
    },
    goalCardDescription: {
      fontSize: '14px',
      lineHeight: 1.6,
      color: 'var(--text-secondary)',
      margin: 0,
      flex: 1,
    },
    goalCardBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: isHovered ? '10px' : '6px',
      marginTop: '12px',
      fontSize: '14px',
      fontWeight: 850,
      color: color,
      background: 'transparent',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      opacity: isHovered ? 1 : 0.7,
      transition: 'opacity 0.15s ease, gap 0.2s ease',
      alignSelf: 'flex-start',
    },
    goalCardBtnSvg: {
      width: '16px',
      height: '16px',
    },
  };

  return (
    <div
      style={styles.goalCard}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={styles.goalCardAccentBar} />
      <span style={styles.goalCardIcon}>
        <Icon size={24} aria-hidden="true" />
      </span>
      <span style={styles.goalCardTag}>{tag}</span>
      <h3 style={styles.goalCardTitle}>{title}</h3>
      <p style={styles.goalCardDescription}>{description}</p>
      <button style={styles.goalCardBtn} onClick={() => onSet(title)}>
        Browse Providers
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={styles.goalCardBtnSvg}>
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

function GoalsSection({ onLoginClick, isMobile, isTablet }) {
  const [activeGoal, setActiveGoal] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastYOffset, setToastYOffset] = useState(0);

  const handleSetGoal = (title) => {
    setActiveGoal(title);
    setShowToast(true);
    setToastYOffset(0);
    setTimeout(() => setShowToast(false), 3000);
  };

  const styles = {
    goalsSection: {
      position: 'relative',
      padding: isMobile ? '56px 14px 44px' : isTablet ? '68px 24px 56px' : '76px 40px 64px',
      background: 'var(--gl-page)',
      overflow: 'hidden',
    },
    goalsSectionHeaderBg: {
      content: '""',
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, color-mix(in srgb, var(--gl-blue) 5%, transparent), transparent 320px)',
      pointerEvents: 'none',
    },
    goalsSectionHeader: {
      maxWidth: '680px',
      margin: isMobile ? '0 auto 38px' : '0 auto 64px',
      textAlign: 'center',
    },
    goalsSectionEyebrow: {
      display: 'inlineBlock',
      fontFamily: 'var(--gl-font)',
      fontSize: '12px',
      fontWeight: 500,
      letterSpacing: 0,
      textTransform: 'uppercase',
      color: 'var(--gl-blue)',
      marginBottom: '16px',
      padding: '4px 14px',
      border: '1px solid var(--gl-accent-border)',
      borderRadius: '8px',
    },
    goalsSectionTitle: {
      fontFamily: 'var(--gl-font)',
      fontSize: 'clamp(36px, 5vw, 56px)',
      fontWeight: 850,
      color: 'var(--text-primary)',
      lineHeight: 1.15,
      margin: '0 0 20px',
      letterSpacing: 0,
    },
    goalsSectionTitleEm: {
      fontStyle: 'italic',
      color: 'var(--gl-blue)',
    },
    goalsSectionSubtitle: {
      fontFamily: 'var(--gl-font)',
      fontSize: '19px',
      lineHeight: 1.75,
      color: 'var(--text-secondary)',
      margin: 0,
    },
    goalsGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile
        ? '1fr'
        : isTablet
          ? 'repeat(2, minmax(0, 1fr))'
          : 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: isMobile ? '14px' : '24px',
      maxWidth: '1200px',
      margin: isMobile ? '0 auto 48px' : '0 auto 72px',
    },
    goalsCta: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      flexWrap: 'wrap',
      maxWidth: '800px',
      margin: '0 auto',
      paddingTop: '16px',
      borderTop: '1px solid var(--border-default)',
    },
    goalsCtaText: {
      fontFamily: 'var(--gl-font)',
      fontSize: '18px',
      color: 'var(--text-secondary)',
      margin: 0,
      flex: '1 1 100%',
      textAlign: 'center',
    },
    goalsCtaBtn: {
      padding: '13px 28px',
      fontFamily: 'var(--gl-font)',
      fontSize: '17px',
      fontWeight: 600,
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
      letterSpacing: '0.01em',
      background: 'transparent',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-default)',
    },
    goalsToast: {
      position: 'fixed',
      bottom: '32px',
      left: '50%',
      transform: `translateX(-50%) translateY(${toastYOffset}px)`,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      padding: '12px 24px',
      fontFamily: 'var(--gl-font)',
      fontSize: '16px',
      color: 'var(--text-primary)',
      whiteSpace: isMobile ? 'normal' : 'nowrap',
      width: isMobile ? 'calc(100vw - 24px)' : 'auto',
      maxWidth: isMobile ? '420px' : 'none',
      zIndex: 9999,
      boxShadow: 'var(--shadow-soft)',
      animation: 'toastIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    goalsToastIcon: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      background: 'var(--gl-blue)',
      color: '#ffffff',
      borderRadius: '50%',
      fontSize: '11px',
      fontWeight: 800,
      flexShrink: 0,
    },
  };

  return (
    <section style={styles.goalsSection}>
      <div style={styles.goalsSectionHeader}>
        <span style={styles.goalsSectionEyebrow}>Powered by TrabaWho</span>
        <h2 style={styles.goalsSectionTitle}>
          Set Your <em style={styles.goalsSectionTitleEm}>Professional Goals</em>
        </h2>
        <p style={styles.goalsSectionSubtitle}>
          Turn your ambitions into milestones. Pick a goal and let TrabaWho connect you
          with the right opportunities, clients, and tools to get there.
        </p>
      </div>

      <div style={styles.goalsGrid}>
        {GOAL_CARDS.map((card) => (
          <GoalCard
            key={card.id}
            {...card}
            onSet={handleSetGoal}
          />
        ))}
      </div>

      <div style={styles.goalsCta}>
        <p style={styles.goalsCtaText}>
          Ready to take the first step?
        </p>
        <button style={styles.goalsCtaBtn}>
          Browse All Goals
        </button>
      </div>

      {showToast && (
        <div style={styles.goalsToast} role="status" aria-live="polite">
          <span style={styles.goalsToastIcon}>
            <Check size={12} aria-hidden="true" />
          </span>
          <span>
            <strong>"{activeGoal}"</strong> added! Sign in to track your progress.
          </span>
        </div>
      )}
    </section>
  );
}

function LandingPage({ appTheme = 'light', onLogin, onResendVerification, onForgotPasswordSubmit }) {
  const [authMode, setAuthMode] = useState(() => getAuthModeFromHash());
  const [isIdentityRegisterOpen, setIsIdentityRegisterOpen] = useState(() => isIdentityRegisterHash());
  const [isPublicBrowseOpen, setIsPublicBrowseOpen] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash === '#browse-services' && !getAuthModeFromHash() && !isIdentityRegisterHash() : false
  );
  const [socialLinkHovered, setSocialLinkHovered] = useState(null);
  const [footerLinkHovered, setFooterLinkHovered] = useState(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 1024 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth <= 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const nextAuthMode = getAuthModeFromHash();
      const nextIdentityOpen = isIdentityRegisterHash();
      setAuthMode(nextAuthMode);
      setIsIdentityRegisterOpen(nextIdentityOpen);
      setIsPublicBrowseOpen(!nextAuthMode && !nextIdentityOpen && window.location.hash === '#browse-services');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAuthModeChange = (nextMode) => {
    const resolvedMode = nextMode === 'register' || nextMode === 'forgot' ? nextMode : 'login';
    setAuthMode(resolvedMode);
    setIsIdentityRegisterOpen(false);
    setIsPublicBrowseOpen(false);

    if (typeof window !== 'undefined') {
      window.location.hash = getAuthHash(resolvedMode);
    }
  };

  const handleLoginClick = () => {
    handleAuthModeChange('login');
  };

  const handleRegisterClick = () => {
    handleAuthModeChange('register');
  };

  const handleBrowseServicesClick = () => {
    setAuthMode(null);
    setIsIdentityRegisterOpen(false);
    setIsPublicBrowseOpen(true);
    if (typeof window !== 'undefined') {
      window.location.hash = 'browse-services';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCloseAuthPage = () => {
    setAuthMode(null);
    setIsIdentityRegisterOpen(false);
    setIsPublicBrowseOpen(false);

    if (typeof window !== 'undefined') {
      window.history.pushState('', document.title, window.location.pathname + window.location.search);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLoginSubmit = (formData, isLoginMode) => {
    return onLogin && onLogin(formData, isLoginMode);
  };

  const styles = {
    landingPage: {
      width: '100%',
      minHeight: '100vh',
      background:
        'radial-gradient(120% 80% at 50% -20%, color-mix(in srgb, var(--gl-blue) 8%, transparent), transparent 60%), var(--bg-page)',
    },
    landingMain: {
      width: '100%',
    },
    publicBrowseMain: {
      paddingTop: isMobile ? '64px' : '72px',
      background: 'var(--gl-page)',
      minHeight: '100vh',
    },
    landingStatsSection: {
      maxWidth: '1200px',
      margin: '0 auto 2rem',
      padding: isMobile ? '0 0.9rem' : '0 1.25rem',
    },
    landingStatsHeader: {
      maxWidth: '760px',
      margin: '0 auto 18px',
      textAlign: 'center',
    },
    landingStatsHeaderSpan: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '28px',
      padding: '0 10px',
      borderRadius: '8px',
      border: '1px solid var(--gl-border)',
      color: 'var(--gl-text-2)',
      background: 'var(--gl-surface-2)',
      fontSize: '11px',
      letterSpacing: 0,
      textTransform: 'uppercase',
      fontWeight: 700,
    },
    landingStatsHeaderH2: {
      margin: '10px 0 6px',
      fontSize: 'clamp(1.7rem, 3vw, 2.3rem)',
      color: 'var(--gl-text)',
      fontWeight: 800,
    },
    landingStatsHeaderP: {
      margin: 0,
      color: 'var(--gl-text-3)',
      fontSize: '1.08rem',
    },
    landingStatsGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
      gap: '12px',
    },
    landingStatCard: {
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      background: 'var(--gl-surface)',
      boxShadow: 'var(--gl-shadow-soft)',
      padding: '16px 18px',
      textAlign: 'center',
    },
    landingStatValue: {
      margin: 0,
      fontSize: 'clamp(1.25rem, 2vw, 1.7rem)',
      fontWeight: 800,
      letterSpacing: 0,
      color: 'var(--gl-text)',
    },
    landingStatLabel: {
      margin: '4px 0 0',
      fontSize: '1rem',
      color: 'var(--gl-text-2)',
    },
    landingLinksSection: {
      maxWidth: '1320px',
      margin: '2.4rem auto 0',
      padding: isMobile ? '1.5rem 0.9rem 1.1rem' : '2rem 1.25rem 1.35rem',
      borderTop: '1px solid var(--border-default)',
    },
    landingLinksGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
      gap: '20px',
    },
    landingLinksColumn: {
      h3: {
        margin: '0 0 10px',
        fontSize: '1.26rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
      },
      ul: {
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gap: '8px',
      },
      a: (isHovered) => ({
        color: isHovered ? 'var(--gl-blue)' : 'var(--text-secondary)',
        textDecoration: 'none',
        fontSize: '1.08rem',
        lineHeight: 1.5,
        fontWeight: 500,
        transition: 'color 0.2s ease',
        cursor: 'pointer',
      }),
    },
    landingFooterBottom: {
      marginTop: '24px',
      paddingTop: '14px',
      borderTop: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexDirection: isMobile ? 'column' : 'row',
      gap: '12px',
    },
    landingCopyright: {
      margin: 0,
      fontSize: '1.04rem',
      fontWeight: 600,
      color: 'var(--text-secondary)',
    },
    landingSocialLinks: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    landingSocialLink: (id) => ({
      width: '38px',
      height: '38px',
      borderRadius: '8px',
      border: socialLinkHovered === id ? '1px solid var(--gl-blue)' : '1px solid var(--gl-border)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: socialLinkHovered === id ? 'var(--gl-blue)' : 'var(--gl-text)',
      textDecoration: 'none',
      transition: 'transform 0.18s ease, border-color 0.2s ease, color 0.2s ease',
      transform: socialLinkHovered === id ? 'translateY(-2px)' : 'translateY(0)',
    }),
    landingSocialLinkSvg: {
      width: '17px',
      height: '17px',
      display: 'block',
    },
  };

  return (
    <div style={styles.landingPage}>
      {!authMode && !isIdentityRegisterOpen && (
        <Navigation
          onLoginClick={handleLoginClick}
          onBrowseServices={handleBrowseServicesClick}
        />
      )}

      {authMode ? (
        <AuthPage
          mode={authMode}
          onModeChange={handleAuthModeChange}
          onBack={handleCloseAuthPage}
          onSubmit={handleLoginSubmit}
          onForgotPasswordSubmit={onForgotPasswordSubmit}
          onResendVerification={onResendVerification}
        />
      ) : isIdentityRegisterOpen ? (
        <IdentityRegistrationPage
          onBack={handleCloseAuthPage}
          onLogin={handleLoginClick}
        />
      ) : isPublicBrowseOpen ? (
        <main style={styles.publicBrowseMain}>
          <BrowseServicesPage
            mode="public"
            appTheme={appTheme}
            onRequireLogin={handleLoginClick}
          />
        </main>
      ) : (
      <main style={styles.landingMain}>
        <HeroSlider
          onGetStarted={handleRegisterClick}
          onBrowseServices={handleBrowseServicesClick}
        />

        <GoalsSection onLoginClick={handleLoginClick} isMobile={isMobile} isTablet={isTablet} />

        <section style={styles.landingStatsSection} aria-label="TrabaWho performance highlights">
          <div style={styles.landingStatsHeader}>
            <span style={styles.landingStatsHeaderSpan}>Platform Snapshot</span>
            <h2 style={styles.landingStatsHeaderH2}>Why TrabaWho Delivers</h2>
            <p style={styles.landingStatsHeaderP}>Quick metrics that show activity and trust across our service marketplace.</p>
          </div>
          <div style={styles.landingStatsGrid}>
            {LANDING_STATS.map((item) => (
              <article key={item.id} style={styles.landingStatCard}>
                <p style={styles.landingStatValue}>{item.value}</p>
                <p style={styles.landingStatLabel}>{item.label}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.landingLinksSection} aria-label="TrabaWho quick links">
          <div style={styles.landingLinksGrid}>
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 style={styles.landingLinksColumn.h3}>{column.title}</h3>
                <ul style={styles.landingLinksColumn.ul}>
                  {column.links.map((linkText) => (
                    <li key={linkText}>
                      <a href="#landing-footer" 
                        style={styles.landingLinksColumn.a(footerLinkHovered === linkText)}
                        onMouseEnter={() => setFooterLinkHovered(linkText)}
                        onMouseLeave={() => setFooterLinkHovered(null)}
                      >
                        {linkText}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={styles.landingFooterBottom} id="landing-footer">
            <p style={styles.landingCopyright}>Copyright TrabaWho 2026. All rights reserved.</p>
            <div style={styles.landingSocialLinks} aria-label="TrabaWho social media">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  style={styles.landingSocialLink(social.id)}
                  onMouseEnter={() => setSocialLinkHovered(social.id)}
                  onMouseLeave={() => setSocialLinkHovered(null)}
                >
                  <SocialIcon id={social.id} />
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      )}
    </div>
  );
}

export default LandingPage;
