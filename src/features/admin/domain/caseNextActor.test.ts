import { describe, expect, it } from "vitest";
import { caseNextActor, type CaseNextActorInput } from "./caseNextActor";

const base: CaseNextActorInput = {
  status: "open", policy_route: "rework_request",
  provider_response_action: "offer_rework", rework_state: null,
};

describe("caseNextActor", () => {
  it.each([
    [{ ...base, provider_response_action: null }, "Provider"],
    [base, "Provider"],
    [{ ...base, rework_state: "appointment_proposed" }, "Client"],
    [{ ...base, rework_state: "appointment_accepted" }, "Provider"],
    [{ ...base, rework_state: "rework_delivered" }, "Client"],
    [{ ...base, rework_state: "escalated", status: "under_review" }, "Support review"],
    [{ ...base, rework_state: "resolved_by_client", status: "closed" }, "No action needed"],
    [{ ...base, policy_route: "support_review" }, "Support review"],
  ] as const)("maps case state to the next actor", (input, expected) => {
    expect(caseNextActor(input as CaseNextActorInput)).toBe(expected);
  });
});
