import { isSupabaseConfigured, supabase } from "@/integrations/supabase";

interface ProviderPortfolioData {
  bio: string;
  gcashNumber?: string;
  isVerified: boolean;
  location: string;
  profilePhoto?: string | null;
  ratingLabel: string;
  serviceType: string;
  workerName: string;
}

interface CanvasImageOptions {
  crop?: "circle" | "contain";
  size?: number;
}

const COLORS = {
  blue: [21, 87, 192] as const,
  blueSoft: [234, 242, 255] as const,
  border: [218, 226, 238] as const,
  green: [5, 150, 105] as const,
  orange: [255, 122, 0] as const,
  slate: [71, 85, 105] as const,
  text: [15, 23, 42] as const,
  white: [255, 255, 255] as const,
};

const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("Unable to load image."));
  image.src = url;
});

function getSupabaseStorageLocation(url: string): { bucket: string; path: string } | null {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const match = pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return { bucket: decodeURIComponent(match[1]), path: match[2].split("/").map(decodeURIComponent).join("/") };
  } catch {
    return null;
  }
}

async function fetchImageBlob(url: string): Promise<Blob> {
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "omit" });
    if (response.ok) return response.blob();
  } catch {
    // Authenticated Storage download below handles private or stale public URLs.
  }

  const storageLocation = getSupabaseStorageLocation(url);
  if (!storageLocation || !isSupabaseConfigured) throw new Error("Unable to load image.");
  const { data, error } = await supabase.storage.from(storageLocation.bucket).download(storageLocation.path);
  if (error || !data) throw new Error("Unable to load image.");
  return data;
}

async function imageUrlToPngDataUrl(url: string, options: CanvasImageOptions = {}): Promise<string> {
  const objectUrl = URL.createObjectURL(await fetchImageBlob(url));

  try {
    const image = await loadImage(objectUrl);
    const size = options.size ?? 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare image.");

    if (options.crop === "circle") {
      context.beginPath();
      context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      context.clip();
    }

    const scale = options.crop === "contain"
      ? Math.min(size / image.naturalWidth, size / image.naturalHeight)
      : Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SP";
}

function getPaymentLabel(gcashNumber?: string): string {
  const value = gcashNumber?.trim();
  return value && !value.toUpperCase().includes("X") ? `GCash ${value}` : "Coordinate through TrabaWho";
}

async function generateProviderPortfolio(data: ProviderPortfolioData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const paymentLabel = getPaymentLabel(data.gcashNumber);
  const exportDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date());
  const wrapText = (value: string, width: number): string | string[] => {
    const wrapped: unknown = doc.splitTextToSize(value, width);
    return Array.isArray(wrapped) ? wrapped.map(String) : String(wrapped);
  };
  const fitLines = (value: string, width: number, maximum: number): string[] => {
    const wrapped = wrapText(value, width);
    const lines = Array.isArray(wrapped) ? wrapped : [wrapped];
    if (lines.length <= maximum) return lines;
    return [...lines.slice(0, maximum - 1), `${lines[maximum - 1]}...`];
  };

  const [logoResult, photoResult] = await Promise.allSettled([
    imageUrlToPngDataUrl("/trabawho-logo.svg", { crop: "contain", size: 384 }),
    data.profilePhoto ? imageUrlToPngDataUrl(data.profilePhoto, { crop: "circle", size: 512 }) : Promise.reject(new Error("No photo")),
  ]);

  doc.setFillColor(...COLORS.blue);
  doc.rect(0, 0, pageWidth, 49, "F");
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(margin, 11, 15, 15, 3, 3, "F");
  if (logoResult.status === "fulfilled") doc.addImage(logoResult.value, "PNG", margin + 2, 13, 11, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  const wordmarkX = margin + 20;
  doc.text("Traba", wordmarkX, 19.5);
  const trabaWidth = doc.getTextWidth("Traba");
  doc.setTextColor(...COLORS.orange);
  doc.text("Who", wordmarkX + trabaWidth, 19.5);
  doc.setFontSize(8);
  doc.setTextColor(219, 234, 254);
  doc.text("LOCAL SERVICES MARKETPLACE", margin + 20, 24.5);
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(9);
  doc.text("PROVIDER PORTFOLIO", pageWidth - margin, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(219, 234, 254);
  doc.text(`Prepared ${exportDate}`, pageWidth - margin, 24, { align: "right" });

  const heroY = 59;
  if (photoResult.status === "fulfilled") {
    doc.addImage(photoResult.value, "PNG", margin, heroY, 30, 30);
  } else {
    doc.setFillColor(...COLORS.blueSoft);
    doc.circle(margin + 15, heroY + 15, 15, "F");
    doc.setTextColor(...COLORS.blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(getInitials(data.workerName), margin + 15, heroY + 17, { align: "center" });
  }
  doc.setDrawColor(...COLORS.border);
  doc.circle(margin + 15, heroY + 15, 15, "S");

  const identityX = margin + 38;
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  const nameLines = fitLines(data.workerName, contentWidth - 38, 2);
  doc.text(nameLines, identityX, heroY + 7);
  const nameHeight = Math.max(1, nameLines.length) * 7;
  doc.setTextColor(...COLORS.blue);
  doc.setFontSize(11.5);
  doc.text(fitLines(data.serviceType, contentWidth - 38, 2), identityX, heroY + 8 + nameHeight);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.slate);
  const trustLabel = data.isVerified ? `Verified provider  |  ${data.ratingLabel}` : data.ratingLabel;
  doc.text(trustLabel, identityX, heroY + 18 + nameHeight);

  const factsY = 101;
  const factGap = 4;
  const factWidth = (contentWidth - factGap * 2) / 3;
  const facts = [
    ["CLIENT RATING", data.ratingLabel],
    ["SERVICE AREA", data.location],
    ["PAYMENT CONTACT", paymentLabel],
  ];
  facts.forEach(([label, value], index) => {
    const x = margin + index * (factWidth + factGap);
    doc.setFillColor(247, 249, 252);
    doc.roundedRect(x, factsY, factWidth, 29, 3, 3, "F");
    doc.setTextColor(...COLORS.blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label, x + 4, factsY + 7);
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(9.5);
    doc.text(fitLines(value, factWidth - 8, 3), x + 4, factsY + 14);
  });

  const summaryLines = fitLines(data.bio, contentWidth - 12, 8);
  const summaryY = 141;
  const summaryHeight = Math.max(32, 22 + summaryLines.length * 5);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(margin, summaryY, contentWidth, summaryHeight, 3, 3, "S");
  doc.setTextColor(...COLORS.blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PROFESSIONAL SUMMARY", margin + 6, summaryY + 8);
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(summaryLines, margin + 6, summaryY + 17);

  const verifyY = summaryY + summaryHeight + 11;
  doc.setFillColor(...COLORS.blueSoft);
  doc.roundedRect(margin, verifyY, contentWidth, 51, 3, 3, "F");
  doc.setTextColor(...COLORS.blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(data.isVerified ? "VERIFIED TRABAWHO PROFILE" : "TRABAWHO PROVIDER PROFILE", margin + 50, verifyY + 14);
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(11);
  doc.text("Scan the provider reference", margin + 50, verifyY + 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.slate);
  doc.text(wrapText("Use this QR code to confirm the name, service, and location shown in this portfolio.", contentWidth - 56), margin + 50, verifyY + 31);

  const referenceData = `TrabaWho provider\nName: ${data.workerName}\nService: ${data.serviceType}\nLocation: ${data.location}`;
  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(referenceData)}`;
    const qrDataUrl = await imageUrlToPngDataUrl(qrUrl, { crop: "contain", size: 512 });
    doc.addImage(qrDataUrl, "PNG", margin + 6, verifyY + 6, 39, 39);
  } catch {
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin + 6, verifyY + 6, 39, 39, 2, 2, "S");
    doc.setTextColor(...COLORS.slate);
    doc.setFontSize(8);
    doc.text("QR unavailable", margin + 25.5, verifyY + 27, { align: "center" });
  }

  doc.setDrawColor(...COLORS.border);
  doc.line(margin, pageHeight - 19, pageWidth - margin, pageHeight - 19);
  doc.setTextColor(...COLORS.slate);
  doc.setFontSize(7.5);
  doc.text("Generated by TrabaWho | Local services marketplace", margin, pageHeight - 12);
  doc.text("Profile information reflects the data available at export.", pageWidth - margin, pageHeight - 12, { align: "right" });

  const safeName = data.workerName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "provider";
  doc.save(`${safeName}-TrabaWho-Portfolio.pdf`);
}

export { fetchImageBlob, generateProviderPortfolio, getPaymentLabel, getSupabaseStorageLocation };
export type { ProviderPortfolioData };
