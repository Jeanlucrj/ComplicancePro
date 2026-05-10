/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Exclui do bundle webpack — resolvidos pelo Node.js nativo no servidor
    serverComponentsExternalPackages: [
      'cheerio',
      'undici',
      'playwright',
      'playwright-core',
      '@sparticuz/chromium',
      'xlsx',
      'csv-parse',
      'csv-parser',
      'iconv-lite',
    ],
  },
};

export default nextConfig;
