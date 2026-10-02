import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatArchiveBrowser } from "./ChatArchiveBrowser";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), restore: vi.fn() }));
vi.mock("../services/chatArchive", () => ({ fetchArchivedChats: mocks.fetch, unarchiveChat: mocks.restore }));
vi.mock("../hooks/useBookingConversation", () => ({ useBookingConversation: () => ({ messages: [{ id: "m1", sender: "worker", content: "Your appointment is confirmed." }], isLoading: false, messageError: "" }) }));
const chat = { id: "conversation:1", conversationId: "1", workerName: "Juan Provider", clientName: "Ana Client", serviceType: "Plumbing" };

describe("archived chats browser", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.fetch.mockResolvedValue([chat]); mocks.restore.mockResolvedValue(undefined); });
  const renderBrowser = (path = "/messages", onRestored = vi.fn().mockResolvedValue([])) => {
    render(<MemoryRouter initialEntries={[path]}><ChatArchiveBrowser viewerRole="buyer" onRestored={onRestored} /></MemoryRouter>);
    return onRestored;
  };

  it("opens from an empty inbox, shows history, and restores the active inbox", async () => {
    const refresh = renderBrowser();
    fireEvent.click(screen.getByRole("button", { name: "Archived chats" }));
    fireEvent.click(await screen.findByRole("button", { name: /Juan Provider/ }));
    expect(screen.getByText("Your appointment is confirmed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unarchive chat" }));
    expect(await screen.findByText(/Chat unarchived/)).toBeInTheDocument();
    expect(mocks.restore).toHaveBeenCalledWith("1");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/No archived chats\. Chats you archive/)).toBeInTheDocument();
  });

  it("restores the archive from its URL and supports search", async () => {
    renderBrowser("/messages?inbox=archived");
    expect(await screen.findByRole("button", { name: /Juan Provider/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search archived chats" }), { target: { value: "tutor" } });
    expect(screen.getByText("No archived chats match your search.")).toBeInTheDocument();
  });

  it("recovers from loading errors", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    renderBrowser("/messages?inbox=archived");
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load archived chats");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: /Juan Provider/ })).toBeInTheDocument();
  });

  it("keeps a failed restore open and blocks duplicate submissions", async () => {
    let rejectRestore: (reason: Error) => void = () => {};
    mocks.restore.mockReturnValue(new Promise<void>((_resolve, reject) => { rejectRestore = reject; }));
    renderBrowser("/messages?inbox=archived");
    fireEvent.click(await screen.findByRole("button", { name: /Juan Provider/ }));
    fireEvent.click(screen.getByRole("button", { name: "Unarchive chat" }));
    expect(screen.getByRole("button", { name: "Unarchiving…" })).toBeDisabled();
    expect(mocks.restore).toHaveBeenCalledTimes(1);
    rejectRestore(new Error("offline"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to unarchive"));
    expect(screen.getByRole("button", { name: "Unarchive chat" })).toBeEnabled();
  });
});
