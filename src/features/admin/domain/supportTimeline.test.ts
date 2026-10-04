import { describe, expect, it } from "vitest";
import { supportTimeline } from "./supportTimeline";
import { supportCaseNextStep } from "./supportCaseNextStep";
import type { SupportCaseDetail, SupportCase } from "@/features/admin/services/adminSupportService";

describe("support follow-up presentation", () => {
  const data: Pick<SupportCaseDetail, "audit" | "caseActions" | "adminActions"> = {
    audit: [{ id: 1, event_type: "admin_case_followup", actor_role: "admin", reason: "Review the payment before deciding a refund.",
      idempotency_key: "operation-1", created_at: "2026-10-02T14:18:00Z" }],
    caseActions: [],
    adminActions: [{ id: 2, action: "refund_review_needed", target_party: null, reason: "Review the payment before deciding a refund.",
      operation_id: "operation-1", created_at: "2026-10-02T14:18:00Z" }],
  };
  it("shows a single specific entry for an action and its matching audit event", () => {
    expect(supportTimeline(data)).toEqual([{ id: "admin-2", at: "2026-10-02T14:18:00Z", label: "Refer for refund review", note: data.adminActions[0].reason }]);
  });
  it("preserves unmatched audit history instead of deduplicating by note or timestamp", () => {
    expect(supportTimeline({ ...data, adminActions: [] })).toHaveLength(1);
    expect(supportTimeline({ ...data, audit: [{ ...data.audit[0], idempotency_key: "operation-2" }] })).toHaveLength(2);
  });
  it("shows the recorded refund referral as the next step", () => {
    const item = { status: "under_review", policy_route: "support_review", latestFollowup: { action: "refund_review_needed", created_at: "2026-10-02T14:18:00Z" } } as SupportCase;
    expect(supportCaseNextStep(item)).toBe("Referred for refund review");
    expect(supportCaseNextStep({ ...item, status: "closed" })).toBe("Case closed");
  });
  it("does not present a seeded showcase event as verified provider payment", () => {
    const entries = supportTimeline({ audit: [{ ...data.audit[0], event_type: "showcase_upfront_payment_confirmed" }], caseActions: [], adminActions: [] });
    expect(entries[0]).toMatchObject({ label: "Demo seed · not payment evidence",
      note: "Seeded demonstration history; verify provider payment attempts separately." });
  });
});
