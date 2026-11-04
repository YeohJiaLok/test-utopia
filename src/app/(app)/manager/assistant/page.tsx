import { redirect } from "next/navigation";

// The Ops Copilot lives in the floating "Sejuk Ops AI" assistant on every office page
// (components/ai/copilot-drawer.tsx); this old address now just opens the dashboard.
export default function AssistantPage() {
  redirect("/manager");
}
