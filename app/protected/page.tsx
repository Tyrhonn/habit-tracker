import { redirect } from "next/navigation";

import { HabitDashboard } from "@/components/habit-dashboard";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ProtectedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return <HabitDashboard userEmail={user.email ?? "Tài khoản của tôi"} />;
}
