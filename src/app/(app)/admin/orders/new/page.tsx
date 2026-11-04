import { requireUser } from "@/lib/auth";
import { getServiceTypes, getTechniciansWithLoad } from "@/lib/data/reference";
import { PageHeader } from "@/components/shared/page-header";
import { OrderForm } from "@/components/admin/order-form";
import { currentOrderPrefix } from "@/components/admin/datetime";
import { peekNextOrderNo } from "../../actions";

export const metadata = { title: "New order · Sejuk Ops" };

export default async function NewOrderPage() {
  await requireUser(["admin"]);
  const [serviceTypes, technicians, nextOrderNo] = await Promise.all([getServiceTypes(), getTechniciansWithLoad(), peekNextOrderNo()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 1 · Order submission"
        title="New service order"
        description="Capture the customer request, quote it and dispatch a technician. The order number is assigned automatically."
      />
      <OrderForm serviceTypes={serviceTypes} technicians={technicians} initialOrderNo={nextOrderNo} orderNoPrefix={currentOrderPrefix()} />
    </div>
  );
}
