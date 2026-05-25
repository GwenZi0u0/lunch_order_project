/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kaizen: {
          orange: "#EA5B3C",
          yellow: "#FFDB27",
          dark: "#333333",
          bg: "#F9F8F5",
          card: "#FFFFFF",
          border: "#EAE8E4",
          borderDark: "#D6D1CA",
          muted: "#888888",
        }
      },
      borderRadius: {
        xl: "40px",
        lg: "20px",
        md: "10px",
      }
    },
  },
  plugins: [],
}
