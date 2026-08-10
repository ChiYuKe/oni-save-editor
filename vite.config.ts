import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(() => {
  const visualFixture = process.env.ONI_VISUAL_FIXTURE
  return {
    base: process.env.PAGES_BASE_PATH ?? '/',
    plugins: [
      react(),
      {
        name: 'oni-local-visual-fixture',
        configureServer(server) {
          server.middlewares.use('/__oni_fixture__', async (_request, response) => {
            if (!visualFixture) {
              response.statusCode = 404
              response.end()
              return
            }
            try {
              const bytes = await readFile(visualFixture)
              response.setHeader('Content-Type', 'application/octet-stream')
              response.setHeader('X-Fixture-Name', encodeURIComponent(path.basename(visualFixture)))
              response.end(bytes)
            } catch {
              response.statusCode = 500
              response.end()
            }
          })
        },
      },
    ],
  }
})
