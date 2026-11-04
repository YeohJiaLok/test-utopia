import { redirect } from "next/navigation";
import { requireUser, ROLE_HOME } from "@/lib/auth";

export default async function Home() {
  // requireUser sends signed-out users to /login and 2FA users still owing a code to /login/verify.
  const user = await requireUser();
  redirect(ROLE_HOME[user.role]);
}
