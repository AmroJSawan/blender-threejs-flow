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

export default defineConfig({
  plugins: [reloadOnExport()],
  server: { port: 5173 },
})
