import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import './globals.css'

// Heebo is designed for Hebrew-first interfaces
const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-heebo',
})

export const metadata: Metadata = {
  title: 'מפת התרעות דינאמית — ויזואליזציה של התרעות ציבוריות',
  description:
    'ויזואליזציה בזמן אמת של אירועי התרעה ציבוריים. אזורים משוערים מבוססים על נתונים ציבוריים בלבד ואינם הערכת איום רשמית.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-heebo bg-gray-50 text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}
