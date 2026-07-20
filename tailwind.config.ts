import type { Config } from "tailwindcss";

/** rgb var helper con soporte de opacidad de Tailwind. */
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens semánticos (cambian con el tema, ver globals.css)
        canvas: v("--canvas"), // fondo de página
        panel: v("--panel"), // inputs, header, nav
        card: v("--card"), // tarjetas
        raised: v("--raised"), // hover / superficies elevadas
        raised2: v("--raised2"), // botones secundarios, chips de ícono, bordes
        raised3: v("--raised3"), // borde/superficie más clara
        ink: v("--ink"), // texto principal
        onaccent: v("--onaccent"), // texto sobre acento (siempre oscuro)

        accent: {
          DEFAULT: v("--accent"),
          hover: v("--accent-hover"),
          soft: "#0b3d31",
        },

        // Paleta oscura fija — usada por la tarjeta de saldo (siempre oscura)
        base: {
          950: "#0a0b0f",
          900: "#101218",
          850: "#161923",
          800: "#1c2030",
          700: "#272c3f",
          600: "#3a4056",
        },
        violet: {
          DEFAULT: "#8b5cf6",
          soft: "#241a45",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 30px -12px rgba(0,0,0,0.25)",
        glow: "0 0 24px -4px rgba(0,229,160,0.35)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "70%": { transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "pop-in": "pop-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
