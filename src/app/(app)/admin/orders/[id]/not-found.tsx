import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function OrderNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Order not found"
      description="It may have been removed, or the link is incorrect."
      action={
        <Link href="/admin/orders" className={buttonVariants({ variant: "outline" })}>
          Back to orders
        </Link>
      }
      className="mt-10"
    />
  );
}
