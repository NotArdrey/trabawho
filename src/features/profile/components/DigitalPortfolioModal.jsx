

import { useEffect, useState } from 'react';

/**
 * DigitalPortfolioModal Component
 * 
 * Generates and downloads a professional PDF resume with QR code for the worker.
 * Uses jsPDF to create the PDF document client-side.
 * 
 * Features:
 * - Worker profile info (name, service, bio, location)
 * - QR code linking to profile verification
 * - Professional formatting
 * - One-click download
 */
const DigitalPortfolioModal = ({
  isOpen,
  workerName = 'Service Provider',
  serviceType = 'General Service',
  bio = 'Dedicated service professional',
  location = 'Baliwag, Bulacan',
  rating = 4.8,
  profilePhoto,
  gcashNumber = '09XXXXXXXXX',
  onClose,
}) => {
  const [generationError, setGenerationError] = useState('');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 720 : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => setIsMobile(window.innerWidth <= 720);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen) return null;

  const styles = {
    overlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.58)',
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'center',
      padding: isMobile ? '0.75rem' : '1rem',
      zIndex: 280,
      overflowY: 'auto',
    },
    card: {
      width: 'min(100%, 980px)',
      maxHeight: isMobile ? 'calc(100svh - 24px)' : '94vh',
      overflowY: 'auto',
      backgroundColor: '#ffffff',
      borderRadius: '0.9rem',
      border: '1px solid #e2e8f0',
      boxShadow: '0 18px 42px rgba(15, 23, 42, 0.26)',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: '0.75rem',
      padding: isMobile ? '0.75rem' : '0.85rem 1rem',
      borderBottom: '1px solid #e2e8f0',
      backgroundColor: '#f8fafc',
    },
    close: { width: '32px', height: '32px', borderRadius: '999px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer' },
    body: {
      display: 'grid',
      gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(270px, 1.4fr) minmax(220px, 1fr)',
      gap: '0.8rem',
      padding: isMobile ? '0.75rem' : '1rem',
      alignItems: 'start',
    },
    previewWrap: { width: '100%' },
    previewCard: {
      border: '1px solid #e2e8f0',
      borderRadius: '0.7rem',
      backgroundColor: '#ffffff',
      padding: '0.9rem',
      color: '#0f172a',
      overflowWrap: 'break-word',
    },
    previewHeader: {
      borderBottom: '1px solid #e2e8f0',
      paddingBottom: '0.5rem',
      marginBottom: '0.6rem',
    },
    previewService: { margin: 0, color: 'var(--gl-blue)', fontWeight: 700 },
    previewRating: { margin: '0.25rem 0 0', color: '#334155' },
    section: { marginBottom: '0.55rem' },
    qrSection: { textAlign: 'center' },
    qrImage: { width: '120px', height: '120px', objectFit: 'contain' },
    previewFooter: { color: '#64748b', fontSize: '0.8rem', marginTop: '0.6rem' },
    infoBox: {
      border: '1px solid #e2e8f0',
      borderRadius: '0.7rem',
      backgroundColor: '#f8fafc',
      padding: '0.8rem',
      color: '#334155',
      fontSize: '0.92rem',
      lineHeight: 1.45,
    },
    errorNotice: {
      marginTop: '0.75rem',
      border: '1px solid #fecaca',
      borderRadius: '0.55rem',
      backgroundColor: '#fee2e2',
      color: '#991b1b',
      padding: '0.65rem 0.75rem',
      fontSize: '0.92rem',
      fontWeight: 700,
    },
    actions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.5rem',
      borderTop: '1px solid #e2e8f0',
      padding: isMobile ? '0.75rem' : '0.75rem 1rem',
      flexDirection: isMobile ? 'column' : 'row',
    },
    cancelButton: { border: '1px solid #cbd5e1', borderRadius: '0.45rem', backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', cursor: 'pointer', fontWeight: 600, width: isMobile ? '100%' : 'auto' },
    downloadButton: { border: 'none', borderRadius: '0.45rem', backgroundColor: 'var(--gl-blue)', color: '#ffffff', padding: '0.5rem 0.75rem', cursor: 'pointer', fontWeight: 700, width: isMobile ? '100%' : 'auto' },
  };

  const generatePDF = async () => {
    try {
      setGenerationError('');
      // Dynamically import jsPDF to avoid build-time dependency issues
      const { jsPDF } = await import('jspdf');

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Background color (TrabaWho brand accent)
      doc.setFillColor(21, 87, 192);
      doc.rect(0, 0, pageWidth, 50, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Digital Professional Portfolio', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('TrabaWho Verified Professional', pageWidth / 2, 30, { align: 'center' });

      // Main content starts
      doc.setTextColor(0, 0, 0);
      let yPosition = 60;

      // Worker Name
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(workerName, 20, yPosition);
      yPosition += 8;

      // Service Type
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Service: ${serviceType}`, 20, yPosition);
      yPosition += 8;

      // Rating
      doc.text(`Rating: ⭐ ${rating}/5 (TrabaWho Verified)`, 20, yPosition);
      yPosition += 12;

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 8;

      // Bio Section
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(21, 87, 192);
      doc.text('Professional Summary', 20, yPosition);
      yPosition += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const bioLines = doc.splitTextToSize(bio, pageWidth - 40);
      doc.text(bioLines, 20, yPosition);
      yPosition += bioLines.length * 5 + 4;

      // Location Section
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(21, 87, 192);
      doc.text('Service Location', 20, yPosition);
      yPosition += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`📍 ${location}`, 20, yPosition);
      yPosition += 10;

      // Payment Method Section
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(21, 87, 192);
      doc.text('Payment Method', 20, yPosition);
      yPosition += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`💳 GCash: ${gcashNumber}`, 20, yPosition);
      yPosition += 10;

      // QR Code Section
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(21, 87, 192);
      doc.text('Verification QR Code', 20, yPosition);
      yPosition += 6;

      // Generate QR code image (using QR server API)
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
        `TrabaWho Profile: ${workerName} - ${serviceType}`
      )}`;

      try {
        doc.addImage(qrCodeUrl, 'PNG', 20, yPosition, 50, 50);
      } catch (e) {
        doc.setFontSize(9);
        doc.text('QR Code: Visit trabawho.app to verify profile', 20, yPosition);
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Generated by TrabaWho • Trusted Service Marketplace', pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 5, { align: 'center' });

      // Download PDF
      const fileName = `${workerName}_TrabaWho_Portfolio_${new Date().getFullYear()}.pdf`;
      doc.save(fileName);
    } catch (error) {
      setGenerationError('Could not generate PDF. Please try again.');
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="portfolio-modal-title">
      <div style={styles.card}>
        <div style={styles.header}>
          <h3 id="portfolio-modal-title">Generate Digital Portfolio</h3>
          <button style={styles.close} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          <div style={styles.previewWrap}>
            <div style={styles.previewCard}>
              <div style={styles.previewHeader}>
                <h2>{workerName}</h2>
                <p style={styles.previewService}>{serviceType}</p>
                <p style={styles.previewRating}>⭐ {rating}/5 - TrabaWho Verified</p>
              </div>

              <div style={styles.section}>
                <h4>Professional Summary</h4>
                <p>{bio}</p>
              </div>

              <div style={styles.section}>
                <h4>Service Location</h4>
                <p>📍 {location}</p>
              </div>

              <div style={styles.section}>
                <h4>Payment Method</h4>
                <p>💳 GCash: {gcashNumber}</p>
              </div>

              <div style={{ ...styles.section, ...styles.qrSection }}>
                <h4>Verification QR Code</h4>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                    `TrabaWho Profile: ${workerName} - ${serviceType}`
                  )}`}
                  alt="Profile QR Code"
                  style={styles.qrImage}
                />
              </div>

              <p style={styles.previewFooter}>
                Generated by TrabaWho • Trusted Service Marketplace
              </p>
            </div>
          </div>

          <div style={styles.infoBox}>
            <p>
              <strong>📄 PDF Resume:</strong> This professional portfolio will be downloaded as a PDF file that you can share with clients, print, or display online.
            </p>
            <p>
              <strong>🔐 QR Verification:</strong> The embedded QR code verifies your profile on TrabaWho, building trust with potential clients.
            </p>
            <p>
              <strong>💼 Professional Use:</strong> Use this portfolio in emails, social media, or print ads to establish your professional identity.
            </p>
            {generationError && (
              <div style={styles.errorNotice} role="alert">
                {generationError}
              </div>
            )}
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button style={styles.downloadButton} onClick={generatePDF}>
            📥 Download PDF Portfolio
          </button>
        </div>
      </div>
    </div>
  );
};

export default DigitalPortfolioModal;
