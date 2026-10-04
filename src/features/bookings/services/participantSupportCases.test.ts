import { listParticipantSupportCases } from "./participantSupportCases";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase", () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }));
vi.mock("./bookingService", () => ({ fetchBookingById: vi.fn() }));

type Row = Record<string, unknown>;
function mockTables(tables: Record<string, Row[]>) {
  const queries: Array<{ table: string; query: ReturnType<typeof createQuery> }> = [];
  function createQuery(table: string) {
    let start = 0;
    let end: number | undefined;
    const matches: Array<{ key: string; values: unknown[] }> = [];
    const query = {
      select: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      in: vi.fn((key: string, values: unknown[]) => { matches.push({ key, values }); return query; }),
      eq: vi.fn((key: string, value: unknown) => { matches.push({ key, values: [value] }); return query; }),
      is: vi.fn((key: string, value: unknown) => { matches.push({ key, values: [value] }); return query; }),
      range: vi.fn((first: number, last: number) => { start = first; end = last + 1; return query; }),
      then: (resolve: (result: { data: Row[]; error: null }) => void) => {
        const rows = (tables[table] || []).filter((row) => matches.every((match) => match.values.includes(row[match.key])));
        resolve({ data: rows.slice(start, end), error: null });
      },
    };
    return query;
  }
  mocks.from.mockImplementation((table: string) => {
    const query = createQuery(table);
    queries.push({ table, query });
    return query;
  });
  return queries;
}

describe("participant support cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "member-1" } }, error: null });
  });

  it("scopes bookings to the signed-in member, includes both roles, and keeps closed cases", async () => {
    const queries = mockTables({
      bookings: [
        { id: "purchased", buyer_id: "member-1", seller_id: "provider-1", service_id: 1 },
        { id: "provided", buyer_id: "client-1", seller_id: "member-1", service_id: 2 },
      ],
      booking_support_cases: [
        { id: "case-1", booking_id: "purchased", created_at: "2026-10-03", status: "closed" },
        { id: "case-2", booking_id: "provided", created_at: "2026-10-02", status: "open" },
        { id: "unrelated", booking_id: "someone-else", created_at: "2026-10-04", status: "open" },
      ],
      services: [{ id: 1, title: "Purchased repair" }, { id: 2, title: "Provided repair" }],
      profiles: [{ user_id: "provider-1", full_name: "Repair Provider" }, { user_id: "client-1", full_name: "Repair Client" }],
      booking_case_notifications: [{ case_id: "case-1", recipient_id: "member-1", read_at: null }],
    });
    const result = await listParticipantSupportCases();
    expect(queries.find((entry) => entry.table === "bookings")?.query.or)
      .toHaveBeenCalledWith("buyer_id.eq.member-1,seller_id.eq.member-1");
    expect(result).toMatchObject([
      { report: { id: "case-1", status: "closed" }, viewerRole: "client", unreadCount: 1, counterpartName: "Repair Provider", serviceTitle: "Purchased repair" },
      { report: { id: "case-2" }, viewerRole: "provider", counterpartName: "Repair Client", serviceTitle: "Provided repair" },
    ]);
  });

  it("paginates booking and case reads rather than hiding older disputes", async () => {
    const bookings = Array.from({ length: 101 }, (_, index) => ({ id: `booking-${index}`, buyer_id: "member-1", seller_id: "provider", service_id: 1 }));
    mockTables({ bookings, booking_support_cases: bookings.map((booking, index) => ({
      id: `case-${index}`, booking_id: booking.id, created_at: "2026-10-03", status: "open",
    })) });
    const result = await listParticipantSupportCases();
    expect(result).toHaveLength(101);
    expect(result.some((item) => item.report.id === "case-100")).toBe(true);
  });

  it("does not read case data after authentication is lost", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { code: "401" } });
    await expect(listParticipantSupportCases()).rejects.toThrow("Please sign in again");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("avoids a case query when the member has no bookings", async () => {
    mockTables({});
    await expect(listParticipantSupportCases()).resolves.toEqual([]);
    expect(mocks.from).toHaveBeenCalledOnce();
  });
});
