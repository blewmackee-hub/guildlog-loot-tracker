import "./globals.css";

export const metadata = {
  title: "GuildLog",
  description: "Throne and Liberty gear planner - database, build, wishlist, farm plan, and inheritance cost calculator.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
