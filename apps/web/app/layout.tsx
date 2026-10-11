export const metadata = {
  title: "ELEGANZ",
  description: "ELEGANZ Gestion & Marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
