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
        primary: 'hsl(var(--primary) / <alpha-value>)',
        'primary-hover': 'hsl(var(--primary-hover) / <alpha-value>)',
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
        neon: '0 0 8px hsl(var(--primary) / 0.3)',
        'neon-lg': '0 0 16px hsl(var(--primary) / 0.4)',
      },
    },
  },
  plugins: [],
} satisfies Config