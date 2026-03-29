import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Lamastage.pl — ciemny, profesjonalny event
        background: '#080808',
        foreground: '#ffffff',
        surface: '#111111',
        'surface-2': '#1a1a1a',
        border: '#222222',
        primary: '#00ff88',      // Neonowa zieleń — TYLKO na aktywne elementy
        'primary-hover': '#00cc6a',
        muted: '#666666',
        'muted-foreground': '#8a8a8a',
        destructive: '#ff3333',
        warning: '#ffaa00',
        success: '#00cc88',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '2px',
        sm: '2px',
        md: '4px',
        lg: '4px',
        xl: '6px',
      },
      boxShadow: {
        'neon': '0 0 8px rgba(0,255,136,0.3)',
        'neon-lg': '0 0 16px rgba(0,255,136,0.4)',
      },
    },
  },
  plugins: [],
} satisfies Config