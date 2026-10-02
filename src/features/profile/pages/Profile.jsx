import { useEffect, useRef, useState } from 'react';
import DashboardNavigation from '../../../shared/components/DashboardNavigation';
import DigitalPortfolioModal from '../components/DigitalPortfolioModal';
import { ProfilePortfolioSection } from '../components/ProfilePortfolioSection';
import { GigBoostPanel } from '../components/GigBoostPanel';
import AccountPrivacyPanel from '../components/AccountPrivacyPanel';
import { ProfilePhotoDialog } from '../components/ProfilePhotoDialog';
import { ProfileNameDialog } from '../components/ProfileNameDialog';
import { getThemeTokens } from '../../../shared/styles/themeTokens';
import { getProfilePhotoUrl, hasUploadedProfilePhoto } from '../../../shared/utils/profilePhoto';
import { uploadPortfolioDocument } from '../../../shared/services/authService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, MapPin, Pencil, ShieldCheck, UserRoundCog } from 'lucide-react';

function Profile({ appTheme = 'light', themeMode = 'system', onThemeChange, currentView, searchQuery, onSearchChange, onLogout, onOpenSellerSetup, onOpenMyBookings, onOpenChatPage, sellerProfile, onOpenMyWork, onOpenProfile, onOpenAccountSettings, onOpenSettings, onOpenDashboard, onOpenBrowseServices, userLocation, onUpdateProfile, onUpdatePassword, onOpenAdminDashboard }) {
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
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [isUploadingPortfolioDoc, setIsUploadingPortfolioDoc] = useState(false);
  const [portfolioDocuments, setPortfolioDocuments] = useState([]);
  const [saveError, setSaveError] = useState('');
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

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
    verifiedBadge: { display: 'inline-block', background: themeTokens.successBg, color: themeTokens.successText, border: `1px solid ${themeTokens.successBorder}`, borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 700 },
    profileSection: { marginBottom: '18px', padding: '14px', border: `1px solid ${themeTokens.border}`, borderRadius: '10px', background: themeTokens.surfaceAlt },
    h2: { margin: '0 0 8px', color: themeTokens.textPrimary, fontSize: '18px' },
    sectionHeadingRow: { display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? '8px' : '0', flexWrap: isMobile ? 'wrap' : 'nowrap', marginBottom: '8px' },
    sectionEditBtn: { border: `1px solid ${themeTokens.border}`, borderRadius: '8px', background: themeTokens.surface, color: themeTokens.textPrimary, padding: '4px 10px', fontWeight: 700, cursor: 'pointer' },
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
    generatePortfolioBtn: { width: '100%', border: 'none', borderRadius: '8px', padding: '12px', background: themeTokens.accent, color: '#ffffff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', marginTop: '8px' },
    portfolioDocItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${themeTokens.border}`, background: themeTokens.surface },
    portfolioDocName: { color: themeTokens.textPrimary, fontWeight: 700, textDecoration: 'none', wordBreak: 'break-word' },
    portfolioDocMeta: { margin: '2px 0 0', color: themeTokens.textMuted, fontSize: '12px' },
  };

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

      <main className="profile-main-modern" style={styles.main}>
        <div className="profile-surface" style={styles.card}>
          {saveError && !isEditingName && <p style={styles.saveError}>{saveError}</p>}

          <div className="profile-identity" style={styles.hero}>
            {isProfileLoading ? (
              <div style={styles.profilePhotoButton}>
                <div style={styles.profileAvatarSkeleton}>
                  <div style={styles.avatarPlaceholder} />
                </div>
                <div style={{ ...styles.textPlaceholder, width: '120px' }} />
              </div>
            ) : (
              <button className="profile-photo-control" style={styles.profilePhotoButton} onClick={() => { setSaveError(''); setIsPhotoSourceOpen(true); }} aria-label={`${hasCustomProfilePhoto ? 'Change' : 'Add'} profile photo`}>
                <span className="profile-photo-frame"><img src={profilePhoto} alt="" style={styles.profilePhoto} /><span className="profile-photo-camera"><Camera size={16} aria-hidden="true" /></span></span>
                <span style={styles.profilePhotoEdit}>{isSavingPhoto ? 'Saving photo…' : (hasCustomProfilePhoto ? 'Change photo' : 'Add photo')}</span>
              </button>
            )}

            {isProfileLoading ? (
              <div style={{ ...styles.textPlaceholder, width: '220px' }} />
            ) : (
              <div className="mt-3 flex max-w-full items-center justify-center gap-1">
                <h1 className="min-w-0 break-words text-xl font-bold tracking-tight text-foreground sm:text-2xl">{displayName}</h1>
                <Button type="button" variant="ghost" size="icon" className="text-primary" onClick={() => { setSaveError(''); setIsEditingName(true); }} aria-label="Edit profile name"><Pencil aria-hidden="true" /></Button>
              </div>
            )}

            {isProfileLoading ? (
              <div style={{ ...styles.textPlaceholder, width: '130px' }} />
            ) : (
              isVerifiedWorker && <Badge variant="success"><ShieldCheck size={14} aria-hidden="true" />Verified provider</Badge>
            )}
          </div>

          <section className="profile-flat-section" style={styles.profileSection}>
            <div style={styles.sectionHeadingRow}>
              <div className="profile-section-title"><UserRoundCog size={18} aria-hidden="true" /><h2 style={styles.h2}>About</h2></div>
              {!isEditingBio && (
                <Button type="button" size="sm" onClick={() => setIsEditingBio(true)}><Pencil aria-hidden="true" />Edit</Button>
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
              <div className="space-y-3">
                <textarea
                  className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={4}
                  value={draftBio}
                  onChange={(event) => setDraftBio(event.target.value)}
                  maxLength={280}
                ></textarea>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setIsEditingBio(false); setDraftBio(displayBio); }}>Cancel</Button>
                  <Button type="button" onClick={saveBio} isLoading={isSavingBio}>{isSavingBio ? 'Saving...' : 'Save'}</Button>
                </div>
              </div>
            ) : (
              <p style={styles.paragraph}>{displayBio}</p>
            )}
          </section>

          <section className="profile-flat-section" style={styles.profileSection}>
            <div className="profile-section-title"><MapPin size={18} aria-hidden="true" /><h2 style={styles.h2}>Location</h2></div>
            {isProfileLoading ? <div style={{ ...styles.textPlaceholder, width: '70%' }} /> : (
              <>
                {fullAddress && <p style={styles.paragraph}><strong>Street Address:</strong> {fullAddress}</p>}
                <p style={styles.paragraph}><strong>Location:</strong> {localizedAddress}</p>
              </>
            )}
          </section>

          {isWorkerRole && (
            <>
              <ProfilePortfolioSection
                documents={portfolioDocuments}
                isUploading={isUploadingPortfolioDoc}
                onChooseFile={() => portfolioDocInputRef.current?.click()}
                onPreview={() => setIsPortfolioModalOpen(true)}
                onRemoveDocument={handleRemovePortfolioDocument}
              />
              <input
                ref={portfolioDocInputRef}
                type="file"
                accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={handlePortfolioDocumentSelection}
              />
            </>
          )}
          {isWorkerRole && <GigBoostPanel sellerId={sellerProfile?.userId} />}

          <div className="mt-1 border-t pt-2">
            <AccountPrivacyPanel
              sellerProfile={sellerProfile}
              userLocation={userLocation}
              onUpdateProfile={onUpdateProfile}
              onUpdatePassword={onUpdatePassword}
            />
          </div>

          <ProfilePhotoDialog
            error={saveError}
            hasPhoto={hasCustomProfilePhoto}
            isOpen={isPhotoSourceOpen}
            isSaving={isSavingPhoto}
            onImageSelection={handleImageSelection}
            onOpenChange={setIsPhotoSourceOpen}
            onRemovePhoto={handleRemovePhoto}
          />
          <ProfileNameDialog
            error={saveError} firstName={draftFirstName} middleName={draftMiddleName} lastName={draftLastName}
            isOpen={isEditingName} isSaving={isSavingName} onSave={saveName}
            onFirstNameChange={setDraftFirstName} onMiddleNameChange={setDraftMiddleName} onLastNameChange={setDraftLastName}
            onOpenChange={(open) => { setIsEditingName(open); if (!open) { setDraftFirstName(firstName); setDraftMiddleName(middleName); setDraftLastName(lastName); setSaveError(''); } }}
          />

          <DigitalPortfolioModal
            isOpen={isPortfolioModalOpen}
            workerName={displayName}
            serviceType={sellerProfile?.serviceType ? (sellerProfile.serviceType === 'Others' ? sellerProfile.customServiceType : sellerProfile.serviceType) : 'General Service'}
            bio={displayBio}
            location={localizedAddress}
            rating={sellerProfile?.averageRating || sellerProfile?.avgRating || sellerProfile?.rating}
            profilePhoto={profilePhoto} isVerified={isVerifiedWorker}
            gcashNumber={sellerProfile?.gcashNumber || '09XXXXXXXXX'}
            onClose={() => setIsPortfolioModalOpen(false)}
          />
        </div>
      </main>
    </div>
  );
}

export default Profile;
