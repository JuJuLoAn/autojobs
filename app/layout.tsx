import './globals.css';

export const metadata = {
  title: 'AutoJobs',
  description: 'Asistente móvil para encontrar y revisar ofertas de InfoJobs',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'AutoJobs',
    statusBarStyle: 'default' as const,
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport = {
  themeColor: '#1473e6',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="es"><body>{children}</body></html>;
}
