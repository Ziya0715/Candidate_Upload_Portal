import './globals.scss';

export const metadata = {
  title: {
    default: 'Video Share',
    template: '%s · Video Share',
  },
  description: 'Staff dashboard for uploading and sharing private videos.',
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: '#169c50',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
