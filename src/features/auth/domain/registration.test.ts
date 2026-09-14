import {
  EMPTY_REGISTRATION_FORM,
  getIdentityDocument,
  validateManualIdentity,
  validateRegistrationStep,
} from "./registration";

describe("registration domain", () => {
  it("keeps account type independent from the document verification path", () => {
    expect(getIdentityDocument("id_card")?.method).toBe("DIDIT");
    expect(getIdentityDocument("umid")?.method).toBe("MANUAL");
  });

  it("validates credentials before the security step can advance", () => {
    const errors = validateRegistrationStep({ ...EMPTY_REGISTRATION_FORM, email: "invalid", password: "password", confirmPassword: "different" }, 2);
    expect(errors).toEqual({
      email: "Enter a valid email address.",
      password: "Include at least one uppercase letter and one number.",
      confirmPassword: "Passwords do not match.",
    });
  });

  it("requires the complete service location and both consents", () => {
    const locationErrors = validateRegistrationStep(EMPTY_REGISTRATION_FORM, 3);
    expect(Object.keys(locationErrors)).toEqual(["province", "city", "barangay", "address"]);
    const consentErrors = validateRegistrationStep(EMPTY_REGISTRATION_FORM, 4);
    expect(Object.keys(consentErrors)).toEqual(["acceptedIdentityTerms", "acceptedRaTerms"]);
  });

  it("keeps manual evidence validation separate from the four account steps", () => {
    expect(validateRegistrationStep({ ...EMPTY_REGISTRATION_FORM, acceptedIdentityTerms: true, acceptedRaTerms: true }, 4)).toEqual({});
    expect(Object.keys(validateManualIdentity(EMPTY_REGISTRATION_FORM))).toEqual([
      "manualFullName", "identityDocumentNumber", "idDocumentExpiry", "frontImage", "backImage", "selfieImage",
    ]);
  });
});
