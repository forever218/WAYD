/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  distDir: 'out',
  // 禁用服务器端渲染，以避免在服务器端使用 Tauri API
  experimental: {
    esmExternals: false
  }
}

module.exports = nextConfig
