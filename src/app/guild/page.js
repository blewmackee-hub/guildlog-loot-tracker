import { redirect } from "next/navigation";
import { auth } from "@/auth";
import GuildChooser from "@/components/GuildChooser";

export default async function GuildPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="app">
      <GuildChooser discordName={session.user.name} />
    </div>
  );
}
