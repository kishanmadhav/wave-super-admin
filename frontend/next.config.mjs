import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
    resolveAlias: {
      tailwindcss: join(__dirname, 'node_modules/tailwindcss'),
      'tw-animate-css': join(__dirname, 'node_modules/tw-animate-css'),
    },
  },
}

export default nextConfig
