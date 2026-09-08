import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveCharacter } from "@/lib/guildSession";
import App from "@/components/App";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const active = await getActiveCharacter();
  if (!active) redirect("/guild");

  return <App />;
}
