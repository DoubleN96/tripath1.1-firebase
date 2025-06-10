
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Toaster } from "@/components/ui/toaster"
import LeafletClientSetup from '@/components/LeafletClientSetup'; // Import the new component

// Removed direct import of 'leaflet/dist/leaflet.css';
// Removed direct import of 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
// Removed direct import of 'leaflet-defaulticon-compatibility'; (JS part)

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ChattyRental - Alquiler de Habitaciones',
  description: 'Encuentra tu próxima habitación o estudio en ChattyRental.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
        suppressHydrationWarning={true}
      >
        <LeafletClientSetup /> {/* Add the setup component here */}
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
