/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // La importación de alumnos sube la planilla por un server action; el
    // límite por defecto (1 MB) se queda corto si la lista trae logos pegados.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
