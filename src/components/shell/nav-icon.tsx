import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  History,
  LayoutDashboard,
  MessageCircle,
  ScrollText,
  ShieldAlert,
  Sparkles,
  UserCog,
  Users,
  Wrench,
  Circle,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  History,
  LayoutDashboard,
  MessageCircle,
  ScrollText,
  ShieldAlert,
  Sparkles,
  UserCog,
  Users,
  Wrench,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Circle;
  return <Icon className={className} />;
}
