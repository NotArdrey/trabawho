import { Ban, CheckCircle2, Search, ShieldOff, UserCog } from "lucide-react";

import { SelectField } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminAccount } from "@/features/admin/types";

interface AdminAccountsTableProps {
  normalizedAccounts: AdminAccount[];
  isAccountsLoading: boolean;
  accountsError: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedRole: string;
  onRoleFilterChange: (value: string) => void;
  roleSavingId: string | null;
  onUpdateRole: (account: AdminAccount, role: string) => Promise<void> | void;
  onOpenAccessAction: (account: AdminAccount, mode: "disable" | "ban") => void;
  onRestoreAccount: (account: AdminAccount) => Promise<void> | void;
}

const roleOptions = [
  { value: "all", label: "All roles" },
  { value: "client", label: "Clients" },
  { value: "worker", label: "Service providers" },
  { value: "admin", label: "Administrators" },
] as const;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

function statusVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "active") return "success";
  if (status === "suspended") return "warning";
  if (status === "disabled") return "destructive";
  return "secondary";
}

export default function AdminAccountsTable({
  normalizedAccounts,
  isAccountsLoading,
  accountsError,
  searchQuery,
  onSearchChange,
  selectedRole,
  onRoleFilterChange,
  roleSavingId,
  onUpdateRole,
  onOpenAccessAction,
  onRestoreAccount,
}: AdminAccountsTableProps) {
  return (
    <section aria-labelledby="user-management-title">
      <Card className="shadow-none">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserCog className="size-5" aria-hidden="true" />
              </div>
              <CardTitle id="user-management-title" className="text-2xl">User management</CardTitle>
              <CardDescription className="mt-2 leading-6">
                Find accounts, update client or administrator roles, and manage temporary access restrictions.
              </CardDescription>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-2xl">
              <div className="grid gap-2">
                <Label htmlFor="admin-user-search">Search users</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="admin-user-search"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search name, email, role"
                    className="pl-10"
                  />
                </div>
              </div>
              <SelectField
                id="admin-role-filter"
                label="Filter by role"
                value={selectedRole}
                onValueChange={onRoleFilterChange}
                options={roleOptions}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {accountsError ? (
            <div className="m-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
              <p className="font-semibold">Accounts could not be loaded</p>
              <p className="mt-1 leading-5">{accountsError}</p>
            </div>
          ) : null}

          {isAccountsLoading ? (
            <div className="m-5 rounded-lg border border-border bg-muted/30 p-5 text-sm text-muted-foreground" role="status">
              Loading user accounts…
            </div>
          ) : null}

          {!isAccountsLoading && !accountsError && normalizedAccounts.length === 0 ? (
            <div className="m-5 rounded-lg border border-dashed border-border bg-muted/30 p-5">
              <p className="font-semibold">No matching users</p>
              <p className="mt-1 text-sm text-muted-foreground">Change the search or role filter to see more accounts.</p>
            </div>
          ) : null}

          {!isAccountsLoading && normalizedAccounts.length > 0 ? (
            <div className="overflow-x-auto" aria-live="polite">
              <table className="w-full min-w-[68rem] border-collapse text-sm">
                <caption className="sr-only">TrabaWho user accounts and administrative actions</caption>
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">User</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Role</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Access notes</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Last seen</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {normalizedAccounts.map((account) => {
                    const isRoleSaving = roleSavingId === account.id;
                    return (
                      <tr key={account.id} className="align-top hover:bg-muted/20">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-foreground">{account.name}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">{account.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={account.role === "admin" ? "default" : "secondary"}>{account.role}</Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={statusVariant(account.displayStatus)}>{account.displayStatus}</Badge>
                        </td>
                        <td className="max-w-64 px-5 py-4 text-xs leading-5 text-muted-foreground">
                          {account.displayStatus === "suspended" ? (
                            <>
                              <span className="block text-foreground">{account.suspendedReason || "No suspension reason saved"}</span>
                              {account.suspendedUntil ? <span className="block">Until {formatDateTime(account.suspendedUntil)}</span> : null}
                            </>
                          ) : account.displayStatus === "disabled" ? (
                            <span className="text-foreground">{account.disabledReason || "No disable reason saved"}</span>
                          ) : (
                            "No access restrictions"
                          )}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{account.lastSeen}</td>
                        <td className="px-5 py-4">
                          <div className="flex max-w-80 flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isRoleSaving || account.role === "client"}
                              isLoading={isRoleSaving}
                              title={account.role === "client" ? "This user is already a client" : undefined}
                              onClick={() => { void onUpdateRole(account, "client"); }}
                            >
                              Set client
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isRoleSaving || account.role === "admin"}
                              isLoading={isRoleSaving}
                              title={account.role === "admin" ? "This user is already an administrator" : undefined}
                              onClick={() => { void onUpdateRole(account, "admin"); }}
                            >
                              Set admin
                            </Button>
                            {account.displayStatus === "active" ? (
                              <>
                                <Button type="button" size="sm" variant="outline" onClick={() => onOpenAccessAction(account, "disable")}>
                                  <ShieldOff aria-hidden="true" />
                                  Disable
                                </Button>
                                <Button type="button" size="sm" variant="destructive" onClick={() => onOpenAccessAction(account, "ban")}>
                                  <Ban aria-hidden="true" />
                                  Suspend
                                </Button>
                              </>
                            ) : (
                              <Button type="button" size="sm" variant="outline" onClick={() => { void onRestoreAccount(account); }}>
                                <CheckCircle2 aria-hidden="true" />
                                Restore access
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
