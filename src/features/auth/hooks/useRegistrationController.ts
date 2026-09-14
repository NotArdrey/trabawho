import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearIdentitySignupState,
  fetchDiditIdentitySession,
  finishDiditIdentitySignup,
  isTerminalIdentityFailure,
  loadIdentitySignupState,
  submitManualIdentityReview,
  startDiditIdentitySession,
} from "@/shared/services/identityRegistrationService";
import {
  EMPTY_REGISTRATION_FORM,
  getIdentityDocument,
  hasRegistrationErrors,
  validateManualIdentity,
  validateRegistrationStep,
} from "@/features/auth/domain/registration";
import {
  fetchBarangays,
  fetchCities,
  fetchProvinces,
} from "@/features/auth/services/registration-location";
import type {
  IdentitySignupResult,
  IdentitySignupSession,
  LocationOption,
  RegistrationErrors,
  RegistrationField,
  RegistrationFormValues,
  RegistrationLocationState,
  RegistrationOutcome,
  RegistrationPhase,
  RegistrationStep,
} from "@/features/auth/types";

const EMPTY_LOCATION_STATE: RegistrationLocationState = {
  provinces: [],
  cities: [],
  barangays: [],
  selectedProvinceCode: "",
  selectedCityCode: "",
  selectedBarangayCode: "",
  loadingLevel: null,
  error: "",
};

function getSafeRegistrationError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/already registered|active registration|another account type/i.test(message)) {
    return message;
  }
  if (/rate limit|too many/i.test(message)) {
    return "Too many registration attempts. Wait a few minutes, then try again.";
  }
  if (/network|fetch|failed to send/i.test(message)) {
    return "Registration could not reach the verification service. Check your connection and try again.";
  }
  if (/not configured/i.test(message)) {
    return "Identity verification is temporarily unavailable. Please try again later.";
  }
  return message || "Registration could not be completed. Review your information and try again.";
}

function getOptionName(options: LocationOption[], code: string): string {
  return options.find((option) => option.code === code)?.name ?? "";
}

export function useRegistrationController() {
  const [restoredSession] = useState<IdentitySignupSession | null>(() => {
    const stored = loadIdentitySignupState() as IdentitySignupSession | null;
    return stored?.diditSessionId && stored.verificationUrl ? stored : null;
  });
  const [values, setValues] = useState<RegistrationFormValues>(() => ({
    ...EMPTY_REGISTRATION_FORM,
    email: restoredSession?.email ?? "",
    password: restoredSession?.password ?? "",
    confirmPassword: restoredSession?.password ?? "",
    accountRole: restoredSession?.appRole ?? "",
    documentTypeKey: restoredSession?.documentTypeKey ?? "",
    province: restoredSession?.province ?? "",
    city: restoredSession?.city ?? "",
    barangay: restoredSession?.barangay ?? "",
    address: restoredSession?.address ?? "",
    acceptedIdentityTerms: restoredSession?.acceptedIdentityTerms ?? false,
    acceptedRaTerms: restoredSession?.acceptedRaTerms ?? false,
  }));
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [step, setStep] = useState<RegistrationStep>(1);
  const [phase, setPhase] = useState<RegistrationPhase>(restoredSession ? "didit" : "form");
  const [location, setLocation] = useState<RegistrationLocationState>(EMPTY_LOCATION_STATE);
  const [identitySession, setIdentitySession] = useState<IdentitySignupSession | null>(restoredSession);
  const [outcome, setOutcome] = useState<RegistrationOutcome | null>(null);
  const [statusMessage, setStatusMessage] = useState(restoredSession
    ? "Your verification session was restored. Continue in Didit or check its status."
    : "");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const locationRequestRef = useRef(0);

  const selectedDocument = useMemo(
    () => getIdentityDocument(values.documentTypeKey),
    [values.documentTypeKey],
  );

  const loadProvinces = useCallback(async () => {
    const requestId = ++locationRequestRef.current;
    setLocation((current) => ({ ...current, loadingLevel: "province", error: "" }));
    try {
      const provinces = await fetchProvinces();
      if (requestId !== locationRequestRef.current) return;
      setLocation((current) => ({ ...current, provinces, loadingLevel: null }));
    } catch {
      if (requestId !== locationRequestRef.current) return;
      setLocation((current) => ({
        ...current,
        provinces: [],
        loadingLevel: null,
        error: "Provinces could not be loaded. Try again to continue.",
      }));
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadProvinces(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadProvinces]);

  const updateField = useCallback(<Field extends RegistrationField>(
    field: Field,
    value: RegistrationFormValues[Field],
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  }, []);

  const selectProvince = useCallback(async (code: string) => {
    const province = getOptionName(location.provinces, code);
    setValues((current) => ({ ...current, province, city: "", barangay: "" }));
    setErrors((current) => ({ ...current, province: undefined, city: undefined, barangay: undefined }));
    setLocation((current) => ({
      ...current,
      selectedProvinceCode: code,
      selectedCityCode: "",
      selectedBarangayCode: "",
      cities: [],
      barangays: [],
      loadingLevel: "city",
      error: "",
    }));

    const requestId = ++locationRequestRef.current;
    try {
      const cities = await fetchCities(code);
      if (requestId !== locationRequestRef.current) return;
      setLocation((current) => ({ ...current, cities, loadingLevel: null }));
    } catch {
      if (requestId !== locationRequestRef.current) return;
      setLocation((current) => ({
        ...current,
        cities: [],
        loadingLevel: null,
        error: "Cities and municipalities could not be loaded. Try selecting the province again.",
      }));
    }
  }, [location.provinces]);

  const selectCity = useCallback(async (code: string) => {
    const city = getOptionName(location.cities, code);
    setValues((current) => ({ ...current, city, barangay: "" }));
    setErrors((current) => ({ ...current, city: undefined, barangay: undefined }));
    setLocation((current) => ({
      ...current,
      selectedCityCode: code,
      selectedBarangayCode: "",
      barangays: [],
      loadingLevel: "barangay",
      error: "",
    }));

    const requestId = ++locationRequestRef.current;
    try {
      const barangays = await fetchBarangays(code);
      if (requestId !== locationRequestRef.current) return;
      setLocation((current) => ({ ...current, barangays, loadingLevel: null }));
    } catch {
      if (requestId !== locationRequestRef.current) return;
      setLocation((current) => ({
        ...current,
        barangays: [],
        loadingLevel: null,
        error: "Barangays could not be loaded. Try selecting the city or municipality again.",
      }));
    }
  }, [location.cities]);

  const selectBarangay = useCallback((code: string) => {
    const barangay = getOptionName(location.barangays, code);
    setValues((current) => ({ ...current, barangay }));
    setErrors((current) => ({ ...current, barangay: undefined }));
    setLocation((current) => ({ ...current, selectedBarangayCode: code }));
  }, [location.barangays]);

  const goToStep = useCallback((nextStep: RegistrationStep) => {
    if (nextStep > step) return;
    setStep(nextStep);
    setErrors({});
    setSubmitError("");
  }, [step]);

  const continueFromStep = useCallback(() => {
    const nextErrors = validateRegistrationStep(values, step);
    setErrors(nextErrors);
    if (hasRegistrationErrors(nextErrors)) return;

    if (step < 4) setStep((step + 1) as RegistrationStep);
  }, [step, values]);

  const back = useCallback(() => {
    setErrors({});
    setSubmitError("");
    if (phase === "manual") {
      setPhase("form");
      setStep(4);
      return;
    }
    if (phase !== "form" || step === 1) return;
    setStep((step - 1) as RegistrationStep);
  }, [phase, step]);

  const beginVerification = useCallback(async () => {
    for (const registrationStep of [1, 2, 3, 4] as const) {
      const nextErrors = validateRegistrationStep(values, registrationStep);
      if (hasRegistrationErrors(nextErrors)) {
        setErrors(nextErrors);
        setStep(registrationStep);
        return;
      }
    }

    if (selectedDocument?.method === "MANUAL") {
      setErrors({});
      setPhase("manual");
      return;
    }

    if (!selectedDocument) {
      setErrors({ documentTypeKey: "Choose an identity document." });
      setStep(1);
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setStatusMessage("Creating a secure Didit verification session…");
      const session = await startDiditIdentitySession(values) as IdentitySignupSession;
      setIdentitySession(session);
      setPhase("didit");
      setStatusMessage("Your secure Didit session is ready.");
    } catch (error) {
      setSubmitError(getSafeRegistrationError(error));
      setStatusMessage("");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedDocument, values]);

  const submitManualReview = useCallback(async () => {
    const nextErrors = validateManualIdentity(values);
    setErrors(nextErrors);
    if (hasRegistrationErrors(nextErrors)) return;

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setStatusMessage("Uploading your identity information securely…");
      const result = await submitManualIdentityReview(values) as IdentitySignupResult;
      setOutcome({
        kind: "pending",
        title: "Manual review submitted",
        message: result.message
          || "Your account is pending identity review. We will email you after an administrator makes a decision.",
      });
      setPhase("outcome");
      setStatusMessage("");
    } catch (error) {
      setSubmitError(getSafeRegistrationError(error));
      setStatusMessage("");
    } finally {
      setIsSubmitting(false);
    }
  }, [values]);

  const checkDiditStatus = useCallback(async () => {
    if (!identitySession?.diditSessionId) {
      setSubmitError("Start a Didit verification session first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setStatusMessage("Checking the Didit verification result…");
      const sessionResult = await fetchDiditIdentitySession(identitySession.diditSessionId) as { status?: string };
      const status = sessionResult.status ?? "PENDING";

      if (status === "APPROVED" || status === "PENDING_REVIEW") {
        const result = await finishDiditIdentitySignup(identitySession, status) as IdentitySignupResult;
        const pending = status === "PENDING_REVIEW" || result.identityStatus === "PENDING_REVIEW";
        setOutcome({
          kind: pending ? "pending" : "approved",
          title: pending ? "Identity review pending" : "Identity approved",
          message: result.message || (pending
            ? "Your account is pending administrator review. Login access remains locked until approval."
            : "Your identity was approved. Confirm your email, then sign in."),
        });
        setIdentitySession(null);
        setPhase("outcome");
        setStatusMessage("");
        return;
      }

      if (status === "RESUBMISSION_REQUIRED") {
        setStatusMessage("Didit needs new information. Reopen the verification session and complete the requested steps.");
        return;
      }

      if (isTerminalIdentityFailure(status)) {
        clearIdentitySignupState();
        setIdentitySession(null);
        setOutcome({
          kind: "failed",
          title: "Verification was not completed",
          message: "You can retry with a supported Didit document or choose a document for manual review.",
        });
        setPhase("outcome");
        setStatusMessage("");
        return;
      }

      setStatusMessage("Didit is still processing your verification. Check again in a moment.");
    } catch (error) {
      setSubmitError(getSafeRegistrationError(error));
      setStatusMessage("");
    } finally {
      setIsSubmitting(false);
    }
  }, [identitySession]);

  const restart = useCallback(() => {
    clearIdentitySignupState();
    setIdentitySession(null);
    setOutcome(null);
    setPhase("form");
    setStep(1);
    setErrors({});
    setSubmitError("");
    setStatusMessage("");
  }, []);

  return {
    values,
    errors,
    step,
    phase,
    location,
    selectedDocument,
    identitySession,
    outcome,
    statusMessage,
    submitError,
    isSubmitting,
    updateField,
    selectProvince,
    selectCity,
    selectBarangay,
    loadProvinces,
    goToStep,
    continueFromStep,
    back,
    beginVerification,
    submitManualReview,
    checkDiditStatus,
    restart,
  };
}
