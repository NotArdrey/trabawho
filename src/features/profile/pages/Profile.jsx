import { useEffect, useRef, useState } from 'react';
import DashboardNavigation from '../../../shared/components/DashboardNavigation';
import DigitalPortfolioModal from '../components/DigitalPortfolioModal';
import PaymentModal from '../../bookings/components/PaymentModal';
import BookingTermsModal from '../../bookings/components/BookingTermsModal';
import { getThemeTokens } from '../../../shared/styles/themeTokens';
import { getProfilePhotoUrl, hasUploadedProfilePhoto } from '../../../shared/utils/profilePhoto';
import { fetchSellerServices, updateServiceAdBoost, uploadPortfolioDocument } from '../../../shared/services/authService';

function Profile({ appTheme = 'light', themeMode = 'system', onThemeChange, currentView, searchQuery, onSearchChange, onLogout, onOpenSellerSetup, onOpenMyBookings, onOpenChatPage, sellerProfile, onOpenMyWork, onOpenProfile, onOpenAccountSettings, onOpenSettings, onOpenDashboard, onOpenBrowseServices, userLocation, onManageAccount, onBackToDashboard, onUpdateProfile, onOpenAdminDashboard }) {
  const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;
  const fallbackName = 'Juan Dela Cruz';
  const fallbackBio = 'Dedicated service provider focused on quality, punctuality, and client satisfaction.';
  const fallbackPhoto = getProfilePhotoUrl('');
  const splitNameParts = (value = '') => {
    const parts = String(value).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' };
    if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
    return { firstName: parts[0], middleName: parts.slice(1, -1).join(' '), lastName: parts.at(-1) };
  };
  const buildDisplayName = ({ firstName = '', middleName = '', lastName = '' } = {}) =>
    [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
  const initialNameParts = splitNameParts(sellerProfile?.fullName || fallbackName);

  const [firstName, setFirstName] = useState(sellerProfile?.firstName || initialNameParts.firstName);
  const [middleName, setMiddleName] = useState(sellerProfile?.middleName || initialNameParts.middleName);
  const [lastName, setLastName] = useState(sellerProfile?.lastName || initialNameParts.lastName);
  const [displayBio, setDisplayBio] = useState(sellerProfile?.bio || fallbackBio);
  const [profilePhoto, setProfilePhoto] = useState(getProfilePhotoUrl(sellerProfile?.profilePhoto || fallbackPhoto));
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [draftFirstName, setDraftFirstName] = useState(firstName);
  const [draftMiddleName, setDraftMiddleName] = useState(middleName);
  const [draftLastName, setDraftLastName] = useState(lastName);
  const [draftBio, setDraftBio] = useState(displayBio);
  const [isPhotoSourceOpen, setIsPhotoSourceOpen] = useState(false);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const isBackHovered = false;
  const [isHeadingHovered, setIsHeadingHovered] = useState(false);
  const [isManageHovered, setIsManageHovered] = useState(false);
  const [isPortfolioHovered, setIsPortfolioHovered] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [isUploadingPortfolioDoc, setIsUploadingPortfolioDoc] = useState(false);
  const [portfolioDocuments, setPortfolioDocuments] = useState([]);
  const [workerServices, setWorkerServices] = useState([]);
  const [selectedBoostServiceId, setSelectedBoostServiceId] = useState('');
  const [boostDays, setBoostDays] = useState('7');
  const [boostBudget, setBoostBudget] = useState('250');
  const [isBoostSaving, setIsBoostSaving] = useState(false);
  const [boostMessage, setBoostMessage] = useState('');
  const [isBoostTermsOpen, setIsBoostTermsOpen] = useState(false);
  const [isBoostPaymentOpen, setIsBoostPaymentOpen] = useState(false);
  const [pendingBoost, setPendingBoost] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  const cameraInputRef = useRef(null);
  const deviceInputRef = useRef(null);
  const portfolioDocInputRef = useRef(null);
  const themeTokens = getThemeTokens(appTheme);
  const normalizedRole = String(sellerProfile?.role || '').trim().toLowerCase();
  const isWorkerRole = normalizedRole === 'worker' || Boolean(sellerProfile?.isWorker);
  const normalizedVerificationStatus = String(sellerProfile?.verificationStatus || '').trim().toLowerCase();

  useEffect(() => {
    const nextNameParts = sellerProfile?.firstName || sellerProfile?.middleName || sellerProfile?.lastName
      ? {
        firstName: sellerProfile?.firstName || '',
        middleName: sellerProfile?.middleName || '',
        lastName: sellerProfile?.lastName || '',
      }
      : splitNameParts(sellerProfile?.fullName || fallbackName);
    const nextBio = sellerProfile?.bio || fallbackBio;
    const nextPhoto = getProfilePhotoUrl(sellerProfile?.profilePhoto || fallbackPhoto);
    setFirstName(nextNameParts.firstName);
    setMiddleName(nextNameParts.middleName);
    setLastName(nextNameParts.lastName);
    setDisplayBio(nextBio);
    setProfilePhoto(nextPhoto);
    setDraftFirstName(nextNameParts.firstName);
    setDraftMiddleName(nextNameParts.middleName);
    setDraftLastName(nextNameParts.lastName);
    setDraftBio(nextBio);
  }, [fallbackPhoto, sellerProfile?.firstName, sellerProfile?.middleName, sellerProfile?.lastName, sellerProfile?.fullName, sellerProfile?.bio, sellerProfile?.profilePhoto]);

  useEffect(() => {
    setIsProfileLoading(true);
    const timer = setTimeout(() => {
      setIsProfileLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [sellerProfile?.userId]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!sellerProfile?.userId) return;
    try {
      const saved = window.localStorage.getItem(`trabawho-portfolio-documents-${sellerProfile.userId}`);
      setPortfolioDocuments(saved ? JSON.parse(saved) : []);
    } catch (error) {
      setPortfolioDocuments([]);
    }
  }, [sellerProfile?.userId]);

  useEffect(() => {
    if (!isWorkerRole || !sellerProfile?.userId) {
      setWorkerServices([]);
      setSelectedBoostServiceId('');
      return;
    }

    let mounted = true;
    fetchSellerServices(sellerProfile.userId)
      .then((rows) => {
        if (!mounted) return;
        setWorkerServices(rows || []);
        setSelectedBoostServiceId((previous) => previous || rows?.[0]?.id || '');
      })
      .catch((error) => {
        if (mounted) setSaveError(error?.message || 'Unable to load services for boosting.');
      });

    return () => {
      mounted = false;
    };
  }, [isWorkerRole, sellerProfile?.userId]);

  const resolvedProvince = userLocation?.province || sellerProfile?.province || '';
  const resolvedCity = userLocation?.city || sellerProfile?.city || '';
  const resolvedBarangay = userLocation?.barangay || sellerProfile?.barangay || '';
  const fullAddress = userLocation?.address || sellerProfile?.address || '';
  const locationParts = [resolvedBarangay, resolvedCity, resolvedProvince].filter(Boolean);
  const localizedAddress = locationParts.length > 0 ? locationParts.join(', ') : 'Location not set';

  const isVerifiedWorker = isWorkerRole
    && (sellerProfile?.isVerified || normalizedVerificationStatus === 'approved' || normalizedVerificationStatus === 'verified');
  const displayName = buildDisplayName({ firstName, middleName, lastName }) || fallbackName;
  const hasCustomProfilePhoto = hasUploadedProfilePhoto(profilePhoto);

  const saveName = async () => {
    const nextFirstName = draftFirstName.trim();
    const nextMiddleName = draftMiddleName.trim();
    const nextLastName = draftLastName.trim();
    const nextName = buildDisplayName({ firstName: nextFirstName, middleName: nextMiddleName, lastName: nextLastName }) || fallbackName;
    if (!onUpdateProfile) return;

    try {
      setSaveError('');
      setIsSavingName(true);
      await onUpdateProfile({
        firstName: nextFirstName,
        middleName: nextMiddleName,
        lastName: nextLastName,
        fullName: nextName,
      });
      setFirstName(nextFirstName || fallbackName.split(' ')[0]);
      setMiddleName(nextMiddleName);
      setLastName(nextLastName || fallbackName.split(' ').slice(1).join(' '));
      setIsEditingName(false);
    } catch (error) {
      setSaveError(error?.message || 'Unable to save name right now. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  const saveBio = async () => {
    const nextBio = draftBio.trim() || fallbackBio;
    if (!onUpdateProfile) return;

    try {
      setSaveError('');
      setIsSavingBio(true);
      await onUpdateProfile({ bio: nextBio });
      setDisplayBio(nextBio);
      setIsEditingBio(false);
    } catch (error) {
      setSaveError(error?.message || 'Unable to save bio right now. Please try again.');
    } finally {
      setIsSavingBio(false);
    }
  };

  const handleImageSelection = async (event) => {
    const selectedFile = event.target.files && event.target.files[0];
    if (!selectedFile) return;

    if (!String(selectedFile.type || '').toLowerCase().startsWith('image/')) {
      setSaveError('Please choose a valid image file (JPG, PNG, WEBP, etc.).');
      event.target.value = '';
      return;
    }

    if (selectedFile.size > MAX_PROFILE_PHOTO_BYTES) {
      setSaveError('Profile photo is too large. Maximum size is 2 MB.');
      event.target.value = '';
      return;
    }

    if (onUpdateProfile) {
      try {
        setSaveError('');
        setIsSavingPhoto(true);
        const mergedProfile = await onUpdateProfile({ profilePhotoFile: selectedFile });
        if (mergedProfile?.profilePhoto) {
          setProfilePhoto(getProfilePhotoUrl(mergedProfile.profilePhoto));
        }
      } catch (error) {
        setSaveError(error?.message || 'Unable to save profile photo right now. Please try again.');
      } finally {
        setIsSavingPhoto(false);
      }
    }

    setIsPhotoSourceOpen(false);
    event.target.value = '';
  };

  const handleRemovePhoto = async () => {
    if (!onUpdateProfile) return;
    try {
      setSaveError('');
      setIsSavingPhoto(true);
      const merged = await onUpdateProfile({ profilePhoto: '' });
      setProfilePhoto(getProfilePhotoUrl(merged?.profilePhoto));
      setIsPhotoSourceOpen(false);
    } catch (error) {
      setSaveError(error?.message || 'Unable to remove profile photo right now. Please try again.');
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const persistPortfolioDocuments = (documents) => {
    setPortfolioDocuments(documents);
    if (!sellerProfile?.userId) return;
    window.localStorage.setItem(`trabawho-portfolio-documents-${sellerProfile.userId}`, JSON.stringify(documents));
  };

  const handlePortfolioDocumentSelection = async (event) => {
    const selectedFile = event.target.files && event.target.files[0];
    if (!selectedFile || !sellerProfile?.userId) return;

    try {
      setSaveError('');
      setIsUploadingPortfolioDoc(true);
      const uploaded = await uploadPortfolioDocument({ userId: sellerProfile.userId, file: selectedFile });
      persistPortfolioDocuments([uploaded, ...portfolioDocuments].slice(0, 12));
    } catch (error) {
      setSaveError(error?.message || 'Unable to upload portfolio document right now.');
    } finally {
      setIsUploadingPortfolioDoc(false);
      event.target.value = '';
    }
  };

  const handleRemovePortfolioDocument = (storagePath) => {
    persistPortfolioDocuments(portfolioDocuments.filter((document) => document.storagePath !== storagePath));
  };

  const selectedBoostService = workerServices.find((service) => String(service.id) === String(selectedBoostServiceId)) || null;
  const getServiceAdBooster = (service = {}) => service?.metadata?.ad_booster || service?.metadata?.adBooster || null;
  const getActiveBoostStatus = (service = {}) => {
    const adBooster = getServiceAdBooster(service);
    const boostEndsAt = adBooster?.ends_at || adBooster?.endsAt || null;
    const boostEndsTime = boostEndsAt ? new Date(boostEndsAt).getTime() : null;
    const hasValidEnd = boostEndsTime === null || Number.isFinite(boostEndsTime);
    const isBoosted = Boolean(adBooster?.active)
      && hasValidEnd
      && (boostEndsTime === null || boostEndsTime > Date.now());

    return { boostEndsAt, isBoosted };
  };
  const formatBoostEndDate = (boostEndsAt) => (
    boostEndsAt ? new Date(boostEndsAt).toLocaleDateString() : 'manually stopped'
  );
  const selectedBoostStatus = getActiveBoostStatus(selectedBoostService);
  const selectedBoostEndLabel = formatBoostEndDate(selectedBoostStatus.boostEndsAt);

  const buildBoostDraft = () => {
    if (!selectedBoostServiceId) {
      setSaveError('Choose a gig/service to boost.');
      return null;
    }
    if (selectedBoostStatus.isBoosted) {
      setSaveError(`This gig is already boosted until ${selectedBoostEndLabel}.`);
      return null;
    }

    const days = Math.max(1, Number(boostDays) || 7);
    const budget = Math.max(0, Number(boostBudget) || 0);
    if (budget <= 0) {
      setSaveError('Enter a boost budget before continuing to payment.');
      return null;
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + days);
    return {
      serviceId: selectedBoostServiceId,
      serviceTitle: selectedBoostService?.title || selectedBoostService?.short_description || 'Selected gig',
      days,
      budget,
      boost: {
        active: true,
        budget_php: budget,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        label: 'Worker ad booster',
      },
    };
  };

  const handleStartBoostFlow = () => {
    const draft = buildBoostDraft();
    if (!draft) return;

    setSaveError('');
    setBoostMessage('');
    setPendingBoost(draft);
    setIsBoostTermsOpen(true);
  };

  const handleCancelBoostFlow = () => {
    setIsBoostTermsOpen(false);
    setIsBoostPaymentOpen(false);
    setPendingBoost(null);
  };

  const handleConfirmBoostTerms = () => {
    setIsBoostTermsOpen(false);
    setIsBoostPaymentOpen(true);
  };

  const handleSaveBoost = async (paymentMethod, mockPayment) => {
    const draft = pendingBoost || buildBoostDraft();
    if (!draft) return;

    const boost = {
      ...draft.boost,
      payment: {
        method: paymentMethod,
        amount_php: draft.budget,
        reference: mockPayment?.mockPaymentReference || '',
        provider: mockPayment?.mockPaymentProvider || 'GCash sandbox',
        status: mockPayment?.mockPaymentStatus || 'test-approved',
        confirmed_at: mockPayment?.mockPaymentAt || new Date().toISOString(),
      },
    };

    try {
      setSaveError('');
      setBoostMessage('');
      setIsBoostSaving(true);
      const updated = await updateServiceAdBoost({ serviceId: draft.serviceId, boost });
      setWorkerServices((services) => services.map((service) => (
        String(service.id) === String(draft.serviceId) ? (updated || { ...service, metadata: { ...(service.metadata || {}), ad_booster: boost } }) : service
      )));
      setIsBoostPaymentOpen(false);
      setPendingBoost(null);
      setBoostMessage('Payment confirmed. This gig will be prioritized in marketplace recommendation views while the boost is active.');
    } catch (error) {
      setSaveError(error?.message || 'Unable to save this ad boost.');
    } finally {
      setIsBoostSaving(false);
    }
  };

  const styles = {
    page: { minHeight: '100vh', background: themeTokens.pageBg, color: themeTokens.textPrimary, fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'stretch' },
    header: { width: '100%', boxSizing: 'border-box', backgroundColor: themeTokens.surface, borderBottom: `1px solid ${themeTokens.border}`, padding: isMobile ? '12px 14px' : '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50, boxShadow: themeTokens.shadowSoft },
    backBtn: { border: `1px solid ${isBackHovered ? themeTokens.accent : themeTokens.border}`, background: isBackHovered ? themeTokens.surfaceAlt : 'transparent', color: isBackHovered ? themeTokens.accent : themeTokens.textPrimary, padding: isMobile ? '7px 11px' : '8px 14px', borderRadius: '6px', fontSize: isMobile ? '12px' : '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease' },
    title: { fontSize: isMobile ? '20px' : '24px', fontWeight: 700, margin: 0, color: themeTokens.textPrimary },
    headerSpacer: { width: isMobile ? '0' : '92px' },
    main: { width: '100%', maxWidth: 'none', margin: 0, padding: isMobile ? '20px 12px' : '32px 24px', boxSizing: 'border-box' },
    card: { width: '100%', maxWidth: 'none', margin: 0, boxSizing: 'border-box', background: themeTokens.surface, border: `1px solid ${themeTokens.border}`, borderRadius: '12px', boxShadow: themeTokens.shadow, padding: isMobile ? '18px 14px' : '32px' },
    hero: { textAlign: 'center', margin: '0 0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    profilePhotoButton: { border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    profilePhoto: { width: isMobile ? '120px' : '150px', height: isMobile ? '120px' : '150px', borderRadius: '50%', objectFit: 'cover', border: `4px solid ${themeTokens.border}`, display: 'block', margin: '0 auto' },
    profileAvatarSkeleton: { width: isMobile ? '120px' : '150px', height: isMobile ? '120px' : '150px', borderRadius: '50%', border: `4px solid ${themeTokens.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: themeTokens.surfaceAlt },
    avatarPlaceholder: { width: isMobile ? '112px' : '142px', height: isMobile ? '112px' : '142px', borderRadius: '50%', background: themeTokens.surfaceSoft },
    textPlaceholder: { height: '12px', borderRadius: '999px', background: themeTokens.surfaceSoft },
    profilePhotoEdit: { fontSize: '12px', fontWeight: 700, color: themeTokens.accent },
    inlineEditRow: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', justifyContent: 'center', flexWrap: 'wrap' },
    inlineEditInput: { minWidth: isMobile ? '0' : '260px', width: isMobile ? '100%' : 'auto', border: `1px solid ${themeTokens.inputBorder}`, borderRadius: '8px', padding: '8px 10px', fontSize: '16px', background: themeTokens.inputBg, color: themeTokens.inputText },
    inlineEditSave: { border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontWeight: 700, background: themeTokens.accent, color: '#ffffff' },
    inlineEditCancel: { border: 'none', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', fontWeight: 700, background: themeTokens.surfaceAlt, color: themeTokens.textPrimary },
    editableHeading: { margin: '12px 0 8px', color: isHeadingHovered ? themeTokens.accent : themeTokens.textPrimary, cursor: 'pointer' },
    verifiedBadge: { display: 'inline-block', background: themeTokens.successBg, color: themeTokens.successText, border: `1px solid ${themeTokens.successBorder}`, borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 700 },
    profileSection: { marginBottom: '18px', padding: '14px', border: `1px solid ${themeTokens.border}`, borderRadius: '10px', background: themeTokens.surfaceAlt },
    portfolioSection: { background: themeTokens.accentSoft, border: `2px solid ${themeTokens.accent}` },
    h2: { margin: '0 0 8px', color: themeTokens.textPrimary, fontSize: '18px' },
    h2Portfolio: { margin: '0 0 8px', color: themeTokens.accent, fontSize: '18px' },
    sectionHeadingRow: { display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? '8px' : '0', flexWrap: isMobile ? 'wrap' : 'nowrap', marginBottom: '8px' },
    sectionEditBtn: { border: `1px solid ${themeTokens.border}`, borderRadius: '8px', background: themeTokens.surface, color: themeTokens.textPrimary, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' },
    bioEditWrap: { display: 'flex', flexDirection: 'column', gap: '10px' },
    bioEditInput: { border: `1px solid ${themeTokens.inputBorder}`, borderRadius: '8px', padding: '10px', resize: 'vertical', minHeight: '90px', background: themeTokens.inputBg, color: themeTokens.inputText },
    bioEditActions: { display: 'flex', gap: '8px' },
    paragraph: { margin: 0, color: themeTokens.textSecondary, lineHeight: 1.55 },
    saveError: {
      margin: '0 0 14px',
      color: themeTokens.danger,
      background: themeTokens.dangerBg,
      border: `1px solid ${themeTokens.dangerBorder}`,
      borderRadius: '8px',
      padding: '10px 12px',
      fontSize: '0.92rem',
      fontWeight: 600,
    },
    portfolioParagraph: { margin: 0, color: themeTokens.textPrimary, lineHeight: 1.55 },
    generatePortfolioBtn: { width: '100%', border: 'none', borderRadius: '8px', padding: '12px', background: isPortfolioHovered ? themeTokens.accentHover : themeTokens.accent, color: '#ffffff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', marginTop: '8px', transition: 'all 0.3s ease', transform: isPortfolioHovered ? 'translateY(-2px)' : 'translateY(0)', boxShadow: isPortfolioHovered ? themeTokens.accentShadow : 'none' },
    portfolioDocActions: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' },
    portfolioDocList: { display: 'grid', gap: '8px', marginTop: '12px' },
    portfolioDocItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${themeTokens.border}`, background: themeTokens.surface },
    portfolioDocName: { color: themeTokens.textPrimary, fontWeight: 700, textDecoration: 'none', wordBreak: 'break-word' },
    portfolioDocMeta: { margin: '2px 0 0', color: themeTokens.textMuted, fontSize: '12px' },
    boosterGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr 0.8fr', gap: '10px', marginTop: '12px' },
    boosterInput: { minHeight: '42px', border: `1px solid ${themeTokens.inputBorder}`, borderRadius: '8px', padding: '9px 10px', background: themeTokens.inputBg, color: themeTokens.inputText, width: '100%', boxSizing: 'border-box' },
    boosterLabel: { display: 'grid', gap: '6px', color: themeTokens.textPrimary, fontSize: '13px', fontWeight: 700 },
    boosterHint: { margin: '10px 0 0', color: themeTokens.textSecondary, fontSize: '13px', fontWeight: 700 },
    boosterSuccess: { margin: '10px 0 0', color: themeTokens.successText, background: themeTokens.successBg, border: `1px solid ${themeTokens.successBorder}`, borderRadius: '8px', padding: '9px 10px', fontWeight: 700, fontSize: '13px' },
    manageAccountBtn: { width: '100%', border: 'none', borderRadius: '10px', padding: '14px', background: isManageHovered ? themeTokens.surfaceAlt : themeTokens.surfaceSoft, color: themeTokens.textPrimary, fontWeight: 700, fontSize: '15px', cursor: 'pointer' },
    photoSourceOverlay: { position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 220 },
    photoSourceModal: { width: 'min(460px, 94vw)', background: themeTokens.surface, color: themeTokens.textPrimary, border: `1px solid ${themeTokens.border}`, borderRadius: '14px', padding: '20px', boxShadow: themeTokens.shadow },
    modalTitle: { margin: '0 0 8px', fontSize: '1.55rem', lineHeight: 1.2, color: themeTokens.textPrimary },
    modalText: { margin: '0 0 8px', color: themeTokens.textSecondary, fontSize: '1rem' },
    modalHint: { margin: '0 0 14px', color: themeTokens.textMuted, fontSize: '0.9rem' },
    photoSourceActions: { display: 'grid', gap: '8px' },
    photoActionBtn: { border: 'none', borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', background: themeTokens.accent, color: '#ffffff' },
    cancelBtn: { border: `1px solid ${themeTokens.border}`, borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', background: themeTokens.surfaceAlt, color: themeTokens.textPrimary },
  };

  const boostTerms = [
    'You agree that the selected gig, duration, and budget are accurate before the ad boost is activated.',
    'TrabaWho may use your service title, profile details, location, category, and boost settings to prioritize this gig in marketplace recommendation views.',
    'This test payment flow records a sandbox payment reference only. No real GCash or cash transfer is processed.',
    'Boost placement can improve visibility, but it does not guarantee client inquiries, bookings, or earnings.',
  ];
  const boostPaymentBooking = pendingBoost ? {
    workerName: 'TrabaWho Ad Booster',
    serviceType: pendingBoost.serviceTitle,
    quoteAmount: pendingBoost.budget,
    allowGcashAdvance: true,
    allowAfterService: false,
    isRequestBooking: true,
  } : null;

  return (
    <div style={styles.page} data-testid="profile-page">
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
          {saveError && <p style={styles.saveError}>{saveError}</p>}

          <div style={styles.hero}>
            {isProfileLoading ? (
              <div style={styles.profilePhotoButton}>
                <div style={styles.profileAvatarSkeleton}>
                  <div style={styles.avatarPlaceholder} />
                </div>
                <div style={{ ...styles.textPlaceholder, width: '120px' }} />
              </div>
            ) : (
              <button style={styles.profilePhotoButton} onClick={() => setIsPhotoSourceOpen(true)}>
                <img src={profilePhoto} alt={displayName} style={styles.profilePhoto} />
                <span style={styles.profilePhotoEdit}>{isSavingPhoto ? 'Saving Photo...' : (hasCustomProfilePhoto ? 'Change Photo' : 'Add Photo')}</span>
              </button>
            )}

            {isProfileLoading ? (
              <div style={{ ...styles.textPlaceholder, width: '220px' }} />
            ) : isEditingName ? (
              <div style={styles.inlineEditRow}>
                <input style={{ ...styles.inlineEditInput, minWidth: '160px' }} type="text" value={draftFirstName} onChange={(event) => setDraftFirstName(event.target.value)} placeholder="First name" />
                <input style={{ ...styles.inlineEditInput, minWidth: '160px' }} type="text" value={draftMiddleName} onChange={(event) => setDraftMiddleName(event.target.value)} placeholder="Middle name (optional)" />
                <input style={{ ...styles.inlineEditInput, minWidth: '160px' }} type="text" value={draftLastName} onChange={(event) => setDraftLastName(event.target.value)} placeholder="Last name" />
                <button style={styles.inlineEditSave} onClick={saveName} disabled={isSavingName}>{isSavingName ? 'Saving...' : 'Save'}</button>
                <button style={styles.inlineEditCancel} onClick={() => { setIsEditingName(false); setDraftFirstName(firstName); setDraftMiddleName(middleName); setDraftLastName(lastName); }}>
                  Cancel
                </button>
              </div>
            ) : (
              <h1
                style={styles.editableHeading}
                onMouseEnter={() => setIsHeadingHovered(true)}
                onMouseLeave={() => setIsHeadingHovered(false)}
                onClick={() => setIsEditingName(true)}
              >
                {displayName}
              </h1>
            )}

            {isProfileLoading ? (
              <div style={{ ...styles.textPlaceholder, width: '130px' }} />
            ) : (
              isVerifiedWorker && <span style={styles.verifiedBadge}>Verified Worker</span>
            )}
          </div>

          <section style={styles.profileSection}>
            <div style={styles.sectionHeadingRow}>
              <h2 style={styles.h2}>Bio</h2>
              {!isEditingBio && (
                <button style={styles.sectionEditBtn} onClick={() => setIsEditingBio(true)}>
                  Edit
                </button>
              )}
            </div>

            {isProfileLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ ...styles.textPlaceholder, width: '85%' }} />
                <div style={{ ...styles.textPlaceholder, width: '90%' }} />
                <div style={{ ...styles.textPlaceholder, width: '72%' }} />
                <div style={{ ...styles.textPlaceholder, width: '66%' }} />
              </div>
            ) : isEditingBio ? (
              <div style={styles.bioEditWrap}>
                <textarea
                  style={styles.bioEditInput}
                  rows={4}
                  value={draftBio}
                  onChange={(event) => setDraftBio(event.target.value)}
                  maxLength={280}
                ></textarea>
                <div style={styles.bioEditActions}>
                  <button style={styles.inlineEditSave} onClick={saveBio} disabled={isSavingBio}>{isSavingBio ? 'Saving...' : 'Save'}</button>
                  <button style={styles.inlineEditCancel} onClick={() => { setIsEditingBio(false); setDraftBio(displayBio); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p style={styles.paragraph}>{displayBio}</p>
            )}
          </section>

          <section style={styles.profileSection}>
            <h2 style={styles.h2}>Address</h2>
            {isProfileLoading ? <div style={{ ...styles.textPlaceholder, width: '70%' }} /> : (
              <>
                {fullAddress && <p style={styles.paragraph}><strong>Street Address:</strong> {fullAddress}</p>}
                <p style={styles.paragraph}><strong>Location:</strong> {localizedAddress}</p>
              </>
            )}
          </section>

          {isWorkerRole && (
            <section style={{ ...styles.profileSection, ...styles.portfolioSection }}>
              <h2 style={styles.h2Portfolio}>Digital Professional Portfolio</h2>
              <p style={styles.portfolioParagraph}>Generate and download your professional resume with QR code verification for clients.</p>
              <button
                style={styles.generatePortfolioBtn}
                onMouseEnter={() => setIsPortfolioHovered(true)}
                onMouseLeave={() => setIsPortfolioHovered(false)}
                onClick={() => setIsPortfolioModalOpen(true)}
              >
                Generate & Download Portfolio
              </button>

              <div style={styles.portfolioDocActions}>
                <button
                  type="button"
                  style={{ ...styles.sectionEditBtn, padding: '10px 12px' }}
                  onClick={() => portfolioDocInputRef.current && portfolioDocInputRef.current.click()}
                  disabled={isUploadingPortfolioDoc}
                >
                  {isUploadingPortfolioDoc ? 'Uploading...' : 'Upload Portfolio Document'}
                </button>
                <input
                  ref={portfolioDocInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handlePortfolioDocumentSelection}
                />
              </div>

              {portfolioDocuments.length > 0 && (
                <div style={styles.portfolioDocList}>
                  {portfolioDocuments.map((document) => (
                    <div key={document.storagePath || document.publicUrl} style={styles.portfolioDocItem}>
                      <div>
                        <a href={document.publicUrl} target="_blank" rel="noreferrer" style={styles.portfolioDocName}>
                          {document.name}
                        </a>
                        <p style={styles.portfolioDocMeta}>
                          {document.uploadedAt ? String(document.uploadedAt).slice(0, 10) : 'Uploaded'} - {Math.ceil((document.size || 0) / 1024)} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        style={styles.inlineEditCancel}
                        onClick={() => handleRemovePortfolioDocument(document.storagePath)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {isWorkerRole && (
            <section style={styles.profileSection}>
              <h2 style={styles.h2}>Ad Booster</h2>
              <p style={styles.paragraph}>Boost one of your gigs in marketplace recommendation views.</p>
              <div style={styles.boosterGrid}>
                <label style={styles.boosterLabel}>
                  Gig
                  <select
                    value={selectedBoostServiceId}
                    onChange={(event) => setSelectedBoostServiceId(event.target.value)}
                    style={styles.boosterInput}
                  >
                    {workerServices.length === 0 && <option value="">No gigs found</option>}
                    {workerServices.map((service) => {
                      const boostStatus = getActiveBoostStatus(service);
                      return (
                        <option key={service.id} value={service.id}>
                          {service.title || service.short_description || 'Untitled gig'}
                          {boostStatus.isBoosted ? ` (Boosted until ${formatBoostEndDate(boostStatus.boostEndsAt)})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label style={styles.boosterLabel}>
                  Days
                  <input
                    type="number"
                    min="1"
                    value={boostDays}
                    onChange={(event) => setBoostDays(event.target.value)}
                    style={styles.boosterInput}
                  />
                </label>
                <label style={styles.boosterLabel}>
                  Budget PHP
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={boostBudget}
                    onChange={(event) => setBoostBudget(event.target.value)}
                    style={styles.boosterInput}
                  />
                </label>
              </div>
              {selectedBoostStatus.isBoosted && (
                <p style={styles.boosterHint}>This gig is already boosted until {selectedBoostEndLabel}.</p>
              )}
              <button
                type="button"
                style={{ ...styles.generatePortfolioBtn, marginTop: '12px' }}
                onClick={handleStartBoostFlow}
                disabled={isBoostSaving || !selectedBoostServiceId || selectedBoostStatus.isBoosted}
              >
                {isBoostSaving ? 'Saving Boost...' : selectedBoostStatus.isBoosted ? 'Gig Already Boosted' : 'Boost Selected Gig'}
              </button>
              {boostMessage && <p style={styles.boosterSuccess}>{boostMessage}</p>}
            </section>
          )}

          <button
            style={styles.manageAccountBtn}
            onMouseEnter={() => setIsManageHovered(true)}
            onMouseLeave={() => setIsManageHovered(false)}
            onClick={onManageAccount}
          >
            Manage Account & Privacy
          </button>

          {isPhotoSourceOpen && (
            <div style={styles.photoSourceOverlay}>
              <div style={styles.photoSourceModal}>
                <h3 style={styles.modalTitle}>Change Profile Photo</h3>
                <p style={styles.modalText}>Select image source:</p>
                <p style={styles.modalHint}>Supported on phone, tablet, and desktop. Max file size: 2 MB.</p>
                <div style={styles.photoSourceActions}>
                  <button style={styles.photoActionBtn} onClick={() => cameraInputRef.current && cameraInputRef.current.click()}>Use Camera</button>
                  <button style={styles.photoActionBtn} onClick={() => deviceInputRef.current && deviceInputRef.current.click()}>From Device</button>
                  {hasCustomProfilePhoto && (
                    <button
                      style={{ ...styles.cancelBtn }}
                      onClick={handleRemovePhoto}
                    >
                      {isSavingPhoto ? 'Removing...' : 'Remove Photo'}
                    </button>
                  )}
                  <button style={styles.cancelBtn} onClick={() => setIsPhotoSourceOpen(false)}>Cancel</button>
                </div>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  style={{ display: 'none' }}
                  onChange={handleImageSelection}
                />
                <input
                  ref={deviceInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageSelection}
                />
              </div>
            </div>
          )}

          <BookingTermsModal
            isOpen={isBoostTermsOpen}
            appTheme={appTheme}
            title="Agree Before Boost Payment"
            subtitle="Please review these TrabaWho ad boost terms before continuing to payment."
            confirmLabel="Agree and Open Payment"
            terms={boostTerms}
            agreementLabel="I agree to the TrabaWho ad boost Terms and Conditions for this selected gig."
            onCancel={handleCancelBoostFlow}
            onConfirm={handleConfirmBoostTerms}
          />

          {isBoostPaymentOpen && boostPaymentBooking && (
            <PaymentModal
              booking={boostPaymentBooking}
              title="Pay for Gig Boost"
              subtitle="Complete the mock payment step before this selected gig boost goes live."
              amountLabel="Boost budget"
              scheduleLabel="Duration:"
              scheduleValue={`${pendingBoost?.days || 1} ${Number(pendingBoost?.days || 1) === 1 ? 'day' : 'days'}`}
              advancePaymentDescription="Pay now via GCash to activate the selected gig boost."
              transactionFeeRate={0}
              testModeTitle="Mock boost payment test mode"
              testModeDescription="This flow records a sandbox ad-boost payment reference only. No real GCash transfer is processed."
              confirmLabel="Run Mock Payment & Activate Boost"
              onSelectPayment={handleSaveBoost}
              onCancel={handleCancelBoostFlow}
            />
          )}

          <DigitalPortfolioModal
            isOpen={isPortfolioModalOpen}
            workerName={displayName}
            serviceType={sellerProfile?.serviceType ? (sellerProfile.serviceType === 'Others' ? sellerProfile.customServiceType : sellerProfile.serviceType) : 'General Service'}
            bio={displayBio}
            location={localizedAddress}
            rating={4.8}
            gcashNumber={sellerProfile?.gcashNumber || '09XXXXXXXXX'}
            onClose={() => setIsPortfolioModalOpen(false)}
          />
        </div>
      </main>
    </div>
  );
}

export default Profile;
