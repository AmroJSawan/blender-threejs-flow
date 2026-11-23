import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

// Reload the page whenever Blender writes a new .glb into public/.
function reloadOnExport(): Plugin {
  return {
    name: 'reload-on-blender-export',
    configureServer(server) {
      const reload = (file: string) => {
        if (file.endsWith('.glb')) server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', reload)
      server.watcher.on('change', reload)
    },
  }
}

// Dev only: the page can POST a canvas recording here; it is saved under recordings/.
function saveRecordings(): Plugin {
  return {
    name: 'save-recordings',
    configureServer(server) {
      server.middlewares.use('/__recording', (req, res) => {
        const name = (new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'recording').replace(/[^\w-]/g, '')
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          mkdirSync('recordings', { recursive: true })
          writeFileSync(`recordings/${name}.webm`, Buffer.concat(chunks))
          res.end('saved')
        })
      })
    },
  }
}

export default defineConfig({
  base: './', // relative asset paths: the built site works at any URL
  plugins: [reloadOnExport(), saveRecordings()],
  server: { port: 5173 },
  // The lab index (index.html) and one page per study.
  build: { rollupOptions: { input: ['index.html', 'styles.html', 'glass.html', 'glow.html', 'materials.html', 'switch.html', 'switch3d.html', 'switch-css.html', 'expressions.html', 'illustrations.html', 'tactile.html', 'car.html'] } },
})
