import { defineConfig } from 'vite';

// Construction pour Pixolud : le resultat de `vite build` est copie dans
// public/jeux/front-urbain/ du site. `base: './'` rend tous les chemins
// relatifs (le jeu est servi sous /jeux/front-urbain/), et pas de sourcemap
// pour garder le dossier leger.
export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: { host: '127.0.0.1' },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 4096 },
  // Large binary game assets served verbatim.
  assetsInclude: ['**/*.ktx2', '**/*.hdr', '**/*.exr', '**/*.bin', '**/*.glb'],
});
