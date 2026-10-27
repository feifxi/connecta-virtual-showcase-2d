import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { Providers } from '@/components/providers';
import { jakarta, notoThai } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Connecta · A little closer, wherever you are', template: '%s · Connecta' },
  description: 'Walk between booths in an online hall and talk live with the people who made the work.',
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/assets/images/favicon.svg` },
};

export const viewport: Viewport = { themeColor: '#f6f7fb', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${notoThai.variable}`}>
      <body>
        <a href="#main" className="fixed -top-20 left-5 z-[100] rounded-control bg-white px-5 py-3 focus:top-3">
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <Toaster position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
