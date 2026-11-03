"use client";

import { useEffect, useId, useState } from "react";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Minus,
  Pencil,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  UserX,
  Wrench,
  X,
} from "lucide-react";
import { MetricStrip } from "./metric-strip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField, NativeSelect } from "@/components/shared/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { EASE } from "@/components/motion";
import { formatDate, formatRelative, initials } from "@/lib/format";
import type { AppRole, Branch } from "@/lib/types";
import {
  CAPABILITIES,
  PASSWORD_MIN,
  ROLES,
  ROLE_INFO,
  checkUserChange,
  createUserSchema,
  passwordStrength,
  resetPasswordSchema,
  updateUserSchema,
  type CreateUserValues,
  type ResetPasswordValues,
} from "@/lib/users";
import { cn } from "@/lib/utils";
import type { UnlinkedTechnician, UserRow } from "@/app/(app)/admin/users/_lib/users";
import { createUserAction, resetPasswordAction, updateUserAction } from "@/app/(app)/admin/users/actions";

const ROLE_TONE: Record<AppRole, string> = {
  admin: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  manager: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  technician: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
};

function RolePill({ role }: { role: AppRole }) {
  return <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium", ROLE_TONE[role])}>{ROLE_INFO[role].label}</span>;
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      {active ? "Active" : "Deactivated"}
    </span>
  );
}

type Editing = { mode: "create" } | { mode: "edit"; user: UserRow } | null;

export function UsersAdmin({
  users,
  branches,
  unlinkedTechnicians,
  currentUserId,
}: {
  users: UserRow[];
  branches: Branch[];
  unlinkedTechnicians: UnlinkedTechnician[];
  currentUserId: string;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("active");
  const [branch, setBranch] = useState("all");
  const ids = useId();

  const term = q.trim().toLowerCase();
  const rows = users.filter(
    (u) =>
      (term === "" || u.fullName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)) &&
      (role === "all" || u.role === role) &&
      (status === "all" || (status === "active") === u.active) &&
      (branch === "all" || String(u.branchId) === branch),
  );
  const activeAdmins = users.filter((u) => u.role === "admin" && u.active).length;
  const counts = {
    active: users.filter((u) => u.active).length,
    deactivated: users.filter((u) => !u.active).length,
    ...Object.fromEntries(ROLES.map((r) => [r, users.filter((u) => u.active && u.role === r).length])),
  } as Record<"active" | "deactivated" | AppRole, number>;

  return (
    <Tabs defaultValue="users" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="users" className="h-9 flex-1 px-3 sm:h-auto sm:flex-none">
            <Users /> Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="h-9 flex-1 px-3 sm:h-auto sm:flex-none">
            <ShieldCheck /> Roles & access
          </TabsTrigger>
        </TabsList>
        <Button onClick={() => setEditing({ mode: "create" })} className="shadow-brand/25 h-11 w-full shadow-md sm:h-9 sm:w-auto">
          <UserPlus /> New user
        </Button>
      </div>

      <TabsContent value="users" className="space-y-4">
        <MetricStrip
          items={[
            { label: "Active users", value: counts.active, icon: <Users /> },
            { label: "Admins", value: counts.admin, icon: <ShieldCheck /> },
            { label: "Managers", value: counts.manager, icon: <BadgeCheck /> },
            { label: "Technicians", value: counts.technician, icon: <Wrench /> },
            { label: "Deactivated", value: counts.deactivated, icon: <UserX />, tone: counts.deactivated ? "muted" : "default" },
          ]}
        />

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <label htmlFor={`${ids}-q`} className="sr-only">
              Search users
            </label>
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              id={`${ids}-q`}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email"
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-11 w-full rounded-lg border pr-10 pl-9 text-base shadow-xs outline-none focus-visible:ring-3 sm:h-9 sm:text-sm"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground hover:bg-muted absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md sm:size-6"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex [&_select]:h-11 [&_select]:shadow-xs sm:[&_select]:h-9 [&>*:last-child]:col-span-2">
            {/* the branch filter spans the row on phones (third of an odd set) */}
            <NativeSelect aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-40">
              <option value="all">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_INFO[r].label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40">
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
              <option value="all">All statuses</option>
            </NativeSelect>
            <NativeSelect aria-label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} className="sm:w-44">
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No users match" description="Adjust the search or filters, or create a new user." />
        ) : (
          <>
            <div className="bg-card hidden overflow-hidden rounded-xl border shadow-xs md:block">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground pl-4 text-xs">User</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Role</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Branch</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Last sign-in</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Created</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: EASE, delay: Math.min(i, 12) * 0.02 }}
                      className={cn("hover:bg-muted/40 border-b transition-colors last:border-0", !u.active && "opacity-60")}
                    >
                      <TableCell className="py-2.5 pl-4">
                        <div className="flex items-center gap-3">
                          <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                            {initials(u.fullName)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {u.fullName}
                              {u.id === currentUserId && <span className="text-muted-foreground ml-1.5 text-xs font-normal">(you)</span>}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">{u.email}</span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <RolePill role={u.role} />
                          {u.technician && <span className="bg-muted rounded px-1.5 py-px font-mono text-[10px] font-semibold">{u.technician.teamCode}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.branchName ?? "—"}</TableCell>
                      <TableCell>
                        <StatusDot active={u.active} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm" title={u.lastSignInAt ?? undefined} suppressHydrationWarning>
                        {u.lastSignInAt ? formatRelative(u.lastSignInAt) : "Never"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular">{formatDate(u.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground size-8 p-0" title="Reset password" onClick={() => setResetting(u)} aria-label={`Reset password for ${u.fullName}`}>
                            <KeyRound />
                          </Button>
                          <Button variant="outline" size="sm" className="h-8" onClick={() => setEditing({ mode: "edit", user: u })}>
                            <Pencil /> Edit
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="space-y-2.5 md:hidden">
              {rows.map((u, i) => (
                <motion.li
                  key={u.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 10) * 0.03 }}
                  className={cn("bg-card overflow-hidden rounded-xl border shadow-xs", !u.active && "opacity-60")}
                >
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: "edit", user: u })}
                    className="active:bg-muted/50 flex w-full items-center gap-3 p-4 text-left transition-colors"
                  >
                    <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                      {initials(u.fullName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {u.fullName}
                        {u.id === currentUserId && <span className="text-muted-foreground ml-1.5 text-xs font-normal">(you)</span>}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">{u.email}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <RolePill role={u.role} />
                        {u.technician && <span className="bg-muted rounded px-1.5 py-px font-mono text-[10px] font-semibold">{u.technician.teamCode}</span>}
                        <StatusDot active={u.active} />
                      </span>
                    </span>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  </button>
                  <div className="text-muted-foreground flex items-center justify-between gap-2 border-t px-4 py-2 text-[11px]">
                    <span className="truncate">{u.branchName ?? "No branch"}</span>
                    <span className="shrink-0" suppressHydrationWarning>
                      {u.lastSignInAt ? `Signed in ${formatRelative(u.lastSignInAt)}` : "Never signed in"}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          </>
        )}
        <p className="text-muted-foreground text-xs" aria-live="polite">
          Showing {rows.length} of {users.length} users
        </p>
      </TabsContent>

      <TabsContent value="roles">
        <RolesMatrix counts={counts} />
      </TabsContent>

      <UserSheet
        editing={editing}
        onClose={() => setEditing(null)}
        branches={branches}
        unlinkedTechnicians={unlinkedTechnicians}
        currentUserId={currentUserId}
        activeAdmins={activeAdmins}
        onResetPassword={(u) => setResetting(u)}
      />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
    </Tabs>
  );
}

// ------------------------------------------------------------- roles tab --

function RolesMatrix({ counts }: { counts: Record<AppRole, number> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <RolePill role={r} />
              <span className="text-muted-foreground text-xs tabular">
                {counts[r]} active user{counts[r] === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-3 text-sm">{ROLE_INFO[r].summary}</p>
            <dl className="text-muted-foreground mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt>Signs in to</dt>
              <dd className="text-foreground font-mono">{ROLE_INFO[r].portal}</dd>
              <dt>Data scope</dt>
              <dd className="text-foreground">{ROLE_INFO[r].scope}</dd>
            </dl>
          </div>
        ))}
      </div>

      <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-muted-foreground pl-4 text-xs">Permission</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className="text-muted-foreground w-20 text-center text-xs sm:w-32">
                  {ROLE_INFO[r].label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {CAPABILITIES.map((c) => (
              <TableRow key={c.label}>
                <TableCell className="min-w-36 pl-4 text-sm whitespace-normal">{c.label}</TableCell>
                {ROLES.map((r) => (
                  <TableCell key={r} className="text-center">
                    {c.roles.includes(r) ? (
                      <Check className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" aria-label="Allowed" />
                    ) : (
                      <Minus className="text-muted-foreground/40 mx-auto size-4" aria-label="Not allowed" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <Lock className="mt-px size-3.5 shrink-0" />
        Enforced on the server for every page and action, and again in the database by row-level security, so a role
        can never reach another portal or another technician&apos;s jobs.
      </p>
    </div>
  );
}

// ------------------------------------------------------- create / edit sheet --

type SheetValues = CreateUserValues & { active: boolean };

const EMPTY: SheetValues = {
  fullName: "",
  email: "",
  role: "technician",
  branchId: "",
  phone: "",
  teamCode: "",
  skills: "",
  technicianId: "",
  password: "",
  confirmPassword: "",
  active: true,
};

function UserSheet({
  editing,
  onClose,
  branches,
  unlinkedTechnicians,
  currentUserId,
  activeAdmins,
  onResetPassword,
}: {
  editing: Editing;
  onClose: () => void;
  branches: Branch[];
  unlinkedTechnicians: UnlinkedTechnician[];
  currentUserId: string;
  activeAdmins: number;
  onResetPassword: (u: UserRow) => void;
}) {
  const ids = useId();
  const user = editing?.mode === "edit" ? editing.user : null;
  const isCreate = editing?.mode === "create";

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SheetValues>({
    // Create validates the full schema (password included); edit validates the profile fields only.
    resolver: async (values, ctx, opts) => {
      const result = isCreate
        ? await zodResolver(createUserSchema)(values, ctx, opts as never)
        : await zodResolver(updateUserSchema)({ ...values, id: user?.id ?? "" }, ctx, opts as never);
      if (Object.keys(result.errors).length > 0) return { values: {}, errors: result.errors as FieldErrors<SheetValues> };
      return { values: { ...values, ...(result.values as Partial<SheetValues>) }, errors: {} };
    },
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!editing) return;
    reset(
      user
        ? {
            ...EMPTY,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            branchId: user.branchId ? String(user.branchId) : "",
            phone: user.phone,
            teamCode: user.technician?.teamCode ?? "",
            skills: user.technician?.skills.join(", ") ?? "",
            active: user.active,
          }
        : EMPTY,
    );
  }, [editing, user, reset]);

  const role = useWatch({ control, name: "role" });
  const active = useWatch({ control, name: "active" });
  const technicianId = useWatch({ control, name: "technicianId" });
  const password = useWatch({ control, name: "password" }) ?? "";
  const linked = unlinkedTechnicians.find((t) => t.id === technicianId);

  // Same guardrails the server applies, shown before saving.
  const blocked = user
    ? checkUserChange({
        actorId: currentUserId,
        targetId: user.id,
        current: { role: user.role, active: user.active },
        next: { role, active },
        activeAdmins,
        openJobs: user.technician?.openJobs ?? 0,
      })
    : null;

  function linkTechnician(id: string) {
    setValue("technicianId", id);
    const t = unlinkedTechnicians.find((x) => x.id === id);
    if (t) {
      setValue("fullName", t.name);
      setValue("phone", t.phone);
      setValue("branchId", String(t.branchId));
      setValue("teamCode", t.teamCode);
      setValue("skills", t.skills.join(", "));
    }
  }

  const onSubmit = handleSubmit(async (v) => {
    const res = isCreate ? await createUserAction(v) : await updateUserAction({ ...v, id: user!.id });
    if (!res.ok) {
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (name in EMPTY) setError(name as keyof SheetValues, { message });
      }
      toast.error(isCreate ? "Couldn't create the user" : "Couldn't save", { description: res.error });
      return;
    }
    toast.success(isCreate ? `${v.fullName} can now sign in` : `${v.fullName} updated`, {
      description: isCreate ? `${ROLE_INFO[v.role].label} portal · ${v.email}` : undefined,
    });
    onClose();
  });

  const reveal = useState(false);

  return (
    <Sheet open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="flex h-full flex-col">
          <SheetHeader className="border-b p-5">
            <SheetTitle>{isCreate ? "New user" : `Edit ${user?.fullName ?? ""}`}</SheetTitle>
            <SheetDescription>
              {isCreate
                ? "The person signs in with this email and the password you set. Their role decides which portal opens."
                : user?.email}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <FormField label="Role" htmlFor={`${ids}-role`} required>
              <div id={`${ids}-role`} role="radiogroup" className="grid gap-2">
                {ROLES.map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      role === r && "border-primary bg-primary/5 ring-primary/20 ring-2",
                    )}
                  >
                    <input type="radio" value={r} {...register("role")} className="accent-primary mt-1" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {ROLE_INFO[r].label}
                        <span className="text-muted-foreground font-mono text-xs font-normal">{ROLE_INFO[r].portal}</span>
                      </span>
                      <span className="text-muted-foreground block text-xs">{ROLE_INFO[r].summary}</span>
                    </span>
                  </label>
                ))}
              </div>
            </FormField>

            {isCreate && role === "technician" && unlinkedTechnicians.length > 0 && (
              <FormField
                label="Technician record"
                htmlFor={`${ids}-tech`}
                error={errors.technicianId?.message}
                hint="Give an existing roster technician a login, or create a new one."
              >
                <NativeSelect id={`${ids}-tech`} value={technicianId} onChange={(e) => linkTechnician(e.target.value)}>
                  <option value="">Create a new technician</option>
                  {unlinkedTechnicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.teamCode}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" htmlFor={`${ids}-name`} required error={errors.fullName?.message} className="sm:col-span-2">
                <Input id={`${ids}-name`} autoComplete="off" aria-invalid={!!errors.fullName} {...register("fullName")} />
              </FormField>
              <FormField
                label="Work email"
                htmlFor={`${ids}-email`}
                required={isCreate}
                error={errors.email?.message}
                hint={isCreate ? "Used to sign in." : "The sign-in email can't be changed."}
                className="sm:col-span-2"
              >
                <Input
                  id={`${ids}-email`}
                  type="email"
                  autoComplete="off"
                  readOnly={!isCreate}
                  className={cn(!isCreate && "bg-muted/50")}
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </FormField>
              <FormField label="Branch" htmlFor={`${ids}-branch`} required error={errors.branchId?.message}>
                <NativeSelect id={`${ids}-branch`} aria-invalid={!!errors.branchId} {...register("branchId")}>
                  <option value="">Choose…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label="Phone" htmlFor={`${ids}-phone`} required={role === "technician"} error={errors.phone?.message}>
                <Input id={`${ids}-phone`} type="tel" placeholder="012-345 6789" aria-invalid={!!errors.phone} {...register("phone")} />
              </FormField>
              {role === "technician" && (
                <>
                  <FormField label="Team code" htmlFor={`${ids}-team`} required={!linked} error={errors.teamCode?.message} hint="e.g. SA-07">
                    <Input id={`${ids}-team`} className="uppercase" aria-invalid={!!errors.teamCode} {...register("teamCode")} />
                  </FormField>
                  <FormField label="Skills" htmlFor={`${ids}-skills`} hint="Comma separated">
                    <Input id={`${ids}-skills`} placeholder="Installation, Servicing" {...register("skills")} />
                  </FormField>
                </>
              )}
            </div>

            {isCreate ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Password"
                  htmlFor={`${ids}-pw`}
                  required
                  error={errors.password?.message}
                  hint={password ? <StrengthHint value={password} /> : `At least ${PASSWORD_MIN} characters, letters and a number.`}
                >
                  <PasswordInput id={`${ids}-pw`} reveal={reveal} invalid={!!errors.password} {...register("password")} />
                </FormField>
                <FormField label="Confirm password" htmlFor={`${ids}-pw2`} required error={errors.confirmPassword?.message}>
                  <PasswordInput id={`${ids}-pw2`} reveal={reveal} invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
                </FormField>
                <p className="text-muted-foreground text-xs sm:col-span-2">Share the password with the person directly. It is never stored in the audit log.</p>
              </div>
            ) : (
              user && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Account active</p>
                      <p className="text-muted-foreground text-xs">A deactivated user is signed out and can&apos;t sign in. Their history is kept.</p>
                    </div>
                    <Switch checked={active} onCheckedChange={(c) => setValue("active", c)} aria-label="Account active" />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t pt-3">
                    <div>
                      <p className="text-sm font-medium">Password</p>
                      <p className="text-muted-foreground text-xs">Set a new password for this user.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => onResetPassword(user)}>
                      <KeyRound /> Reset password
                    </Button>
                  </div>
                </div>
              )
            )}

            {blocked && (
              <p role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
                {blocked}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&>button]:h-11 [&>button]:flex-1 sm:[&>button]:h-8 sm:[&>button]:flex-none">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !!blocked}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : isCreate ? <UserPlus /> : <Check />}
              {isCreate ? "Create user" : "Save changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function StrengthHint({ value }: { value: string }) {
  const { score, label } = passwordStrength(value);
  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 w-6 rounded-full",
              i < score ? (score <= 1 ? "bg-red-500" : score === 2 ? "bg-amber-500" : "bg-emerald-500") : "bg-muted",
            )}
          />
        ))}
      </span>
      {label}
    </span>
  );
}

function PasswordInput({
  reveal: [shown, setShown],
  invalid,
  ...props
}: React.ComponentProps<"input"> & { reveal: [boolean, (v: boolean) => void]; invalid?: boolean }) {
  return (
    <div className="relative">
      <Input type={shown ? "text" : "password"} autoComplete="new-password" className="pr-9" aria-invalid={invalid} {...props} />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------- reset password --

function ResetPasswordDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const ids = useId();
  const reveal = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { id: "", password: "", confirmPassword: "" },
  });
  const password = useWatch({ control, name: "password" }) ?? "";

  useEffect(() => {
    if (user) reset({ id: user.id, password: "", confirmPassword: "" });
  }, [user, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const res = await resetPasswordAction(v);
    if (!res.ok) {
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (name === "password" || name === "confirmPassword") setError(name, { message });
      }
      toast.error("Couldn't reset the password", { description: res.error });
      return;
    }
    toast.success(`Password reset for ${user?.fullName}`, { description: "Share the new password with them directly." });
    onClose();
  });

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {user?.fullName} ({user?.email}). Their current password stops working at once.
            </DialogDescription>
          </DialogHeader>
          <FormField
            label="New password"
            htmlFor={`${ids}-pw`}
            required
            error={errors.password?.message}
            hint={password ? <StrengthHint value={password} /> : `At least ${PASSWORD_MIN} characters, letters and a number.`}
          >
            <PasswordInput id={`${ids}-pw`} reveal={reveal} invalid={!!errors.password} {...register("password")} />
          </FormField>
          <FormField label="Confirm new password" htmlFor={`${ids}-pw2`} required error={errors.confirmPassword?.message}>
            <PasswordInput id={`${ids}-pw2`} reveal={reveal} invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
          </FormField>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
