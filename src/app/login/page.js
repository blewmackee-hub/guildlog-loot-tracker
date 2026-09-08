import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/guild");

  async function loginWithDiscord() {
    "use server";
    await signIn("discord", { redirectTo: "/guild" });
  }

  return (
    <div className="app">
      <div className="auth-screen">
        <div className="auth-card">
          <h1>GuildLog</h1>
          <p className="muted">Sign in with Discord to find or register your guild.</p>
          <form action={loginWithDiscord}>
            <button type="submit" className="btn-discord">Sign in with Discord</button>
          </form>
        </div>
      </div>
    </div>
  );
}
