import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devPort = Number(env.VITE_DEV_PORT || 4000)
  const backendTarget = env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8080'

  return {
    plugins: [vue()],
    base: './',
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
    },
    server: {
      host: '0.0.0.0',
      port: Number.isFinite(devPort) ? devPort : 4000,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyRequest) => {
              // 浏览器请求与 Vite 同源，跨域只发生在开发代理内部。
              // 不把 localhost:4000 的 Origin 转发给只允许 5173 的后端，
              // 避免 Spring CORS 在请求进入 /auth/login 前返回 403。
              proxyRequest.removeHeader('origin')
            })
          }
        }
      }
    }
  }
})
