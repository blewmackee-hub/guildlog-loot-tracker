import "./globals.css";
import PanelTilt from "@/components/PanelTilt";

export const metadata = {
  title: "GuildLog",
  description: "Throne and Liberty gear planner - database, build, wishlist, farm plan, and inheritance cost calculator.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PanelTilt />
        {children}
      </body>
    </html>
  );
}
