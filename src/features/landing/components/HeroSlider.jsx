import { useState, useEffect } from 'react';
import { ArrowRight, Search, ShieldCheck } from 'lucide-react';

function HeroSlider({ onGetStarted, onBrowseServices }) {
  const sliderImages = [
    {
      url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1800&h=1100&fit=crop',
      alt: 'Local professionals collaborating with clients',
      title: 'Book trusted local services without the back-and-forth.',
      description: 'Search active providers, compare details, and move from inquiry to schedule in one clean marketplace.',
    },
    {
      url: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1800&h=1100&fit=crop',
      alt: 'Technician preparing tools for a home service job',
      title: 'Find the right pro for the work in front of you.',
      description: 'From tutoring to repairs, TrabaWho keeps service details, pricing, ratings, and availability easy to scan.',
    },
    {
      url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1800&h=1100&fit=crop',
      alt: 'Independent service team planning client work',
      title: 'Run client work from discovery to booking.',
      description: 'Freelancers get a focused workspace for inquiries, schedules, payments, and proof of service.',
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [ctaHovered, setCtaHovered] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [sliderImages.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const goToSlide = (slideIndex) => {
    setCurrentSlide(slideIndex);
  };

  const currentImage = sliderImages[currentSlide];
  const isMobile = windowWidth <= 768;
  const isSmallMobile = windowWidth <= 480;
  const handleBrowseServices = onBrowseServices || onGetStarted;

  const styles = {
    heroSlider: {
      position: 'relative',
      width: '100%',
      height: isMobile ? 'clamp(620px, calc(100svh - 118px), 700px)' : 'min(700px, calc(100vh - 118px))',
      minHeight: isMobile ? '620px' : '500px',
      overflow: 'hidden',
      marginTop: isMobile ? '66px' : '70px',
      background: '#0f172a',
    },
    sliderContainer: {
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sliderImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      filter: 'saturate(1.03)',
    },
    sliderOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(90deg, rgba(2, 6, 23, 0.82) 0%, rgba(2, 6, 23, 0.56) 46%, rgba(2, 6, 23, 0.22) 100%), linear-gradient(180deg, rgba(2, 6, 23, 0.1) 0%, rgba(2, 6, 23, 0.72) 100%)',
      display: 'flex',
      alignItems: 'center',
      zIndex: 10,
      padding: isMobile ? '32px 0 58px' : 0,
    },
    sliderContent: {
      width: isMobile ? 'min(640px, calc(100vw - 28px))' : 'min(1180px, calc(100vw - 32px))',
      margin: '0 auto',
      textAlign: 'left',
      color: '#ffffff',
      display: 'grid',
      alignItems: 'center',
      gap: isMobile ? '16px' : '22px',
      padding: isMobile ? 0 : '0 0 42px',
    },
    sliderTitle: {
      maxWidth: isMobile ? '640px' : '780px',
      fontSize: isSmallMobile ? 'clamp(1.85rem, 8.5vw, 2.35rem)' : 'clamp(2.35rem, 6.2vw, 5.2rem)',
      fontWeight: 850,
      margin: 0,
      lineHeight: isMobile ? 1.1 : 1.08,
      letterSpacing: 0,
      textShadow: '0 10px 24px rgba(2, 6, 23, 0.45)',
    },
    sliderDescription: {
      fontSize: isMobile ? 'clamp(0.95rem, 3.5vw, 1.1rem)' : 'clamp(1rem, 1.65vw, 1.24rem)',
      margin: isMobile ? '10px 0 0' : '14px 0 0',
      maxWidth: '650px',
      lineHeight: isMobile ? 1.55 : 1.65,
      textShadow: '0 4px 12px rgba(2, 6, 23, 0.5)',
    },
    sliderActions: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      marginTop: isMobile ? '18px' : '24px',
    },
    sliderCtaButton: (variant = 'primary') => ({
      background: variant === 'primary'
        ? (ctaHovered ? 'var(--gl-blue-2)' : 'var(--gl-blue)')
        : 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: variant === 'primary' ? '1px solid var(--gl-blue)' : '1px solid rgba(255, 255, 255, 0.36)',
      minHeight: '46px',
      padding: '0 16px',
      borderRadius: '8px',
      fontSize: '1rem',
      fontWeight: 800,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      cursor: 'pointer',
      width: isSmallMobile ? '100%' : 'auto',
      transition: 'transform 0.2s ease, box-shadow 0.25s ease, background 0.2s ease, border-color 0.2s ease',
      boxShadow: ctaHovered
        ? '0 14px 30px color-mix(in srgb, var(--gl-blue) 36%, transparent)'
        : '0 10px 24px rgba(15, 23, 42, 0.28)',
      transform: ctaHovered && variant === 'primary' ? 'translateY(-2px)' : 'translateY(0)',
    }),
    heroSearchStrip: {
      width: 'min(720px, 100%)',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: '10px',
      minHeight: '56px',
      marginTop: isMobile ? '18px' : '24px',
      padding: '8px',
      border: '1px solid rgba(255, 255, 255, 0.28)',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.12)',
      backdropFilter: 'blur(12px)',
    },
    heroSearchCopy: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: 0,
      color: 'rgba(255, 255, 255, 0.88)',
      padding: isMobile ? '0 6px' : '0 10px',
      fontSize: isMobile ? '0.94rem' : '1rem',
      fontWeight: 600,
      lineHeight: 1.45,
    },
    heroSearchButton: {
      minHeight: '40px',
      border: 'none',
      borderRadius: '8px',
      background: '#ffffff',
      color: '#0f172a',
      padding: '0 14px',
      cursor: 'pointer',
      fontWeight: 850,
      whiteSpace: 'nowrap',
      width: isMobile ? '100%' : 'auto',
    },
    heroTrustRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      marginTop: isMobile ? '12px' : '16px',
    },
    heroTrustPill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '7px',
      minHeight: '34px',
      padding: '0 11px',
      border: '1px solid rgba(255, 255, 255, 0.24)',
      borderRadius: '999px',
      background: 'rgba(15, 23, 42, 0.32)',
      color: '#ffffff',
      fontSize: isSmallMobile ? '0.78rem' : '0.85rem',
      fontWeight: 700,
    },
    sliderIndicators: {
      position: 'absolute',
      bottom: '1.35rem',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '0.8rem',
      zIndex: 20,
    },
    indicatorDot: (isActive) => ({
      width: isActive ? '1.32rem' : '0.72rem',
      height: '0.72rem',
      borderRadius: isActive ? '999px' : '50%',
      backgroundColor: isActive
        ? '#ffffff'
        : 'rgba(255, 255, 255, 0.5)',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    }),
    mobileStyles: {
      heroSearchStrip: {
        gridTemplateColumns: '1fr',
      },
    },
  };

  return (
    <div style={styles.heroSlider}>
      <div style={styles.sliderContainer}>
        <img
          src={currentImage.url}
          alt={currentImage.alt}
          style={styles.sliderImage}
        />

        <div style={styles.sliderOverlay}>
          <div style={styles.sliderContent}>
            <div>
              <h1 style={styles.sliderTitle}>{currentImage.title}</h1>
              <p style={styles.sliderDescription}>{currentImage.description}</p>
              <div style={styles.sliderActions}>
                <button
                  type="button"
                  style={styles.sliderCtaButton('primary')}
                  onClick={handleBrowseServices}
                  onMouseEnter={() => setCtaHovered(true)}
                  onMouseLeave={() => setCtaHovered(false)}
                >
                  <Search size={17} aria-hidden="true" />
                  Browse Services
                </button>
                <button
                  type="button"
                  style={styles.sliderCtaButton('secondary')}
                  onClick={onGetStarted}
                >
                  Join TrabaWho
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
              <div style={{ ...styles.heroSearchStrip, ...(isMobile ? styles.mobileStyles.heroSearchStrip : {}) }}>
                <div style={styles.heroSearchCopy}>
                  <Search size={18} aria-hidden="true" />
                  <span>Try "math tutor", "aircon cleaning", or "graphic design"</span>
                </div>
                <button type="button" style={styles.heroSearchButton} onClick={handleBrowseServices}>
                  Search now
                </button>
              </div>
              <div style={styles.heroTrustRow}>
                <span style={styles.heroTrustPill}><ShieldCheck size={15} aria-hidden="true" /> Active provider profiles</span>
                <span style={styles.heroTrustPill}>Transparent rates</span>
                <span style={styles.heroTrustPill}>Schedule-ready services</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.sliderIndicators}>
        {sliderImages.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            style={styles.indicatorDot(index === currentSlide)}
            aria-label={`Go to slide ${index + 1}`}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = index === currentSlide
                ? '#ffffff'
                : 'rgba(255, 255, 255, 0.5)';
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default HeroSlider;
