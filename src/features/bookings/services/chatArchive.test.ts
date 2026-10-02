import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchArchivedChats, unarchiveChat } from "./chatArchive";
import { isArchivedForUser, removeArchiveForUser } from "../utils/chatArchive";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), hydrate: vi.fn(), hydrateBookings: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }));
vi.mock("./bookingService", () => ({ hydrateConversationRows: mocks.hydrate, hydrateBookingRows: mocks.hydrateBookings }));

describe("chat archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "me" } }, error: null });
    mocks.hydrate.mockImplementation((rows: unknown) => rows);
    mocks.hydrateBookings.mockResolvedValue([]);
  });

  it("includes only the viewer's archived chats and excludes deleted chats", () => {
    expect(isArchivedForUser({ archived_by: ["me"] }, "me")).toBe(true);
    expect(isArchivedForUser({ archivedBy: "me" }, "me")).toBe(true);
    expect(isArchivedForUser({ archived_by: ["other"] }, "me")).toBe(false);
    expect(isArchivedForUser({ archived_by: ["me"], deletedBy: ["me"] }, "me")).toBe(false);
    expect(isArchivedForUser(null, "me")).toBe(false);
  });

  it("preserves the other participant's archive, deletion and business metadata", () => {
    const metadata = { archived_by: ["me", "other"], archivedBy: ["me", "other"],
      archived_at_by: { me: "today", other: "yesterday" }, archivedAtBy: { me: "today" },
      deleted_by: ["other"], quote_amount: 500 };
    expect(removeArchiveForUser(metadata, "me")).toEqual({ archived_by: ["other"], archivedBy: ["other"],
      archived_at_by: { other: "yesterday" }, archivedAtBy: {}, deleted_by: ["other"], quote_amount: 500 });
    expect(metadata.archived_by).toEqual(["me", "other"]);
  });

  for (const role of ["buyer", "seller"] as const) {
    it(`fetches booking and standalone threads scoped to the ${role}`, async () => {
      const rows = [
        { id: "booking-chat", booking_id: "booking-1", metadata: { archived_by: ["me"] } },
        { id: "standalone", booking_id: null, metadata: { archivedBy: ["me"] } },
        { id: "deleted", metadata: { archived_by: ["me"], deleted_by: ["me"] } },
        { id: "active", metadata: {} },
      ];
      const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: rows, error: null }) };
      const bookingQuery = { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
      mocks.from.mockReturnValueOnce(query).mockReturnValueOnce(bookingQuery);
      expect(await fetchArchivedChats(role)).toEqual(rows.slice(0, 2));
      expect(query.eq).toHaveBeenCalledWith(`${role}_id`, "me");
      expect(mocks.hydrate).toHaveBeenCalledWith(rows.slice(0, 2));
      expect(bookingQuery.in).toHaveBeenCalledWith("id", ["booking-1"]);
    });
  }

  it("reads fresh metadata and scopes both restore queries to the participant", async () => {
    const select = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { metadata: { archived_by: ["me", "other"], note: "keep" } }, error: null }) };
    const update = { ...select, update: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: "chat-1" }, error: null }) };
    mocks.from.mockReturnValueOnce(select).mockReturnValueOnce(update);
    await unarchiveChat("chat-1");
    expect(update.update).toHaveBeenCalledWith({ metadata: { archived_by: ["other"], note: "keep" } });
    expect(select.or).toHaveBeenCalledWith("buyer_id.eq.me,seller_id.eq.me");
    expect(update.eq).toHaveBeenCalledWith("id", "chat-1");
  });

  it("rejects deleted or unavailable chats without updating them", async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { metadata: { archived_by: ["me"], deleted_by: ["me"] } }, error: null }) };
    mocks.from.mockReturnValue(query);
    await expect(unarchiveChat("deleted")).rejects.toThrow("no longer in your archive");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});
