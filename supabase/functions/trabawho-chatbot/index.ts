import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const DEFAULT_GROQ_WEB_SEARCH_MODEL = "groq/compound-mini";
const DEFAULT_GROQ_CHAT_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
];
const DEFAULT_GROQ_VISION_FALLBACK_MODELS = [
  DEFAULT_GROQ_VISION_MODEL,
];
const DEFAULT_GROQ_WEB_SEARCH_FALLBACK_MODELS = [
  "groq/compound",
];
const GROQ_RETRYABLE_STATUSES = new Set([408, 409, 429, 498, 500, 502, 503, 504]);
const MAX_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 1200;
const MAX_ATTACHMENTS = 1;
const MAX_ATTACHMENT_DATA_URL_LENGTH = 4_200_000;
const MAX_MARKETPLACE_ROWS = 120;
const MAX_MARKETPLACE_MATCHES = 8;
const MAX_BOOKING_MATCHES = 6;
const MAX_MATERIAL_ITEMS = 8;
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role?: string;
  content?: unknown;
  attachments?: ChatAttachment[];
}

interface ChatContext {
  currentView?: unknown;
  isLoggedIn?: unknown;
  role?: unknown;
}

interface ChatRequestBody {
  messages?: ChatMessage[];
  context?: ChatContext;
  attachments?: ChatAttachment[];
}

interface ChatAttachment {
  type?: unknown;
  name?: unknown;
  mediaType?: unknown;
  dataUrl?: unknown;
}

interface NormalizedAttachment {
  type: "image";
  name: string;
  mediaType: string;
  dataUrl: string;
}

interface ProblemMaterialHint {
  name: string;
  quantity: string;
  searchTerm: string;
}

interface ProblemAnalysis {
  problemTitle: string;
  problemSummary: string;
  likelyServiceTypes: string[];
  materials: ProblemMaterialHint[];
  urgency: string;
  safetyNotes: string[];
  confidence: number | null;
  searchQuery: string;
}

interface MaterialPriceItem {
  name: string;
  quantity: string;
  unit: string;
  low: number | null;
  high: number | null;
  currency: string;
  sourceHint: string;
}

interface MaterialResearch {
  summary: string;
  items: MaterialPriceItem[];
  assumptions: string[];
  sources: SourceRecord[];
}

interface SourceRecord {
  title: string;
  url: string;
}

interface BudgetEstimate {
  problemTitle: string;
  problemSummary: string;
  currency: string;
  materialSubtotalLow: number | null;
  materialSubtotalHigh: number | null;
  workerRateLow: number | null;
  workerRateHigh: number | null;
  totalLow: number | null;
  totalHigh: number | null;
  materials: MaterialPriceItem[];
  assumptions: string[];
  confidence: number | null;
}

class GroqProviderError extends Error {
  status: number;
  providerBody: string;
  retryAfter: string | null;
  model: string;
  code: string;

  constructor({
    status,
    providerBody,
    retryAfter,
    model,
    code,
  }: {
    status: number;
    providerBody: string;
    retryAfter: string | null;
    model: string;
    code: string;
  }) {
    super(`Groq request failed for ${model || "unknown model"} with ${status}: ${providerBody.slice(0, 300)}`);
    this.name = "GroqProviderError";
    this.status = status;
    this.providerBody = providerBody;
    this.retryAfter = retryAfter;
    this.model = model;
    this.code = code;
  }
}

interface MarketplaceRecord {
  id: number | string;
  sellerId: string;
  title: string;
  providerName: string;
  serviceType: string;
  description: string;
  location: string;
  priceLabel: string;
  amount: number | null;
  currency: string;
  rateBasis: string;
  bookingMode: string;
  pricingModel: string;
  isVerified: boolean;
  verificationStatus: string;
  rating: number | null;
  reviews: number;
  createdAt: string;
  searchableText: string;
  serviceFamilies: string[];
  matchQuality: MarketplaceFamilyMatch;
  score: number;
}

type MarketplaceFamilyMatch = "none" | "exact" | "fallback" | "mismatch";

interface ServiceFamilyEvidence {
  family: string;
  score: number;
  hits: string[];
}

interface MarketplaceSearch {
  isMarketplaceIntent: boolean;
  isPriceIntent: boolean;
  records: MarketplaceRecord[];
  queryTerms: string[];
  desiredFamilies: string[];
  hasExactFamilyMatch: boolean;
  totalFetched: number;
  error?: string;
}

interface BookingRecord {
  id: string;
  status: string;
  serviceTitle: string;
  providerName: string;
  participantRole: string;
  scheduleLabel: string;
  priceLabel: string;
  paymentMethod: string;
  quoteApproved: boolean | null;
  updatedAt: string;
}

interface BookingLookup {
  isBookingIntent: boolean;
  records: BookingRecord[];
  error?: string;
}

const viewGuidance: Record<string, string> = {
  "client-dashboard": "The user is on the home dashboard. Point them to Browse, Bookings, My Work, Profile, or Settings based on intent.",
  "browse-services": "The user is browsing services. Help them search, compare providers, inspect profiles, ask for quotes, and start bookings.",
  "my-bookings": "The user is on My Bookings. Help with booking status, schedule changes, payments, reviews, cancellations, and refunds without inventing account data.",
  "my-work": "The user is in seller tools. Help with service listings, schedule slots, quote handling, payment options, and profile setup.",
  "worker-dashboard": "The user is in a worker dashboard. Help improve listings, manage availability, and understand seller workflows.",
  profile: "The user is on Profile. Help with public profile details, location, photo, portfolio, and account-facing profile actions.",
  "account-settings": "The user is in account and privacy settings. Help with password, privacy, verification, and account information.",
  settings: "The user is in Settings. Help with theme, language, notification, and preference changes.",
  landing: "The user may not be logged in. Explain public browsing, login, signup, and seller onboarding at a high level.",
};

const marketplaceIntentTerms = [
  "service",
  "services",
  "provider",
  "providers",
  "worker",
  "workers",
  "price",
  "prices",
  "pricing",
  "cost",
  "costs",
  "rate",
  "rates",
  "quote",
  "quotes",
  "book",
  "booking",
  "compare",
  "find",
  "search",
  "near",
  "available",
  "cleaner",
  "cleaning",
  "tutor",
  "tutorial",
  "technician",
  "repair",
  "electrician",
  "plumber",
  "laundry",
  "wellness",
  "grooming",
];

const bookingIntentTerms = [
  "appointment",
  "appointments",
  "booked",
  "booking",
  "bookings",
  "cancel",
  "cancelled",
  "confirmed",
  "message",
  "messages",
  "my booking",
  "my bookings",
  "pay",
  "payment",
  "payments",
  "pending",
  "refund",
  "refunds",
  "reschedule",
  "schedule",
  "scheduled",
  "status",
];

const priceIntentTerms = [
  "price",
  "prices",
  "pricing",
  "cost",
  "costs",
  "rate",
  "rates",
  "fee",
  "fees",
  "quote",
  "quotes",
  "budget",
  "cheap",
  "cheapest",
  "affordable",
  "how much",
  "php",
  "peso",
  "pesos",
  "\u20b1",
];

const searchStopWords = new Set([
  "a",
  "about",
  "all",
  "an",
  "and",
  "any",
  "are",
  "around",
  "ask",
  "attached",
  "available",
  "book",
  "booking",
  "budget",
  "can",
  "cheap",
  "cheapest",
  "compare",
  "cost",
  "costs",
  "do",
  "estimate",
  "fee",
  "fees",
  "find",
  "for",
  "from",
  "get",
  "trabawho",
  "have",
  "help",
  "how",
  "i",
  "identify",
  "image",
  "in",
  "into",
  "is",
  "list",
  "looking",
  "likely",
  "material",
  "materials",
  "max",
  "maximum",
  "me",
  "near",
  "need",
  "of",
  "on",
  "or",
  "php",
  "photo",
  "picture",
  "piece",
  "pieces",
  "please",
  "problem",
  "price",
  "prices",
  "pricing",
  "provider",
  "providers",
  "qualified",
  "quote",
  "quotes",
  "rate",
  "rates",
  "require",
  "requires",
  "requiring",
  "search",
  "several",
  "service",
  "services",
  "show",
  "that",
  "the",
  "to",
  "under",
  "up",
  "uploaded",
  "visible",
  "what",
  "with",
  "within",
  "worker",
  "workers",
  "you",
]);

const serviceFamilyRules = [
  {
    family: "plumbing",
    queryTerms: [
      "basin",
      "bathroom",
      "clog",
      "clogged",
      "drain",
      "faucet",
      "fixture",
      "fixtures",
      "fitting",
      "fittings",
      "kitchen",
      "lavatory",
      "leak",
      "leaking",
      "overflow",
      "pipe",
      "pipes",
      "p-trap",
      "plumber",
      "plumbers",
      "plumbing",
      "ptrap",
      "sink",
      "sinks",
      "shower",
      "toilet",
      "wash basin",
      "water",
      "waterline",
    ],
    recordTerms: [
      "basin",
      "bathroom",
      "clog",
      "clogged",
      "drain",
      "faucet",
      "fixture",
      "fittings",
      "kitchen",
      "lavatory",
      "leak",
      "leaking",
      "pipe",
      "pipes",
      "p-trap",
      "plumber",
      "plumbing",
      "ptrap",
      "sink",
      "sinks",
      "shower",
      "toilet",
      "wash basin",
    ],
  },
  {
    family: "electrical",
    queryTerms: [
      "breaker",
      "electric",
      "electrical",
      "electrician",
      "light",
      "lights",
      "outlet",
      "outlets",
      "socket",
      "switch",
      "wiring",
    ],
    recordTerms: [
      "breaker",
      "electric",
      "electrical",
      "electrician",
      "light",
      "outlet",
      "socket",
      "switch",
      "wiring",
    ],
  },
  {
    family: "electronics",
    queryTerms: [
      "computer",
      "desktop",
      "keyboard",
      "laptop",
      "monitor",
      "mouse",
      "network",
      "no display",
      "pc",
      "print",
      "printing",
      "printer",
      "router",
      "scanner",
      "wifi",
    ],
    recordTerms: [
      "cable",
      "computer",
      "desktop",
      "hardware",
      "keyboard",
      "laptop",
      "monitor",
      "network",
      "no display",
      "office hardware",
      "pc",
      "print",
      "printing",
      "printer",
      "router",
      "scanner",
      "setup",
      "wifi",
    ],
  },
  {
    family: "appliance",
    queryTerms: [
      "aircon",
      "air conditioner",
      "appliance",
      "dryer",
      "fan",
      "fridge",
      "microwave",
      "oven",
      "ref",
      "refrigerator",
      "rice cooker",
      "stove",
      "washer",
      "washing machine",
    ],
    recordTerms: [
      "aircon",
      "air conditioner",
      "appliance",
      "dryer",
      "fan",
      "fridge",
      "microwave",
      "oven",
      "ref",
      "refrigerator",
      "rice cooker",
      "stove",
      "washer",
      "washing machine",
    ],
  },
  {
    family: "carpentry",
    queryTerms: [
      "cabinet",
      "carpenter",
      "carpentry",
      "chair",
      "door",
      "drawer",
      "furniture",
      "hinge",
      "lock",
      "shelf",
      "table",
      "wood",
    ],
    recordTerms: [
      "assembly",
      "cabinet",
      "carpenter",
      "carpentry",
      "chair",
      "door",
      "drawer",
      "furniture",
      "handle",
      "hinge",
      "lock",
      "shelf",
      "table",
      "wood",
    ],
  },
  {
    family: "painting",
    queryTerms: [
      "paint",
      "painter",
      "painting",
      "patch",
      "scuff",
      "wall",
    ],
    recordTerms: [
      "paint",
      "painter",
      "painting",
      "patch",
      "scuff",
      "wall",
    ],
  },
  {
    family: "cleaning",
    queryTerms: [
      "clean",
      "cleaner",
      "cleaning",
      "deep clean",
      "declutter",
      "dishwashing",
      "laundry",
      "mold",
      "organize",
      "stain",
      "tidy",
    ],
    recordTerms: [
      "clean",
      "cleaner",
      "cleaning",
      "deep clean",
      "declutter",
      "dishwashing",
      "laundry",
      "mold",
      "organize",
      "stain",
      "tidy",
    ],
  },
  {
    family: "handyman",
    queryTerms: [
      "general repair",
      "handyman",
      "home fix",
      "home repair",
      "home repairs",
      "household repair",
      "household repairs",
      "minor repair",
      "minor repairs",
    ],
    recordTerms: [
      "general repair",
      "handyman",
      "home fix",
      "home repair",
      "home repairs",
    ],
  },
];

const serviceFamilyFallbacks: Record<string, string[]> = {
  appliance: ["handyman"],
  carpentry: ["handyman"],
  electrical: ["handyman"],
  painting: ["handyman"],
  plumbing: ["handyman"],
};

const serviceFamilyLabels: Record<string, string> = {
  appliance: "appliance repair",
  carpentry: "furniture or carpentry repair",
  cleaning: "cleaning",
  electrical: "electrical repair",
  electronics: "computer or printer repair",
  handyman: "handyman repair",
  painting: "painting or wall repair",
  plumbing: "plumbing repair",
};

const serviceFamilyRank: Record<MarketplaceFamilyMatch, number> = {
  exact: 3,
  fallback: 2,
  none: 1,
  mismatch: 0,
};

const shortcutReplies: Record<string, string> = {
  hi: "Hi. What would you like to do in TrabaWho: find a service, check a booking, or set up seller tools?",
  hello: "Hi. What would you like to do in TrabaWho: find a service, check a booking, or set up seller tools?",
  hey: "Hi. What would you like to do in TrabaWho: find a service, check a booking, or set up seller tools?",
  help: "I can help with services, bookings, seller setup, quotes, payments, refunds, profiles, or settings. What are you trying to do right now?",
  qr: "Do you mean a seller payment QR, identity verification, or a booking payment step?",
  id: "Do you mean identity verification, your profile details, or an account issue?",
  ok: "Got it. What would you like to do next in TrabaWho?",
};

const lowConfidenceRepliesByView: Record<string, string> = {
  "browse-services": "I did not catch that yet. Are you trying to search providers, compare a service, or start a booking?",
  "my-bookings": "I did not catch that yet. Are you checking a booking, rescheduling, paying, or asking about a refund?",
  "my-work": "I did not catch that yet. Are you updating services, editing slots, handling quotes, or setting payment options?",
  "worker-dashboard": "I did not catch that yet. Are you improving your listing, checking work, or managing your schedule?",
  profile: "I did not catch that yet. Are you updating profile details, location, privacy, or account information?",
  "account-settings": "I did not catch that yet. Are you changing your password, privacy settings, or identity verification details?",
  settings: "I did not catch that yet. Are you changing theme, language, or notification preferences?",
};

const defaultLowConfidenceReply =
  "I did not catch that yet. Are you trying to find a service, check a booking, manage seller work, or handle payments?";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizeMessage = (message: ChatMessage): { role: ChatRole; content: string } | null => {
  const role = message.role === "assistant" ? "assistant" : "user";
  const content = typeof message.content === "string" ? message.content.trim() : "";

  if (!content) return null;

  return {
    role,
    content: content.slice(0, MAX_MESSAGE_LENGTH),
  };
};

const normalizeAttachment = (attachment: ChatAttachment): NormalizedAttachment | null => {
  const type = getText(attachment.type);
  const name = getText(attachment.name).slice(0, 120) || "problem-photo";
  const mediaType = getText(attachment.mediaType).toLowerCase();
  const dataUrl = getText(attachment.dataUrl);

  if (type !== "image") return null;
  if (!supportedImageTypes.has(mediaType)) return null;
  if (!dataUrl.startsWith(`data:${mediaType};base64,`)) return null;
  if (dataUrl.length > MAX_ATTACHMENT_DATA_URL_LENGTH) return null;

  return {
    type: "image",
    name,
    mediaType,
    dataUrl,
  };
};

const normalizeRequestAttachments = (body: ChatRequestBody): NormalizedAttachment[] => {
  const messageAttachments = (Array.isArray(body.messages) ? body.messages : [])
    .flatMap((message) => (Array.isArray(message.attachments) ? message.attachments : []));

  return [
    ...(Array.isArray(body.attachments) ? body.attachments : []),
    ...messageAttachments,
  ]
    .map(normalizeAttachment)
    .filter((attachment): attachment is NormalizedAttachment => Boolean(attachment))
    .slice(0, MAX_ATTACHMENTS);
};

const normalizeContextValue = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const cleanValue = value.trim().replace(/[^a-z0-9_\-\s]/gi, "").slice(0, 60);
  return cleanValue || fallback;
};

const normalizeSignal = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const isLowConfidenceMessage = (value: string) => {
  const compactValue = normalizeSignal(value.trim());

  if (!compactValue || shortcutReplies[compactValue]) return false;
  if (compactValue.length <= 2) return true;
  if (compactValue.length <= 4 && /^([a-z0-9])\1+$/.test(compactValue)) return true;

  return false;
};

const buildDeterministicReply = (latestUserMessage: string, context: ChatContext = {}) => {
  const compactValue = normalizeSignal(latestUserMessage);

  if (shortcutReplies[compactValue]) {
    return shortcutReplies[compactValue];
  }

  if (!isLowConfidenceMessage(latestUserMessage)) {
    return "";
  }

  const currentView = normalizeContextValue(context.currentView, "landing");
  return lowConfidenceRepliesByView[currentView] || defaultLowConfidenceReply;
};

const getText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const getNumberOrNull = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const getObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const getRelatedObject = (value: unknown): Record<string, unknown> => {
  if (Array.isArray(value)) return getObject(value[0]);
  return getObject(value);
};

const shorten = (value: string, maxLength = 150) => {
  const cleanValue = value.replace(/\s+/g, " ").trim();
  if (cleanValue.length <= maxLength) return cleanValue;
  return `${cleanValue.slice(0, maxLength - 1).trim()}...`;
};

const tokenize = (value: string) =>
  (value.toLowerCase().replace(/\u20b1/g, " php ").match(/[a-z0-9]+/g) || []);

const hasAnyTerm = (value: string, terms: string[]) => {
  const lowerValue = value.toLowerCase();
  return terms.some((term) => lowerValue.includes(term));
};

const getSearchTerms = (value: string) => {
  const seen = new Set<string>();

  return tokenize(value)
    .filter((term) => term.length > 1)
    .filter((term) => !/^\d+$/.test(term))
    .filter((term) => !searchStopWords.has(term))
    .filter((term) => {
      if (seen.has(term)) return false;
      seen.add(term);
      return true;
    })
    .slice(0, 12);
};

const hasServiceFamilyTerm = (lowerValue: string, tokenSet: Set<string>, term: string) => {
  const cleanTerm = term.toLowerCase().trim();
  if (!cleanTerm) return false;
  if (cleanTerm.includes(" ")) return lowerValue.includes(cleanTerm);
  return tokenSet.has(cleanTerm);
};

const getServiceFamilyTermWeight = (term: string, family: string) => {
  if (term.includes(" ")) return family === "handyman" ? 3 : 4;
  if (term === family) return 4;
  if (term.length <= 3) return 1.5;
  return 2;
};

const getServiceFamilyEvidence = (value: string, key: "queryTerms" | "recordTerms"): ServiceFamilyEvidence[] => {
  const lowerValue = value.toLowerCase();
  const tokenSet = new Set(tokenize(value));

  return serviceFamilyRules
    .map((rule) => {
      const hits = rule[key].filter((term) => hasServiceFamilyTerm(lowerValue, tokenSet, term));
      return {
        family: rule.family,
        score: hits.reduce((sum, term) => sum + getServiceFamilyTermWeight(term, rule.family), 0),
        hits,
      };
    })
    .filter((evidence) => evidence.score > 0)
    .sort((a, b) => b.score - a.score);
};

const getServiceFamiliesForText = (value: string, key: "queryTerms" | "recordTerms") => (
  getServiceFamilyEvidence(value, key).map((evidence) => evidence.family)
);

const pickDominantServiceFamilies = (evidence: ServiceFamilyEvidence[]) => {
  if (evidence.length === 0) return [];

  const topScore = evidence[0].score;
  const minimumScore = Math.max(2, topScore * 0.55);
  const selected = evidence
    .filter((item) => item.score >= minimumScore)
    .map((item) => item.family);
  const hasSpecialist = selected.some((family) => family !== "handyman");

  return uniqueStrings(
    hasSpecialist
      ? selected.filter((family) => family !== "handyman")
      : selected
  ).slice(0, 3);
};

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const getDesiredServiceFamilies = (value: string) =>
  pickDominantServiceFamilies(getServiceFamilyEvidence(value, "queryTerms"));

const getRecordServiceFamilies = (record: MarketplaceRecord) =>
  Array.isArray(record.serviceFamilies) && record.serviceFamilies.length > 0
    ? record.serviceFamilies
    : uniqueStrings(getServiceFamiliesForText(record.searchableText, "recordTerms"));

const getFallbackServiceFamilies = (desiredFamilies: string[]) =>
  uniqueStrings(desiredFamilies.flatMap((family) => serviceFamilyFallbacks[family] || []));

const getMarketplaceFamilyMatch = (
  record: MarketplaceRecord,
  desiredFamilies: string[]
): MarketplaceFamilyMatch => {
  if (desiredFamilies.length === 0) return "none";

  const recordFamilies = getRecordServiceFamilies(record);
  const desiredSet = new Set(desiredFamilies);
  if (recordFamilies.some((family) => desiredSet.has(family))) return "exact";

  const fallbackSet = new Set(getFallbackServiceFamilies(desiredFamilies));
  if (recordFamilies.some((family) => fallbackSet.has(family))) return "fallback";

  return "mismatch";
};

const formatServiceFamilyList = (families: string[]) => (
  families
    .map((family) => serviceFamilyLabels[family] || family)
    .filter(Boolean)
    .join(", ")
);

const extractPriceLimit = (value: string) => {
  const normalized = value.replace(/,/g, "");
  const patterns = [
    /(?:under|below|less than|maximum|max|budget|within|up to)\s*(?:php|peso|pesos|\u20b1)?\s*([0-9]+(?:\.[0-9]+)?)/i,
    /(?:php|peso|pesos|\u20b1)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:or less|below|max|maximum|budget)?/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;

    const amount = Number(match[1]);
    if (Number.isFinite(amount)) return amount;
  }

  return null;
};

const normalizeRateBasis = (value: unknown) => {
  const raw = getText(value).toLowerCase().replace(/_/g, "-");
  if (raw === "per-hour" || raw === "hourly") return "per-hour";
  if (raw === "per-day" || raw === "daily") return "per-day";
  if (raw === "per-week" || raw === "weekly") return "per-week";
  if (raw === "per-month" || raw === "monthly") return "per-month";
  if (raw === "per-project" || raw === "project" || raw === "package" || raw === "fixed") return "per-project";
  return "";
};

const getRateSuffix = (rateBasis: string) => {
  const suffixMap: Record<string, string> = {
    "per-hour": "hour",
    "per-day": "day",
    "per-week": "week",
    "per-month": "month",
    "per-project": "project",
  };

  return suffixMap[rateBasis] || "service";
};

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);

const parseJsonObject = (value: string): Record<string, unknown> => {
  const cleanValue = value.trim();
  const fencedMatch = cleanValue.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const target = fencedMatch?.[1]?.trim() || cleanValue;

  try {
    const parsed = JSON.parse(target);
    return getObject(parsed);
  } catch {
    const start = target.indexOf("{");
    const end = target.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return getObject(JSON.parse(target.slice(start, end + 1)));
      } catch {
        return {};
      }
    }
    return {};
  }
};

const toStringList = (value: unknown, maxItems = 6) => (
  Array.isArray(value)
    ? value.map((item) => getText(item)).filter(Boolean).slice(0, maxItems)
    : []
);

const clampConfidence = (value: unknown) => {
  const parsed = getNumberOrNull(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(1, parsed));
};

const normalizeProblemMaterials = (value: unknown): ProblemMaterialHint[] => (
  Array.isArray(value)
    ? value.map((item) => {
      const material = getObject(item);
      const name = getText(material["name"]);
      if (!name) return null;
      return {
        name,
        quantity: getText(material["quantity"]) || "as needed",
        searchTerm: getText(material["searchTerm"] || material["search_term"]) || name,
      };
    }).filter((item): item is ProblemMaterialHint => Boolean(item)).slice(0, MAX_MATERIAL_ITEMS)
    : []
);

const normalizeProblemAnalysis = (payload: Record<string, unknown>): ProblemAnalysis => ({
  problemTitle: getText(payload["problemTitle"] || payload["problem_title"]) || "Photo problem estimate",
  problemSummary: getText(payload["problemSummary"] || payload["problem_summary"]) || "The uploaded photo needs worker review before a final quote.",
  likelyServiceTypes: toStringList(payload["likelyServiceTypes"] || payload["likely_service_types"], 5),
  materials: normalizeProblemMaterials(payload["materials"]),
  urgency: getText(payload["urgency"]) || "medium",
  safetyNotes: toStringList(payload["safetyNotes"] || payload["safety_notes"], 4),
  confidence: clampConfidence(payload["confidence"]),
  searchQuery: getText(payload["searchQuery"] || payload["search_query"]),
});

const normalizeMaterialItems = (value: unknown): MaterialPriceItem[] => (
  Array.isArray(value)
    ? value.map((item) => {
      const material = getObject(item);
      const name = getText(material["name"]);
      if (!name) return null;
      const low = getNumberOrNull(material["low"] || material["min"] || material["priceLow"] || material["price_low"]);
      const high = getNumberOrNull(material["high"] || material["max"] || material["priceHigh"] || material["price_high"]) ?? low;
      return {
        name,
        quantity: getText(material["quantity"]) || "as needed",
        unit: getText(material["unit"]) || "item",
        low,
        high,
        currency: getText(material["currency"]) || "PHP",
        sourceHint: getText(material["sourceHint"] || material["source_hint"]),
      };
    }).filter((item): item is MaterialPriceItem => Boolean(item)).slice(0, MAX_MATERIAL_ITEMS)
    : []
);

const extractGroqSources = (payload: Record<string, unknown>): SourceRecord[] => {
  const choices = Array.isArray(payload["choices"]) ? payload["choices"] : [];
  const firstChoice = getObject(choices[0]);
  const message = getObject(firstChoice["message"]);
  const executedTools = Array.isArray(message["executed_tools"]) ? message["executed_tools"] : [];
  const sources: SourceRecord[] = [];

  executedTools.forEach((tool) => {
    const searchResults = getObject(getObject(tool)["search_results"]);
    const results = Array.isArray(searchResults["results"]) ? searchResults["results"] : [];
    results.forEach((result) => {
      const source = getObject(result);
      const title = getText(source["title"]);
      const url = getText(source["url"]);
      if (title && url && !sources.some((item) => item.url === url)) {
        sources.push({ title, url });
      }
    });
  });

  return sources.slice(0, 5);
};

const normalizeMaterialResearch = (
  payload: Record<string, unknown>,
  sources: SourceRecord[]
): MaterialResearch => ({
  summary: getText(payload["summary"]) || "Material prices were estimated from current web search snippets.",
  items: normalizeMaterialItems(payload["items"] || payload["materials"]),
  assumptions: toStringList(payload["assumptions"], 5),
  sources,
});

const sumPriceField = (items: MaterialPriceItem[], field: "low" | "high") => {
  const values = items.map((item) => item[field]).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
};

const getWorkerRateRange = (records: MarketplaceRecord[]) => {
  const values = records
    .map((record) => record.amount)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  if (values.length === 0) return { low: null, high: null };
  return {
    low: Math.min(...values),
    high: Math.max(...values),
  };
};

const buildBudgetEstimate = (
  problemAnalysis: ProblemAnalysis,
  materialResearch: MaterialResearch,
  marketplaceSearch: MarketplaceSearch
): BudgetEstimate => {
  const materialSubtotalLow = sumPriceField(materialResearch.items, "low");
  const materialSubtotalHigh = sumPriceField(materialResearch.items, "high");
  const workerRange = getWorkerRateRange(marketplaceSearch.records);
  const totalLow = materialSubtotalLow !== null && workerRange.low !== null
    ? materialSubtotalLow + workerRange.low
    : materialSubtotalLow;
  const totalHigh = materialSubtotalHigh !== null && workerRange.high !== null
    ? materialSubtotalHigh + workerRange.high
    : materialSubtotalHigh;

  return {
    problemTitle: problemAnalysis.problemTitle,
    problemSummary: problemAnalysis.problemSummary,
    currency: "PHP",
    materialSubtotalLow,
    materialSubtotalHigh,
    workerRateLow: workerRange.low,
    workerRateHigh: workerRange.high,
    totalLow,
    totalHigh,
    materials: materialResearch.items,
    assumptions: [
      ...materialResearch.assumptions,
      "Worker rates are from active TrabaWho listings and may be hourly, daily, or project-based.",
      "Final quote depends on on-site inspection, severity, schedule, and worker confirmation.",
    ].slice(0, 7),
    confidence: problemAnalysis.confidence,
  };
};

const formatPesoRange = (low: number | null, high: number | null) => {
  if (low === null && high === null) return "needs worker quote";
  if (low !== null && high !== null && low !== high) return `PHP ${formatAmount(low)}-${formatAmount(high)}`;
  const value = low ?? high ?? 0;
  return `PHP ${formatAmount(value)}`;
};

const buildProblemSearchText = (latestUserMessage: string, problemAnalysis: ProblemAnalysis | null) => {
  if (!problemAnalysis) return latestUserMessage;

  return [
    problemAnalysis.problemTitle,
    problemAnalysis.problemSummary,
    ...problemAnalysis.likelyServiceTypes,
    ...problemAnalysis.materials.map((item) => `${item.name} ${item.searchTerm}`),
    problemAnalysis.searchQuery,
    latestUserMessage,
    "worker service repair provider book",
  ].join(" ");
};

const buildPhotoEstimateReply = (
  problemAnalysis: ProblemAnalysis,
  budgetEstimate: BudgetEstimate,
  marketplaceSearch: MarketplaceSearch,
  materialResearch: MaterialResearch
) => {
  const materialLines = materialResearch.items.slice(0, 4).map((item) =>
    `- ${item.name}: ${formatPesoRange(item.low, item.high)}${item.quantity ? ` (${item.quantity})` : ""}`
  );
  const workerLines = marketplaceSearch.records.slice(0, 3).map((record, index) =>
    `${index + 1}. ${record.providerName} - ${record.serviceType}, ${record.priceLabel}${record.location ? `, ${record.location}` : ""}`
  );
  const desiredFamilyLabel = formatServiceFamilyList(marketplaceSearch.desiredFamilies);
  const workerHeading = marketplaceSearch.desiredFamilies.length > 0 && !marketplaceSearch.hasExactFamilyMatch
    ? `Closest worker matches${desiredFamilyLabel ? ` (no exact ${desiredFamilyLabel} listing is active)` : ""}:`
    : "Fit workers:";
  const safety = problemAnalysis.safetyNotes.length > 0
    ? `\n\nSafety note: ${problemAnalysis.safetyNotes[0]}`
    : "";
  const workerText = workerLines.length > 0
    ? `\n\n${workerHeading}\n${workerLines.join("\n")}\n\nTap Chat with worker on a worker card to create the booking request.`
    : "\n\nI could not find a matching active worker listing yet. Try Browse with a broader service type.";

  return [
    `From the photo, this looks like: ${problemAnalysis.problemTitle}.`,
    problemAnalysis.problemSummary,
    `Estimated materials: ${formatPesoRange(budgetEstimate.materialSubtotalLow, budgetEstimate.materialSubtotalHigh)}.`,
    `Likely starting budget with listed worker rates: ${formatPesoRange(budgetEstimate.totalLow, budgetEstimate.totalHigh)}.`,
    materialLines.length > 0 ? `\nMaterial search snapshot:\n${materialLines.join("\n")}` : "",
    workerText,
    safety,
  ].filter(Boolean).join("\n");
};

const splitModelList = (value?: string | null) => (
  String(value || "")
    .split(/[,\s]+/)
    .map((model) => model.trim())
    .filter(Boolean)
);

const uniqueModels = (models: string[]) => {
  const seen = new Set<string>();
  return models.filter((model) => {
    if (seen.has(model)) return false;
    seen.add(model);
    return true;
  });
};

const getGroqModelList = ({
  primaryEnvName,
  fallbackEnvName,
  defaultPrimary,
  defaultFallbacks,
}: {
  primaryEnvName: string;
  fallbackEnvName: string;
  defaultPrimary: string;
  defaultFallbacks: string[];
}) => {
  const configuredPrimary = Deno.env.get(primaryEnvName)?.trim() || defaultPrimary;
  return uniqueModels([
    configuredPrimary,
    ...splitModelList(Deno.env.get(fallbackEnvName)),
    ...defaultFallbacks,
  ]);
};

const parseGroqErrorCode = (providerBody: string) => {
  try {
    const payload = JSON.parse(providerBody) as Record<string, unknown>;
    const error = getObject(payload["error"]);
    return getText(error["code"] || error["type"]);
  } catch {
    return "";
  }
};

const isGroqFallbackError = (error: unknown): error is GroqProviderError => (
  error instanceof GroqProviderError
  && GROQ_RETRYABLE_STATUSES.has(error.status)
  && error.code !== "blocked_api_access"
);

const callGroq = async (
  apiKey: string,
  body: Record<string, unknown>
) => {
  const model = getText(body["model"]);
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const providerBody = await response.text();
    throw new GroqProviderError({
      status: response.status,
      providerBody,
      retryAfter: response.headers.get("retry-after"),
      model,
      code: parseGroqErrorCode(providerBody),
    });
  }

  return await response.json() as Record<string, unknown>;
};

const callGroqWithModelFallback = async (
  apiKey: string,
  body: Record<string, unknown>,
  models: string[],
  label: string
) => {
  let lastError: unknown = null;

  for (const [index, model] of models.entries()) {
    try {
      const payload = await callGroq(apiKey, { ...body, model });
      return { payload, model };
    } catch (error) {
      lastError = error;
      if (!isGroqFallbackError(error) || index === models.length - 1) {
        throw error;
      }

      console.warn("trabawho-chatbot groq model fallback", {
        label,
        failedModel: model,
        nextModel: models[index + 1],
        status: error.status,
        retryAfter: error.retryAfter,
        code: error.code || undefined,
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Groq request failed before any model returned.");
};

const getGroqChatModels = () => getGroqModelList({
  primaryEnvName: "GROQ_CHATBOT_MODEL",
  fallbackEnvName: "GROQ_CHATBOT_FALLBACK_MODELS",
  defaultPrimary: DEFAULT_GROQ_MODEL,
  defaultFallbacks: DEFAULT_GROQ_CHAT_FALLBACK_MODELS,
});

const getGroqVisionModels = () => getGroqModelList({
  primaryEnvName: "GROQ_VISION_MODEL",
  fallbackEnvName: "GROQ_VISION_FALLBACK_MODELS",
  defaultPrimary: DEFAULT_GROQ_VISION_MODEL,
  defaultFallbacks: DEFAULT_GROQ_VISION_FALLBACK_MODELS,
});

const getGroqWebSearchModels = () => getGroqModelList({
  primaryEnvName: "GROQ_WEB_SEARCH_MODEL",
  fallbackEnvName: "GROQ_WEB_SEARCH_FALLBACK_MODELS",
  defaultPrimary: DEFAULT_GROQ_WEB_SEARCH_MODEL,
  defaultFallbacks: DEFAULT_GROQ_WEB_SEARCH_FALLBACK_MODELS,
});

const getGroqMessageContent = (payload: Record<string, unknown>) => {
  const choices = Array.isArray(payload["choices"]) ? payload["choices"] : [];
  const firstChoice = getObject(choices[0]);
  const message = getObject(firstChoice["message"]);
  return getText(message["content"]);
};

const analyzeProblemImage = async (
  groqApiKey: string,
  imageAttachment: NormalizedAttachment,
  latestUserMessage: string
): Promise<ProblemAnalysis | null> => {
  try {
    const { payload } = await callGroqWithModelFallback(groqApiKey, {
      messages: [
        {
          role: "system",
          content: [
            "You identify visible local-service problems from user-uploaded photos for TrabaWho.",
            "Return JSON only with keys: problemTitle, problemSummary, likelyServiceTypes, materials, urgency, safetyNotes, confidence, searchQuery.",
            "likelyServiceTypes should be service labels such as Plumber, Electrician, Technician, Cleaner, Carpenter, Appliance Repair, Painter, or General Repair.",
            "materials must be an array of {name, quantity, searchTerm}. Use visible evidence and uncertainty. Do not infer identities or private details.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${latestUserMessage}\nAnalyze the uploaded problem photo for repair/service triage and likely materials.`,
            },
            {
              type: "image_url",
              image_url: { url: imageAttachment.dataUrl },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 650,
      response_format: { type: "json_object" },
    }, getGroqVisionModels(), "vision");

    const content = getGroqMessageContent(payload);
    return normalizeProblemAnalysis(parseJsonObject(content));
  } catch (error) {
    console.error("trabawho-chatbot vision analysis error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const fetchMaterialResearch = async (
  groqApiKey: string,
  problemAnalysis: ProblemAnalysis,
  latestUserMessage: string
): Promise<MaterialResearch> => {
  const materialHints = problemAnalysis.materials.length > 0
    ? problemAnalysis.materials.map((item) => `${item.name} (${item.quantity}; search: ${item.searchTerm})`).join("; ")
    : "common replacement materials visible or implied by the problem";

  try {
    const { payload } = await callGroqWithModelFallback(groqApiKey, {
      messages: [
        {
          role: "system",
          content: [
            "Use web search to estimate current retail material prices in the Philippines for a local service repair.",
            "Return JSON only with keys: summary, items, assumptions.",
            "items must be an array of {name, quantity, unit, low, high, currency, sourceHint}.",
            "Use PHP. Prefer current Philippine hardware, home improvement, or marketplace pricing. Do not include labor in material items.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `User request: ${latestUserMessage}`,
            `Photo triage: ${problemAnalysis.problemTitle} - ${problemAnalysis.problemSummary}`,
            `Likely materials to price: ${materialHints}`,
            `Search query: ${problemAnalysis.searchQuery || `${problemAnalysis.problemTitle} materials price Philippines`}`,
          ].join("\n"),
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 850,
    }, getGroqWebSearchModels(), "material-web-search");

    const content = getGroqMessageContent(payload);
    return normalizeMaterialResearch(parseJsonObject(content), extractGroqSources(payload));
  } catch (error) {
    console.error("trabawho-chatbot material search error", {
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      summary: "Material web search was unavailable.",
      items: [],
      assumptions: ["Ask the worker to confirm materials after inspecting the issue."],
      sources: [],
    };
  }
};

const normalizeMarketplaceRecord = (row: Record<string, unknown>): MarketplaceRecord => {
  const seller = getRelatedObject(row["sellers"] || row["seller"]);
  const metadata = getObject(row["metadata"]);
  const sellerMeta = getObject(seller["search_meta"]);
  const sellerLocation = getObject(sellerMeta["location"]);
  const amount = getNumberOrNull(row["base_price"]);
  const rateBasis = normalizeRateBasis(
    metadata["rate_basis"]
    || metadata["rateBasis"]
    || metadata["billing_unit"]
    || row["price_type"]
  ) || "per-project";
  const pricingModel = getText(metadata["pricing_model"] || metadata["pricingModel"] || row["pricing_model"]).toLowerCase();
  const priceType = getText(row["price_type"]).toLowerCase();
  const currency = getText(row["currency"] || seller["default_currency"]) || "PHP";
  const isInquiry = pricingModel === "inquiry" || priceType === "custom" || amount === null;
  const priceLabel = isInquiry
    ? "Price on inquiry"
    : `${currency} ${formatAmount(amount)}/${getRateSuffix(rateBasis)}`;
  const serviceType =
    getText(sellerMeta["service_type"])
    || getText(metadata["service_type"] || metadata["serviceType"])
    || "Service";
  const providerName =
    getText(seller["display_name"])
    || getText(sellerMeta["name"])
    || getText(row["title"])
    || "Service Provider";
  const city = getText(sellerLocation["city"] || seller["city"]);
  const province = getText(sellerLocation["province"] || seller["province"]);
  const barangay = getText(sellerLocation["barangay"] || seller["barangay"]);
  const location = [barangay, city, province].filter(Boolean).join(", ");
  const title = getText(row["title"]) || serviceType;
  const description =
    getText(row["short_description"])
    || getText(row["description"])
    || getText(seller["tagline"])
    || getText(seller["about"])
    || "Professional service available through TrabaWho.";
  const bookingMode =
    getText(metadata["booking_mode"] || metadata["bookingMode"] || sellerMeta["booking_mode"])
    || "with-slots";
  const rating = getNumberOrNull(row["rating"] || seller["avg_rating"]);
  const reviews = getNumberOrNull(row["reviews_count"] || seller["rating_count"]) || 0;
  const searchableText = [
    title,
    description,
    serviceType,
    providerName,
    location,
    getText(row["description"]),
    getText(seller["headline"]),
    getText(seller["tagline"]),
    getText(seller["about"]),
  ].join(" ").toLowerCase();

  return {
    id: getNumberOrNull(row["id"]) ?? getText(row["id"]) ?? "unknown",
    sellerId: getText(row["seller_id"] || seller["user_id"]),
    title,
    providerName,
    serviceType,
    description,
    location,
    priceLabel,
    amount,
    currency,
    rateBasis,
    bookingMode,
    pricingModel: pricingModel || (isInquiry ? "inquiry" : "fixed"),
    isVerified: Boolean(seller["is_verified"]),
    verificationStatus: getText(seller["verification_status"]),
    rating,
    reviews,
    createdAt: getText(row["created_at"]),
    searchableText,
    serviceFamilies: [],
    matchQuality: "none",
    score: 0,
  };
};

const scoreMarketplaceRecord = (
  record: MarketplaceRecord,
  queryTerms: string[],
  priceLimit: number | null,
  desiredFamilies: string[],
  matchQuality: MarketplaceFamilyMatch = getMarketplaceFamilyMatch(record, desiredFamilies)
) => {
  let score = queryTerms.length === 0 ? 1 : 0;

  queryTerms.forEach((term) => {
    if (!record.searchableText.includes(term)) return;
    score += 2;
    if (record.title.toLowerCase().includes(term)) score += 2;
    if (record.serviceType.toLowerCase().includes(term)) score += 3;
    if (record.providerName.toLowerCase().includes(term)) score += 2;
    if (record.location.toLowerCase().includes(term)) score += 1;
  });

  if (priceLimit !== null) {
    if (record.amount !== null && record.amount <= priceLimit) score += 5;
    else if (record.amount !== null && record.amount > priceLimit) score -= 4;
    else score -= 1;
  }

  if (matchQuality === "exact") score += 16;
  else if (matchQuality === "fallback") score += 6;
  else if (matchQuality === "mismatch") score -= 30;

  if (record.isVerified || record.verificationStatus === "approved") score += 1;
  if ((record.rating || 0) >= 4.5) score += 1;
  if (record.reviews > 0) score += 0.5;

  return score;
};

const createSupabaseClient = (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const apiKey = serviceRoleKey || anonKey;

  if (!supabaseUrl || !apiKey) return null;

  return createClient(supabaseUrl, apiKey, {
    global: {
      headers: serviceRoleKey
        ? { "X-Client-Info": "trabawho-chatbot" }
        : {
          Authorization: req.headers.get("Authorization") || `Bearer ${anonKey}`,
          "X-Client-Info": "trabawho-chatbot",
        },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
};

const getAuthenticatedUserId = async (req: Request) => {
  const token = getBearerToken(req);
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();

  if (!token || token === anonKey) return "";

  const supabase = createSupabaseClient(req);
  if (!supabase) return "";

  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    console.error("trabawho-chatbot auth lookup error", {
      message: error.message,
      status: error.status,
    });
    return "";
  }

  return data.user?.id || "";
};

const formatDateTimeLabel = (value: unknown) => {
  const rawValue = getText(value);
  if (!rawValue) return "No schedule selected";

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return rawValue;

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const getMetadataBoolean = (metadata: Record<string, unknown>, key: string) => {
  if (typeof metadata[key] === "boolean") return metadata[key] as boolean;
  if (typeof metadata[key] === "string") return metadata[key] === "true";
  return null;
};

const normalizeBookingRecord = (row: Record<string, unknown>, userId: string): BookingRecord => {
  const service = getRelatedObject(row["services"] || row["service"]);
  const seller = getRelatedObject(row["sellers"] || row["seller"]);
  const sellerMeta = getObject(seller["search_meta"]);
  const metadata = getObject(row["metadata"]);
  const serviceMetadata = getObject(service["metadata"]);
  const amount =
    getNumberOrNull(row["total_amount"])
    ?? getNumberOrNull(metadata["quote_amount"])
    ?? getNumberOrNull(metadata["quoteAmount"])
    ?? getNumberOrNull(service["base_price"]);
  const currency = getText(row["currency"] || service["currency"] || seller["default_currency"]) || "PHP";
  const rateBasis = normalizeRateBasis(
    serviceMetadata["rate_basis"]
    || serviceMetadata["rateBasis"]
    || service["price_type"]
  ) || "per-project";
  const priceLabel = amount === null
    ? "Price on inquiry"
    : `${currency} ${formatAmount(amount)}/${getRateSuffix(rateBasis)}`;
  const serviceTitle =
    getText(service["title"])
    || getText(metadata["service_type"] || metadata["serviceType"])
    || "Service";
  const providerName =
    getText(seller["display_name"])
    || getText(sellerMeta["name"])
    || getText(metadata["worker_name"] || metadata["workerName"])
    || "Service Provider";
  const participantRole = String(row["seller_id"] || "") === userId ? "seller" : "client";
  const startLabel = formatDateTimeLabel(row["start_ts"]);
  const endLabel = getText(row["end_ts"]) ? formatDateTimeLabel(row["end_ts"]) : "";
  const paymentMethod = getText(metadata["payment_method"] || metadata["paymentMethod"]) || "Not selected";

  return {
    id: getText(row["id"]),
    status: getText(row["status"]) || "pending",
    serviceTitle,
    providerName,
    participantRole,
    scheduleLabel: endLabel && startLabel !== "No schedule selected" ? `${startLabel} to ${endLabel}` : startLabel,
    priceLabel,
    paymentMethod,
    quoteApproved: getMetadataBoolean(metadata, "quote_approved"),
    updatedAt: getText(row["updated_at"]),
  };
};

const fetchBookingLookup = async (
  req: Request,
  latestUserMessage: string,
  context: ChatContext = {}
): Promise<BookingLookup> => {
  const currentView = normalizeContextValue(context.currentView, "landing");
  const isBookingIntent =
    currentView === "my-bookings"
    || hasAnyTerm(latestUserMessage, bookingIntentTerms);

  const baseLookup: BookingLookup = {
    isBookingIntent,
    records: [],
  };

  if (!isBookingIntent) return baseLookup;

  if (!Boolean(context.isLoggedIn)) {
    return {
      ...baseLookup,
      error: "User is not logged in, so private bookings cannot be loaded.",
    };
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return {
      ...baseLookup,
      error: "Authenticated user could not be verified for booking lookup.",
    };
  }

  const supabase = createSupabaseClient(req);
  if (!supabase) {
    return {
      ...baseLookup,
      error: "Supabase is not configured for booking lookup.",
    };
  }

  const selectColumns =
    "id,service_id,seller_id,buyer_id,slot_id,start_ts,end_ts,status,total_amount,currency,metadata,created_at,updated_at,services(id,title,price_type,base_price,currency,metadata),sellers(user_id,display_name,default_currency,search_meta)";
  let bookingRows: Record<string, unknown>[] = [];

  const { data, error } = await supabase
    .from("bookings")
    .select(selectColumns)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .limit(MAX_BOOKING_MATCHES);

  if (error) {
    console.error("trabawho-chatbot booking lookup relation error", {
      message: error.message,
      code: error.code,
      details: error.details,
    });

    const fallback = await supabase
      .from("bookings")
      .select("id,service_id,seller_id,buyer_id,slot_id,start_ts,end_ts,status,total_amount,currency,metadata,created_at,updated_at")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("updated_at", { ascending: false })
      .limit(MAX_BOOKING_MATCHES);

    if (fallback.error) {
      console.error("trabawho-chatbot booking lookup error", {
        message: fallback.error.message,
        code: fallback.error.code,
        details: fallback.error.details,
      });
      return {
        ...baseLookup,
        error: "Unable to load recent bookings.",
      };
    }

    bookingRows = (fallback.data || []) as Record<string, unknown>[];
  } else {
    bookingRows = (data || []) as Record<string, unknown>[];
  }

  return {
    ...baseLookup,
    records: bookingRows.map((row) => normalizeBookingRecord(row, userId)),
  };
};

const fetchMarketplaceSearch = async (
  req: Request,
  latestUserMessage: string,
  context: ChatContext = {}
): Promise<MarketplaceSearch> => {
  const currentView = normalizeContextValue(context.currentView, "landing");
  const isPriceIntent = hasAnyTerm(latestUserMessage, priceIntentTerms);
  const isMarketplaceIntent =
    currentView === "browse-services"
    || isPriceIntent
    || hasAnyTerm(latestUserMessage, marketplaceIntentTerms);
  const desiredFamilies = getDesiredServiceFamilies(latestUserMessage);

  const baseSearch: MarketplaceSearch = {
    isMarketplaceIntent,
    isPriceIntent,
    records: [],
    queryTerms: getSearchTerms(latestUserMessage),
    desiredFamilies,
    hasExactFamilyMatch: false,
    totalFetched: 0,
  };

  if (!isMarketplaceIntent) return baseSearch;

  const supabase = createSupabaseClient(req);
  if (!supabase) {
    return {
      ...baseSearch,
      error: "Supabase is not configured for marketplace search.",
    };
  }

  const selectColumns =
    "id,title,slug,description,short_description,price_type,base_price,currency,duration_minutes,active,metadata,created_at,sellers(user_id,display_name,headline,tagline,about,profile_photo,avatar_url,is_verified,verification_status,response_time_minutes,default_currency,search_meta)";

  const query = supabase
    .from("services")
    .select(selectColumns)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(MAX_MARKETPLACE_ROWS);

  const { data, error } = await query;

  if (error) {
    console.error("trabawho-chatbot marketplace search error", {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return {
      ...baseSearch,
      error: "Unable to load active marketplace services.",
    };
  }

  const priceLimit = extractPriceLimit(latestUserMessage);
  const normalizedRecords = ((data || []) as Record<string, unknown>[])
    .map(normalizeMarketplaceRecord)
    .map((record) => {
      const recordWithFamilies = {
        ...record,
        serviceFamilies: uniqueStrings(getServiceFamiliesForText(record.searchableText, "recordTerms")),
      };
      const matchQuality = getMarketplaceFamilyMatch(recordWithFamilies, desiredFamilies);

      return {
        ...recordWithFamilies,
        matchQuality,
        score: scoreMarketplaceRecord(recordWithFamilies, baseSearch.queryTerms, priceLimit, desiredFamilies, matchQuality),
      };
    });
  const hasExactFamilyMatch = desiredFamilies.length > 0
    && normalizedRecords.some((record) => record.matchQuality === "exact" && record.score > 0);
  const hasSearchFilters = baseSearch.queryTerms.length > 0 || priceLimit !== null || desiredFamilies.length > 0;
  const matches = normalizedRecords
    .filter((record) => {
      if (desiredFamilies.length > 0 && record.matchQuality === "mismatch") {
        return false;
      }
      return !hasSearchFilters || record.score > 0;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (serviceFamilyRank[b.matchQuality] !== serviceFamilyRank[a.matchQuality]) {
        return serviceFamilyRank[b.matchQuality] - serviceFamilyRank[a.matchQuality];
      }
      if (isPriceIntent && a.amount !== null && b.amount !== null) return a.amount - b.amount;
      if (isPriceIntent && a.amount !== null) return -1;
      if (isPriceIntent && b.amount !== null) return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    })
    .slice(0, MAX_MARKETPLACE_MATCHES);

  return {
    ...baseSearch,
    records: matches,
    hasExactFamilyMatch,
    totalFetched: normalizedRecords.length,
  };
};

const buildMarketplacePromptContext = (marketplaceSearch: MarketplaceSearch) => {
  if (!marketplaceSearch.isMarketplaceIntent) {
    return "No marketplace database lookup was needed for this message.";
  }

  if (marketplaceSearch.error) {
    return `Marketplace database lookup failed: ${marketplaceSearch.error}. Do not invent provider names or prices.`;
  }

  if (marketplaceSearch.records.length === 0) {
    return [
      "Marketplace database lookup found no matching active service records for the user's latest query.",
      `Active service rows scanned: ${marketplaceSearch.totalFetched}.`,
      "Tell the user no matching listing was found and ask for a broader service type, location, or budget.",
    ].join("\n");
  }

  const desiredFamilyLabel = formatServiceFamilyList(marketplaceSearch.desiredFamilies);
  const matchGuidance = marketplaceSearch.desiredFamilies.length > 0
    ? marketplaceSearch.hasExactFamilyMatch
      ? `Detected service domain: ${desiredFamilyLabel}. Exact domain matches are available; prefer exact matches before fallback matches.`
      : `Detected service domain: ${desiredFamilyLabel}. No exact active listing was found; label returned workers as closest fallback matches instead of specialist matches.`
    : "No specific service domain was detected; rank by the user's search terms, price, rating, and recency.";

  return [
    matchGuidance,
    "Marketplace database lookup results from active services. Use these exact records for provider and price answers:",
    ...marketplaceSearch.records.map((record, index) => (
      `${index + 1}. service_id=${record.id}; service="${record.title}"; provider="${record.providerName}"; type="${record.serviceType}"; match="${record.matchQuality}"; location="${record.location || "Not specified"}"; price="${record.priceLabel}"; booking="${record.bookingMode}"; rating="${record.rating ?? "New"}"; reviews=${record.reviews}; description="${shorten(record.description, 120)}"`
    )),
  ].join("\n");
};

const buildBookingPromptContext = (bookingLookup: BookingLookup) => {
  if (!bookingLookup.isBookingIntent) {
    return "No private booking database lookup was needed for this message.";
  }

  if (bookingLookup.error) {
    return `Private booking database lookup was not available: ${bookingLookup.error}. Do not invent booking status.`;
  }

  if (bookingLookup.records.length === 0) {
    return "Private booking database lookup found no recent bookings for the signed-in user.";
  }

  return [
    "Private booking database lookup results for the signed-in user. Use these exact records for booking-status answers:",
    ...bookingLookup.records.map((record, index) => (
      `${index + 1}. booking_id=${record.id}; role="${record.participantRole}"; service="${record.serviceTitle}"; provider="${record.providerName}"; status="${record.status}"; schedule="${record.scheduleLabel}"; price="${record.priceLabel}"; payment="${record.paymentMethod}"; quote_approved="${record.quoteApproved ?? "unknown"}"; updated_at="${record.updatedAt}"`
    )),
  ].join("\n");
};

const buildBookingFallbackReply = (bookingLookup: BookingLookup) => {
  if (!bookingLookup.isBookingIntent) return "";

  if (bookingLookup.error) {
    return "I could not load your current booking data right now. Open Bookings to check the latest status, payments, or messages.";
  }

  if (bookingLookup.records.length === 0) {
    return "I checked your TrabaWho bookings and did not find any recent booking records. You can start one from Browse by opening a provider profile.";
  }

  const lines = bookingLookup.records.slice(0, 4).map((record, index) =>
    `${index + 1}. ${record.serviceTitle} with ${record.providerName}: ${record.status}, ${record.scheduleLabel}, ${record.priceLabel}`
  );

  return `I found these recent bookings from your account:\n\n${lines.join("\n")}\n\nOpen Bookings to continue chat, payment, rescheduling, or refund actions.`;
};

const buildDatabaseFallbackReply = (marketplaceSearch: MarketplaceSearch, bookingLookup: BookingLookup) => {
  const bookingFallback = buildBookingFallbackReply(bookingLookup);
  if (bookingFallback) return bookingFallback;

  if (!marketplaceSearch.isMarketplaceIntent) return "";

  if (marketplaceSearch.error) {
    return "I could not load current marketplace data right now, so I cannot safely answer with live prices. Try again in a moment or search from Browse.";
  }

  if (marketplaceSearch.records.length === 0) {
    return "I checked the active TrabaWho listings, but I could not find a matching service price for that search. Try a broader service name, location, or budget.";
  }

  const desiredFamilyLabel = formatServiceFamilyList(marketplaceSearch.desiredFamilies);
  const isFallbackOnly = marketplaceSearch.desiredFamilies.length > 0 && !marketplaceSearch.hasExactFamilyMatch;
  const intro = isFallbackOnly
    ? `I did not find an exact active ${desiredFamilyLabel || "specialist"} listing, but these are the closest current TrabaWho matches:`
    : marketplaceSearch.isPriceIntent
      ? "I found these current prices from active TrabaWho listings:"
      : "I found these active TrabaWho services:";
  const lines = marketplaceSearch.records.slice(0, 5).map((record, index) => {
    const location = record.location ? ` in ${record.location}` : "";
    return `${index + 1}. ${record.title} by ${record.providerName}${location}: ${record.priceLabel}`;
  });

  return `${intro}\n\n${lines.join("\n")}\n\nOpen Browse to view the provider profile, compare details, or start a booking.`;
};

const buildMatchesPayload = (marketplaceSearch: MarketplaceSearch) =>
  marketplaceSearch.records.map((record) => ({
    id: record.id,
    sellerId: record.sellerId,
    title: record.title,
    providerName: record.providerName,
    serviceType: record.serviceType,
    location: record.location,
    priceLabel: record.priceLabel,
    amount: record.amount,
    currency: record.currency,
    rateBasis: record.rateBasis,
    bookingMode: record.bookingMode,
    isVerified: record.isVerified,
    verificationStatus: record.verificationStatus,
    serviceFamilies: record.serviceFamilies,
    matchQuality: record.matchQuality,
  }));

const buildSystemPrompt = (
  context: ChatContext = {},
  marketplaceSearch: MarketplaceSearch,
  bookingLookup: BookingLookup
) => {
  const currentView = normalizeContextValue(context.currentView, "landing");
  const role = normalizeContextValue(context.role, "guest");
  const isLoggedIn = Boolean(context.isLoggedIn);

  return [
    "You are the TrabaWho Assistant inside a local-service marketplace web app.",
    "Help users understand service discovery, bookings, seller onboarding, quotes, scheduling, payments, refunds, profile settings, and account navigation.",
    "Act like a smart in-app copilot: infer the user's likely intent from typos, partial words, and the screen they are on, but ask a clarifying question when confidence is low.",
    "Keep answers concise, practical, and specific to TrabaWho. Prefer 2 to 4 direct steps or one short paragraph.",
    "Do not give a giant menu of every feature unless the user explicitly asks what the app can do.",
    "For accidental or low-signal input such as repeated letters, one or two random characters, or keyboard mashes, say you did not catch it and offer three likely directions based on the current screen.",
    "Do not claim to access private account data, bookings, payments, or database records unless the user provides the details in the chat.",
    "If a user needs account-specific help, explain the relevant screen or next step without inventing private status.",
    "For payments and refunds, give app-navigation guidance and remind users to follow in-app confirmation flows.",
    "Navigation names you can use: Dashboard, Browse, Bookings, My Work, Profile, Settings, and Account & Privacy.",
    "Booking flow guidance: browse or search services, open a provider profile, choose a service or slot, confirm details, then follow the in-app payment or quote flow.",
    "Seller flow guidance: open seller setup or My Work, complete profile and service details, set pricing, availability, payment options, and keep listings current.",
    "Quote guidance: explain that quotes should clarify scope, schedule, price, and payment terms before confirmation.",
    "When the user asks about services, providers, or prices, use the marketplace database lookup context below. Give exact prices from that context only.",
    "When the user asks about their bookings, payments, refunds, or schedule status, use the private booking lookup context below if available.",
    "If the database lookup has no matching service records, say that clearly. Do not estimate, make up price ranges, or invent providers.",
    "If private booking lookup is unavailable, explain that the Bookings screen has the latest account-specific status.",
    "For price searches, answer with a compact list that includes service, provider, price basis, and location when available.",
    "If the user asks for a photo estimate but no image was attached, ask them to upload the problem photo and add any location or size details they know.",
    `Current app view: ${currentView}.`,
    `Current screen hint: ${viewGuidance[currentView] || "Use the current view and role to choose the next best navigation step."}`,
    `User login state: ${isLoggedIn ? "logged in" : "guest"}.`,
    `User role: ${role}.`,
    buildMarketplacePromptContext(marketplaceSearch),
    buildBookingPromptContext(bookingLookup),
  ].join("\n");
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    let body: ChatRequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .map(normalizeMessage)
      .filter((message): message is { role: ChatRole; content: string } => Boolean(message))
      .slice(-MAX_MESSAGES);

    if (messages.length === 0) {
      return jsonResponse({ error: "A message is required." }, 400);
    }

    const attachments = normalizeRequestAttachments(body);
    const imageAttachment = attachments.find((attachment) => attachment.type === "image") || null;
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";
    const deterministicReply = imageAttachment ? "" : buildDeterministicReply(latestUserMessage, body.context);
    if (deterministicReply) {
      return jsonResponse({
        message: deterministicReply,
        model: "trabawho-intent-router",
        matches: [],
      });
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY")?.trim();

    if (imageAttachment) {
      if (!groqApiKey) {
        return jsonResponse({ error: "The photo estimator is not configured yet." }, 503);
      }

      const problemAnalysis = await analyzeProblemImage(groqApiKey, imageAttachment, latestUserMessage);
      if (!problemAnalysis) {
        return jsonResponse({ error: "The assistant could not analyze that photo right now." }, 502);
      }

      const marketplaceSearch = await fetchMarketplaceSearch(
        req,
        buildProblemSearchText(latestUserMessage, problemAnalysis),
        body.context
      );
      const materialResearch = await fetchMaterialResearch(groqApiKey, problemAnalysis, latestUserMessage);
      const budgetEstimate = buildBudgetEstimate(problemAnalysis, materialResearch, marketplaceSearch);

      return jsonResponse({
        message: buildPhotoEstimateReply(problemAnalysis, budgetEstimate, marketplaceSearch, materialResearch),
        model: "trabawho-photo-budget-estimator",
        matches: buildMatchesPayload(marketplaceSearch),
        diagnosis: problemAnalysis,
        estimate: budgetEstimate,
        sources: materialResearch.sources,
      });
    }

    const marketplaceSearch = await fetchMarketplaceSearch(req, latestUserMessage, body.context);
    const bookingLookup = await fetchBookingLookup(req, latestUserMessage, body.context);
    if (!groqApiKey) {
      const fallbackReply = buildDatabaseFallbackReply(marketplaceSearch, bookingLookup);
      if (fallbackReply) {
        return jsonResponse({
          message: fallbackReply,
          model: "trabawho-db-search",
          matches: buildMatchesPayload(marketplaceSearch),
        });
      }

      console.error("trabawho-chatbot missing GROQ_API_KEY secret");
      return jsonResponse({ error: "The assistant is not configured yet." }, 503);
    }

    let groqPayload: Record<string, unknown>;
    let usedGroqModel = DEFAULT_GROQ_MODEL;

    try {
      const result = await callGroqWithModelFallback(groqApiKey, {
        messages: [
          { role: "system", content: buildSystemPrompt(body.context, marketplaceSearch, bookingLookup) },
          ...messages,
        ],
        temperature: 0.35,
        max_completion_tokens: 420,
      }, getGroqChatModels(), "chat");

      groqPayload = result.payload;
      usedGroqModel = result.model;
    } catch (error) {
      console.error("trabawho-chatbot provider error", {
        status: error instanceof GroqProviderError ? error.status : undefined,
        model: error instanceof GroqProviderError ? error.model : undefined,
        retryAfter: error instanceof GroqProviderError ? error.retryAfter : undefined,
        code: error instanceof GroqProviderError ? error.code || undefined : undefined,
        body: error instanceof GroqProviderError ? error.providerBody.slice(0, 500) : String(error).slice(0, 500),
      });

      const fallbackReply = buildDatabaseFallbackReply(marketplaceSearch, bookingLookup);
      if (fallbackReply) {
        return jsonResponse({
          message: fallbackReply,
          model: "trabawho-db-search",
          matches: buildMatchesPayload(marketplaceSearch),
        });
      }

      return jsonResponse({ error: "The assistant could not answer right now." }, 502);
    }

    const content = getGroqMessageContent(groqPayload).trim();

    if (!content) {
      return jsonResponse({ error: "The assistant returned an empty response." }, 502);
    }

    return jsonResponse({
      message: content.slice(0, 2000),
      model: getText(groqPayload["model"]) || usedGroqModel,
      matches: buildMatchesPayload(marketplaceSearch),
    });
  } catch (error) {
    console.error("trabawho-chatbot unexpected error", error);
    return jsonResponse({ error: "The assistant is unavailable right now." }, 500);
  }
});
