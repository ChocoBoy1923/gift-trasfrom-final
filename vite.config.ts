import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

function copyStandaloneHtml(): Plugin {
  return {
    name: 'copy-standalone-html',
    apply: 'build',
    closeBundle() {
      copyFileSync(
        resolve(import.meta.dirname, 'dist/app.html'),
        resolve(import.meta.dirname, 'dist/index.html'),
      )
      copyFileSync(resolve(import.meta.dirname, 'dist/app.html'), resolve(import.meta.dirname, 'index.html'))
      copyFileSync(
        resolve(import.meta.dirname, 'dist/app.html'),
        resolve(import.meta.dirname, 'GIF생성기.html'),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: resolve(import.meta.dirname, 'app.html') } },
  plugins: [react(), viteSingleFile(), copyStandaloneHtml()],
})
