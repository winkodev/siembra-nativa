/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      // Las server actions aceptan 1 MB por defecto: una foto de comprobante o
      // un certificado desde el celular pesa más y la subida fallaba en silencio
      bodySizeLimit: '15mb',
    },
  },
};

module.exports = nextConfig;
