import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Redirect rather than a visible 403 - no reason to confirm to a
  // non-admin that this route exists at all.
  if (!isAdmin(session.user.discordId)) redirect("/guild");

  return (
    <div className="app">
      <AdminPanel />
    </div>
  );
}
