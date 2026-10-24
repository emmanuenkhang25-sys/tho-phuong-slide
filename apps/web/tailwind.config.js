/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bảng xanh dương trầm — phù hợp không khí Hội thánh, đủ tương phản cả 2 mode
        church: {
          50: '#eef4ff',
          100: '#dbe7fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#608dfa',
          500: '#3b63f6',
          600: '#2546eb',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#1e2f66',
          950: '#172051',
        },
        gold: {
          400: '#d9a441',
          500: '#c08c2e',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
        ],
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};
