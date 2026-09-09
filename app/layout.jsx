import "./globals.css";
import Nav from "./nav";

export const metadata = {
  title: "Switchboard",
  description: "Job search console — crawl, score, tailor, track.",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e7ece9",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">{children}</div>
        <Nav />
      </body>
    </html>
  );
}
