import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Branch, ServiceType, Technician } from "@/lib/types";

export async function getServiceTypes(): Promise<ServiceType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("service_types").select("*").eq("active", true).order("id");
  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, base_price: Number(s.base_price) }));
}

export async function getBranches(): Promise<Branch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("branches").select("id, code, name, state").order("id");
  if (error) throw error;
  return data ?? [];
}

export type TechnicianWithLoad = Technician & { branch_name: string; open_jobs: number };

/** Active technicians with their current open-job load (for assignment pickers). */
export async function getTechniciansWithLoad(): Promise<TechnicianWithLoad[]> {
  const supabase = await createClient();
  const [{ data: techs, error }, { data: open }] = await Promise.all([
    supabase.from("technicians").select("*, branch:branches(name)").eq("active", true).order("name"),
    supabase.from("orders").select("assigned_technician_id").in("status", ["assigned", "in_progress"]),
  ]);
  if (error) throw error;
  const load = new Map<string, number>();
  for (const o of open ?? []) {
    if (o.assigned_technician_id) load.set(o.assigned_technician_id, (load.get(o.assigned_technician_id) ?? 0) + 1);
  }
  return (techs ?? []).map(({ branch, ...t }) => ({
    ...t,
    branch_name: (branch as { name: string } | null)?.name ?? "",
    open_jobs: load.get(t.id) ?? 0,
  }));
}
