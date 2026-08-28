import { useEffect, useState } from 'react';
import { LogIn, Search } from 'lucide-react';
import BrandWordmark from './BrandWordmark';

function Navigation({ onLoginClick, onBrowseServices }) {
  const [isLoginHovered, setIsLoginHovered] = useState(false);
  const [isBrowseHovered, setIsBrowseHovered] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDesktop = windowWidth > 768;

  const styles = {
    navigation: {
      position: 'fixed',
      top: 0,
      width: '100%',
      background: 'color-mix(in srgb, var(--gl-surface) 94%, transparent)',
      borderBottom: '1px solid var(--gl-border)',
      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
      backdropFilter: 'blur(16px)',
      zIndex: 100,
      padding: 0,
    },
    navContainer: {
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: isDesktop ? '0.8rem 1.25rem' : '0.8rem 1rem',
      gap: '1rem',
    },
    navLogo: {
      wrap: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--gl-brand-gap)',
      },
      img: {
        width: 'var(--gl-brand-logo-size)',
        height: 'var(--gl-brand-logo-size)',
        objectFit: 'contain',
        flex: '0 0 auto',
      },
      h1: {
        fontSize: 'var(--gl-brand-font-size)',
        color: 'var(--gl-blue)',
        margin: 0,
        fontWeight: 850,
        lineHeight: 1,
        letterSpacing: 0,
      },
    },
    navLinksDesktop: {
      display: 'flex',
      gap: '0.65rem',
      alignItems: 'center',
    },
    navLink: {
      height: 40,
      minHeight: 40,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 8,
      border: isBrowseHovered ? '1px solid var(--gl-accent-border)' : '1px solid var(--gl-border)',
      background: isBrowseHovered ? 'var(--gl-accent-soft)' : 'var(--gl-surface)',
      color: isBrowseHovered ? 'var(--gl-blue)' : 'var(--gl-text)',
      padding: '0 12px',
      fontWeight: 500,
      lineHeight: 1,
      boxSizing: 'border-box',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
    },
    navButtonsLogin: {
      backgroundColor: isLoginHovered ? 'var(--gl-blue-2)' : 'var(--gl-blue)',
      color: '#ffffff',
      border: 'none',
      height: 40,
      minHeight: 40,
      padding: '0 14px',
      borderRadius: 8,
      cursor: 'pointer',
      fontWeight: 800,
      lineHeight: 1,
      boxSizing: 'border-box',
      whiteSpace: 'nowrap',
      transition: 'background-color 0.3s ease',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    mobileHeaderActions: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginLeft: 'auto',
      justifyContent: 'flex-end',
    },
    mobileLoginIconBtn: {
      width: '40px',
      height: '40px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--gl-surface)',
      color: 'var(--gl-blue)',
      border: '1px solid var(--gl-border)',
      borderRadius: '0.45rem',
      cursor: 'pointer',
    },
    mobileLoginIcon: {
      width: '18px',
      height: '18px',
      display: 'block',
    },
  };

  return (
    <nav style={styles.navigation}>
      <div style={styles.navContainer}>
        {/* Logo */}
        <div style={styles.navLogo.wrap}>
          <img src="/trabawho-logo.svg" alt="" aria-hidden="true" style={styles.navLogo.img} />
          <h1 style={styles.navLogo.h1}><BrandWordmark /></h1>
        </div>

        {/* Desktop Navigation Links */}
        <div style={isDesktop ? styles.navLinksDesktop : { display: 'none' }}>
          <button
            type="button"
            style={styles.navLink}
            onClick={onBrowseServices}
            onMouseEnter={() => setIsBrowseHovered(true)}
            onMouseLeave={() => setIsBrowseHovered(false)}
          >
            <Search size={16} aria-hidden="true" />
            Browse Services
          </button>
          <button
            onClick={onLoginClick}
            style={styles.navButtonsLogin}
            onMouseEnter={() => setIsLoginHovered(true)}
            onMouseLeave={() => setIsLoginHovered(false)}
          >
            <LogIn size={16} aria-hidden="true" />
            Login
          </button>
        </div>

        {!isDesktop && (
          <div style={styles.mobileHeaderActions}>
            <button onClick={onBrowseServices} style={styles.mobileLoginIconBtn} aria-label="Browse services">
              <Search size={18} aria-hidden="true" />
            </button>
            <button onClick={onLoginClick} style={styles.mobileLoginIconBtn} aria-label="Login">
              <LogIn style={styles.mobileLoginIcon} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navigation;
