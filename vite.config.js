import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const plugins = [react()]
  if (command === 'serve') {
    plugins.push(basicSsl())
  }

  return {
    plugins,
    base: './',
    server: {
      host: true,
      https: true,
      proxy: {
        '/kinita': 'http://127.0.0.1',
      }
    },
    resolve: {
      alias: {
        'node-fetch': 'isomorphic-fetch',
      },
    }
  }
})
