import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      // -------------------------------------------------------
      // PALETA SIEMBRA NATIVA CLUB
      // Modificar solo aquí para cambiar toda la identidad visual
      // -------------------------------------------------------
      colors: {
        // Colores base de marca
        club: {
          verde:   '#083D3A', // fondo principal - teal oscuro
          dorado:  '#F3A707', // acento principal - ámbar dorado
          'verde-claro': '#0d5c56',
          'verde-medio': '#0a4d49',
          'dorado-claro': '#f5b82e',
          'dorado-oscuro': '#d4920a',
        },

        // Sistema de colores semánticos (usa las variables CSS)
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border:  'hsl(var(--border))',
        input:   'hsl(var(--input))',
        ring:    'hsl(var(--ring))',

        // Estados de REPROCANN
        reprocann: {
          pendiente: '#F59E0B',
          aprobado:  '#10B981',
          rechazado: '#EF4444',
          vencido:   '#6B7280',
        },

        // Estados de pedidos
        pedido: {
          pendiente: '#F59E0B',
          aprobado:  '#3B82F6',
          entregado: '#10B981',
          cancelado: '#EF4444',
        },
      },

      // -------------------------------------------------------
      // TIPOGRAFÍA
      // Avigea: display/headings principales
      // Century Gothic (estirada): subtítulos y body
      // -------------------------------------------------------
      fontFamily: {
        avigea:          ['Avigea', 'Georgia', 'serif'],
        gothic:          ['CenturyGothicStretched', 'Century Gothic', 'Trebuchet MS', 'sans-serif'],
        sans:            ['CenturyGothicStretched', 'Century Gothic', 'Trebuchet MS', 'sans-serif'],
        mono:            ['JetBrains Mono', 'monospace'],
      },

      borderRadius: {
        lg:  'var(--radius)',
        md:  'calc(var(--radius) - 2px)',
        sm:  'calc(var(--radius) - 4px)',
      },

      // Sombras con color de marca para glassmorphism
      boxShadow: {
        'club-sm':   '0 1px 8px rgba(8, 61, 58, 0.4)',
        'club-md':   '0 4px 24px rgba(8, 61, 58, 0.5)',
        'club-lg':   '0 8px 48px rgba(8, 61, 58, 0.6)',
        'dorado-sm': '0 0 12px rgba(243, 167, 7, 0.25)',
        'dorado-md': '0 0 32px rgba(243, 167, 7, 0.35)',
        'glass':     '0 8px 32px rgba(0, 0, 0, 0.4)',
      },

      backgroundImage: {
        'gradient-club':     'linear-gradient(135deg, #083D3A 0%, #0a4d49 50%, #0d5c56 100%)',
        'gradient-dorado':   'linear-gradient(135deg, #d4920a 0%, #F3A707 50%, #f5b82e 100%)',
        'gradient-hero':     'radial-gradient(ellipse at top, #0d5c56 0%, #083D3A 60%, #041e1c 100%)',
        'noise':             "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-dorado': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(243, 167, 7, 0.4)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(243, 167, 7, 0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'accordion-down':  'accordion-down 0.2s ease-out',
        'accordion-up':    'accordion-up 0.2s ease-out',
        'shimmer':         'shimmer 2s linear infinite',
        'pulse-dorado':    'pulse-dorado 2s ease-in-out infinite',
        'float':           'float 3s ease-in-out infinite',
      },
    },
  },
  // typography habilita las clases `prose` (render de Markdown del newsletter)
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
};

export default config;
