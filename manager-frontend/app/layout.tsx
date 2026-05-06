import "./globals.css";

export const metadata = { title: "Auto Tech Analyst — Manager" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#020617] text-slate-200 antialiased">{children}</body>
    </html>
  );
}
