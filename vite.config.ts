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
          const assetDelay = Number(process.env.ONI_FIXTURE_ASSET_DELAY_MS) || 0
          const slowAsset = process.env.ONI_FIXTURE_SLOW_ASSET
          if (assetDelay > 0) server.middlewares.use((request, _response, next) => {
            if (request.url?.startsWith('/assets/') && (!slowAsset || request.url.includes(slowAsset))) setTimeout(next, assetDelay)
            else next()
          })
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
