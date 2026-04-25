import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    nodePolyfills({ include: ['buffer', 'process', 'stream', 'events', 'util'] }),
  ],
  optimizeDeps: {
    include: ['hypercore', 'random-access-memory', 'b4a'],
    esbuildOptions: { target: 'es2020' },
  },
  build: { target: 'es2020' },
})
