import { useState } from "react";
import { ChevronLeft, ChevronRight, Search, UserRound } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminAccount } from "../types";

const PAGE_SIZE = 8;

type PendingAction =
  | { account: AdminAccount; kind: "role"; role: "client" | "admin" }
  | { account: AdminAccount; kind: "restore" };

interface Props {
  accounts: AdminAccount[];
  isLoading: boolean;
  error: string;
  onRetry: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedRole: string;
  onRoleFilterChange: (value: string) => void;
  roleSavingId: string | null;
  accessSaving: boolean;
  onUpdateRole: (account: AdminAccount, role: "client" | "admin") => void;
  onOpenAccessAction: (account: AdminAccount, mode: "disable" | "ban") => void;
  onRestoreAccount: (account: AdminAccount) => void;
}

function AccountCard({ account, roleSavingId, accessSaving, onOpenAccessAction, onRequestAction }: {
  account: AdminAccount;
  roleSavingId: string | null;
  accessSaving: boolean;
  onOpenAccessAction: Props["onOpenAccessAction"];
  onRequestAction: (action: PendingAction) => void;
}) {
  const status = account.displayStatus || account.status || account.accountStatus || "active";
  const busy = roleSavingId === account.id || accessSaving;
  const initials = account.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <Card><CardContent className="space-y-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary" aria-hidden="true">{initials || <UserRound className="size-5" />}</span>
        <div className="min-w-0"><h2 className="break-words font-semibold text-foreground">{account.name}</h2><p className="break-all text-sm text-muted-foreground">{account.email}</p></div>
      </div>
      <Badge variant={status === "active" ? "success" : status === "suspended" ? "warning" : "destructive"} className="capitalize">{status}</Badge>
    </div>
    <dl className="grid gap-3 rounded-lg bg-primary/5 p-3 text-sm sm:grid-cols-3">
      <div><dt className="text-muted-foreground">Role</dt><dd className="mt-1"><Badge variant={account.role === "admin" ? "default" : "secondary"} className={account.role === "worker" ? "bg-primary/10 text-primary" : ""}>{account.role}</Badge></dd></div>
      <div><dt className="text-muted-foreground">Last updated</dt><dd className="mt-1 font-medium text-foreground">{account.lastSeen || "Unknown"}</dd></div>
      <div><dt className="text-muted-foreground">Access note</dt><dd className="mt-1 font-medium text-foreground">{status === "suspended" ? account.suspendedReason || "Suspended" : status === "disabled" ? account.disabledReason || "Disabled" : "No restrictions"}{status === "suspended" && account.suspendedUntil ? ` · Until ${new Date(account.suspendedUntil).toLocaleString()}` : ""}</dd></div>
    </dl>
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div role="group" aria-label={`Role changes for ${account.name}`} className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={busy || account.role === "client"} onClick={() => onRequestAction({ account, kind: "role", role: "client" })}>Set client</Button>
        <Button type="button" variant="outline" className="border-primary/30 bg-primary/5 text-primary hover:border-primary/50 hover:bg-primary/10 hover:text-primary" disabled={busy || account.role === "admin"} onClick={() => onRequestAction({ account, kind: "role", role: "admin" })}>Set admin</Button>
      </div>
      <div role="group" aria-label={`Access actions for ${account.name}`} className="flex flex-wrap gap-2 sm:ml-auto sm:justify-end">
        {status === "active" ? <><Button type="button" variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950 dark:hover:text-amber-200" disabled={busy} onClick={() => onOpenAccessAction(account, "disable")}>Disable</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => onOpenAccessAction(account, "ban")}>Suspend</Button></> : <Button type="button" variant="primary" disabled={busy} onClick={() => onRequestAction({ account, kind: "restore" })}>Restore</Button>}
      </div>
    </div>
  </CardContent></Card>;
}

export default function AdminAccountsTable({ accounts, isLoading, error, onRetry, searchQuery, onSearchChange, selectedRole, onRoleFilterChange, roleSavingId, accessSaving, onUpdateRole, onOpenAccessAction, onRestoreAccount }: Props) {
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const pageCount = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleAccounts = accounts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const first = accounts.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(currentPage * PAGE_SIZE, accounts.length);
  const filtered = Boolean(searchQuery.trim()) || selectedRole !== "all";

  const confirmAction = () => {
    if (!pending) return;
    if (pending.kind === "role") onUpdateRole(pending.account, pending.role);
    else onRestoreAccount(pending.account);
    setPending(null);
  };

  return <section className="space-y-5">
    <div><p className="text-sm font-semibold text-primary">Admin workspace</p><h1 className="mt-1 text-3xl font-bold">Account management</h1><p className="mt-2 text-muted-foreground">Find accounts, review access, and confirm changes before they take effect.</p></div>
    <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_200px]"><div className="space-y-2"><Label htmlFor="admin-account-search">Search accounts</Label><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 size-5 text-muted-foreground" /><Input id="admin-account-search" className="pl-10" placeholder="Search name, email, role" value={searchQuery} onChange={(event) => { setPage(1); onSearchChange(event.target.value); }} /></div></div><div className="space-y-2"><Label id="admin-role-label">Role</Label><Select value={selectedRole} onValueChange={(value) => { setPage(1); onRoleFilterChange(value); }}><SelectTrigger aria-labelledby="admin-role-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="client">Client</SelectItem><SelectItem value="worker">Worker</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div></CardContent></Card>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" onClick={onRetry}>Try again</Button></div>}
    {!isLoading && !error && <p className="text-sm font-medium text-muted-foreground" aria-live="polite">Showing {first}–{last} of {accounts.length} {filtered ? "matching " : ""}accounts</p>}
    {isLoading ? <p role="status" className="text-muted-foreground">Loading accounts…</p> : !error && accounts.length === 0 ? <Card><CardContent className="space-y-3 p-6"><h2 className="font-semibold">{filtered ? "No matching accounts" : "No accounts available"}</h2><p className="text-sm text-muted-foreground">{filtered ? "Try another search or clear the filters." : "Accounts will appear here when they are available."}</p>{filtered && <Button type="button" variant="outline" onClick={() => { setPage(1); onSearchChange(""); onRoleFilterChange("all"); }}>Clear filters</Button>}</CardContent></Card> : !error && <div className="grid gap-3">{visibleAccounts.map((account) => <AccountCard key={account.id} account={account} roleSavingId={roleSavingId} accessSaving={accessSaving} onOpenAccessAction={onOpenAccessAction} onRequestAction={setPending} />)}</div>}
    {!isLoading && !error && pageCount > 1 && <Pagination aria-label="Account pages"><PaginationContent><PaginationItem><Button type="button" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" />Previous</Button></PaginationItem><PaginationItem><span className="px-3 text-sm text-muted-foreground" aria-live="polite">Page {currentPage} of {pageCount}</span></PaginationItem><PaginationItem><Button type="button" variant="outline" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight aria-hidden="true" /></Button></PaginationItem></PaginationContent></Pagination>}
    <AlertDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open) setPending(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending?.kind === "restore" ? "Restore account?" : pending?.role === "admin" ? "Grant admin access?" : "Set account to client?"}</AlertDialogTitle><AlertDialogDescription>{pending?.kind === "restore" ? `This will re-enable ${pending.account.name}'s access to TrabaWho.` : pending?.role === "admin" ? `This grants ${pending?.account.name} administrator access to account management and moderation.` : `This changes ${pending?.account.name} to a client and removes their current role's access.`}</AlertDialogDescription></AlertDialogHeader><p className="break-all rounded-lg bg-muted p-3 text-sm font-medium text-foreground">{pending?.account.email}</p><AlertDialogFooter><Button type="button" variant="outline" onClick={() => setPending(null)}>Cancel</Button><Button type="button" variant={pending?.kind === "role" && pending.role === "client" ? "destructive" : "primary"} onClick={confirmAction}>Confirm {pending?.kind === "restore" ? "restore" : "role change"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
