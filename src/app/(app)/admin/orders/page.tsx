import Link from "next/link";
import { FilePlus2, SearchX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBranches, getTechniciansWithLoad } from "@/lib/data/reference";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { OrdersToolbar } from "@/components/admin/orders-toolbar";
import { OrdersTable } from "@/components/admin/orders-table";
import { OrdersBoard } from "@/components/admin/orders-board";
import { OrdersPagination } from "@/components/admin/pagination";
import { ordersHref, parseOrderFilters } from "@/components/admin/orders-url";
import { cn } from "@/lib/utils";
import { PAGE_SIZE, getOrderBoard, getOrderList } from "../_lib/queries";

export const metadata = { title: "Orders · Sejuk Ops" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(["admin"]);
  const filters = parseOrderFilters(await searchParams);

  const [technicians, branches] = await Promise.all([getTechniciansWithLoad(), getBranches()]);
  const techOptions = technicians.map((t) => ({ id: t.id, label: `${t.name} · ${t.team_code}` }));
  const branchOptions = branches.map((b) => ({ id: String(b.id), label: b.name }));
  const hasFilters = !!(filters.q || filters.tech || filters.branch || filters.status !== "all");

  const header = (
    <PageHeader
      eyebrow="Orders"
      title="All service orders"
      description="Search, filter and dispatch every job across branches. Status changes only happen through workflow actions."
      actions={
        <Link href="/admin/orders/new" className={cn(buttonVariants(), "shadow-brand/25 hidden h-9 shadow-md sm:inline-flex")}>
          <FilePlus2 /> New order
        </Link>
      }
    />
  );

  // Thumb-reachable primary action on phones (the header button takes over from `sm` up).
  const fab = (
    <Link
      href="/admin/orders/new"
      className={cn(
        buttonVariants(),
        "bg-gradient-brand shadow-brand/30 fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 h-12 rounded-full px-5 text-sm shadow-lg sm:hidden",
      )}
    >
      <FilePlus2 /> New order
    </Link>
  );

  if (filters.view === "board") {
    const board = await getOrderBoard(filters);
    return (
      <div className="space-y-5 pb-16 sm:pb-0">
        {header}
        <OrdersToolbar filters={filters} counts={board.counts} technicians={techOptions} branches={branchOptions} />
        <OrdersBoard columns={board.columns} counts={board.counts} filters={filters} />
        {fab}
      </div>
    );
  }

  const list = await getOrderList(filters);

  return (
    <div className="space-y-5 pb-16 sm:pb-0">
      {header}
      {fab}
      <OrdersToolbar filters={filters} counts={list.counts} technicians={techOptions} branches={branchOptions} />
      {list.error ? (
        <EmptyState icon={SearchX} title="Couldn't load orders" description={list.error} />
      ) : list.orders.length ? (
        <>
          <OrdersTable orders={list.orders} />
          <OrdersPagination filters={filters} total={list.total} pageSize={PAGE_SIZE} />
        </>
      ) : (
        <EmptyState
          icon={SearchX}
          title={hasFilters ? "No orders match these filters" : "No orders yet"}
          description={
            hasFilters
              ? "Try a different status, clear the search, or widen the technician / branch filter."
              : "Create the first service order to start dispatching technicians."
          }
          action={
            hasFilters ? (
              <Link href={ordersHref(filters, { q: "", tech: "", branch: "", status: "all" })} className={buttonVariants({ variant: "outline" })}>
                Clear filters
              </Link>
            ) : (
              <Link href="/admin/orders/new" className={buttonVariants()}>
                <FilePlus2 /> New order
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
