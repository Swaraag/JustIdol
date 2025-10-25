module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'karaoke-bg': '#0f0f23',
        'karaoke-card': '#1a1a2e',
        'karaoke-accent': '#16213e',
        'karaoke-primary': '#e94560',
        'karaoke-secondary': '#0f3460',
        'karaoke-success': '#00d4aa',
        'karaoke-warning': '#ffd700',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
}