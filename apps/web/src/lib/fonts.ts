import localFont from 'next/font/local';

// Self-hosted (no network at build time on the VM) · font options must be literals for the compiler
export const jakarta = localFont({
  variable: '--font-jakarta',
  display: 'swap',
  src: [
    { path: '../assets/fonts/jakarta-400.ttf', weight: '400' },
    { path: '../assets/fonts/jakarta-500.ttf', weight: '500' },
    { path: '../assets/fonts/jakarta-600.ttf', weight: '600' },
    { path: '../assets/fonts/jakarta-700.ttf', weight: '700' },
    { path: '../assets/fonts/jakarta-800.ttf', weight: '800' },
  ],
});

export const notoThai = localFont({
  variable: '--font-thai',
  display: 'swap',
  src: [
    { path: '../assets/fonts/noto-thai-400.ttf', weight: '400' },
    { path: '../assets/fonts/noto-thai-500.ttf', weight: '500' },
    { path: '../assets/fonts/noto-thai-600.ttf', weight: '600' },
    { path: '../assets/fonts/noto-thai-700.ttf', weight: '700' },
  ],
});
