/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.html",
    "./src/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        bc: {
          primary: '#0078d4',
          primaryHover: '#106ebe',
          primaryLight: '#c7e0f4',
          secondary: '#6c757d',
          success: '#107c10',
          warning: '#ffb900',
          danger: '#d13438',
          background: '#f3f2f1',
          border: '#d1d1d1'
        }
      }
    }
  },
  plugins: [],
}
