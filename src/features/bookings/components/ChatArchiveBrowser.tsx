import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useChatArchive } from "../hooks/useChatArchive";
import type { ArchivedChat, ChatViewerRole } from "../services/chatArchive";
import { ArchivedChatHistory } from "./ArchivedChatHistory";

interface ChatArchiveBrowserProps {
  viewerRole: ChatViewerRole;
  onRestored: () => Promise<unknown>;
}

export function ChatArchiveBrowser({ viewerRole, onRestored }: ChatArchiveBrowserProps) {
  const [params, setParams] = useSearchParams();
  const open = params.get("inbox") === "archived";
  const [selected, setSelected] = useState<ArchivedChat | null>(null);
  const [search, setSearch] = useState("");
  const archive = useChatArchive(open, viewerRole, onRestored);
  const name = (chat: ArchivedChat) => viewerRole === "seller" ? chat.clientName : chat.workerName;
  const rows = archive.chats.filter((chat) => `${name(chat)} ${chat.serviceType}`.toLowerCase().includes(search.trim().toLowerCase()));

  const changeOpen = (nextOpen: boolean) => {
    if (archive.restoring) return;
    setSelected(null);
    setSearch("");
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (nextOpen) next.set("inbox", "archived");
      else next.delete("inbox");
      return next;
    });
  };

  return <div className="flex min-w-0 justify-end">
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild><Button variant="outline"><Archive aria-hidden="true" className="size-4" />Archived chats</Button></DialogTrigger>
      <DialogContent className="max-w-2xl" showClose={!archive.restoring}>
        <DialogHeader>
          <DialogTitle>{selected ? name(selected) : "Archived chats"}</DialogTitle>
          <DialogDescription>{selected ? `${selected.serviceType} · Unarchive this chat to continue the conversation in Messages.` : "Conversations you archived are saved here. Open a chat to read its history or return it to your inbox."}</DialogDescription>
        </DialogHeader>
        {archive.error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{archive.error}</p>{!selected && <Button variant="outline" onClick={() => { void archive.refresh(); }} disabled={archive.loading}>Try again</Button>}</div>}
        {archive.notice && <p role="status" className="text-sm text-primary">{archive.notice}</p>}
        {selected ? <>
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => setSelected(null)} disabled={archive.restoring}><ArrowLeft aria-hidden="true" className="size-4" />Back to archived chats</Button>
            <Button disabled={archive.restoring} onClick={() => { void archive.restore(selected).then((restored) => { if (restored) setSelected(null); }); }}><ArchiveRestore aria-hidden="true" className="size-4" />{archive.restoring ? "Unarchiving…" : "Unarchive chat"}</Button>
          </div>
          <ArchivedChatHistory key={selected.conversationId} chat={selected} />
        </> : <>
          <SearchFilterBar searchLabel="Search archived chats" searchPlaceholder="Search people or services" searchValue={search} onSearchValueChange={setSearch} />
          {archive.loading ? <p role="status" className="text-sm text-muted-foreground">Loading archived chats…</p> : !archive.error && <>
            {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{archive.chats.length ? "No archived chats match your search." : "No archived chats. Chats you archive will appear here."}</p>}
            <ul className="divide-y divide-border">
              {rows.map((chat) => <li key={chat.conversationId}><Button variant="ghost" className="h-auto min-h-11 w-full justify-start whitespace-normal py-3 text-left" onClick={() => setSelected(chat)}>
                <Archive aria-hidden="true" className="size-4 shrink-0 text-primary" /><span className="min-w-0 break-words"><span className="block font-semibold">{name(chat)}</span><span className="block text-sm font-normal text-muted-foreground">{chat.serviceType}</span></span>
              </Button></li>)}
            </ul>
          </>}
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
