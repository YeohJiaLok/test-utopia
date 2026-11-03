import { redirect } from "next/navigation";
import { getSessionUser, ROLE_HOME } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? ROLE_HOME[user.role] : "/login");
}
