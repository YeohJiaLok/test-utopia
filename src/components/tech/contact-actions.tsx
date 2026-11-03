import { Navigation, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/orders/whatsapp-button";
import { mapsLink, telLink, wazeLink, whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

function WazeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={cn("size-4", className)} aria-hidden>
      <path d="M20.5 10.2c0-4.3-3.8-7.7-8.5-7.7S3.5 5.9 3.5 10.2c0 1.5-.4 2.7-1.4 3.5.9 1.6 2.6 2.7 4.4 3" />
      <path d="M9.2 17.4c1.9.5 3.9.5 5.7 0 3.3-1 5.6-3.9 5.6-7.2" />
      <circle cx="8" cy="19.2" r="1.8" />
      <circle cx="16.4" cy="19.2" r="1.8" />
      <circle cx="9.6" cy="9.4" r=".6" fill="currentColor" />
      <circle cx="14.6" cy="9.4" r=".6" fill="currentColor" />
      <path d="M9.4 12.4c1.4 1.2 3.6 1.2 5 0" />
    </svg>
  );
}

const linkBase =
  "flex min-h-12 items-center justify-center gap-2 text-sm font-medium transition-colors active:scale-[0.98] select-none";

/** One-tap Call / Waze / Google Maps row for job cards. */
export function JobQuickActions({ phone, address }: { phone: string; address: string }) {
  return (
    <div className="grid grid-cols-3 divide-x border-t">
      <a href={telLink(phone)} className={cn(linkBase, "text-primary hover:bg-primary/5")}>
        <Phone className="size-4" /> Call
      </a>
      <a href={wazeLink(address)} target="_blank" rel="noopener noreferrer" className={cn(linkBase, "hover:bg-muted")}>
        <WazeIcon /> Waze
      </a>
      <a href={mapsLink(address)} target="_blank" rel="noopener noreferrer" className={cn(linkBase, "hover:bg-muted")}>
        <Navigation className="size-4" /> Maps
      </a>
    </div>
  );
}

/** 2×2 grid of customer contact + navigation actions on the job detail screen. */
export function CustomerActions({
  phone,
  address,
  whatsappMessage,
}: {
  phone: string;
  address: string;
  whatsappMessage: string;
}) {
  const tile = cn(linkBase, "rounded-xl border bg-background hover:bg-muted");
  return (
    <div className="grid grid-cols-2 gap-2">
      <a href={telLink(phone)} className={cn(tile, "border-primary/25 bg-primary/5 text-primary hover:bg-primary/10")}>
        <Phone className="size-4" /> Call
      </a>
      <a
        href={whatsappLink(phone, whatsappMessage)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(tile, "border-[#25D366]/30 bg-[#25D366]/8 text-[#128C4B] hover:bg-[#25D366]/15 dark:text-[#5BE38F]")}
      >
        <WhatsAppIcon /> WhatsApp
      </a>
      <a href={wazeLink(address)} target="_blank" rel="noopener noreferrer" className={tile}>
        <WazeIcon /> Waze
      </a>
      <a href={mapsLink(address)} target="_blank" rel="noopener noreferrer" className={tile}>
        <Navigation className="size-4" /> Google Maps
      </a>
    </div>
  );
}
