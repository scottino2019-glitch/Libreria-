import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

// Automatic PDF scanner and catalog.json generator
function syncBookCatalog() {
  try {
    const booksDir = path.join(process.cwd(), 'public', 'books');
    if (!fs.existsSync(booksDir)) {
      fs.mkdirSync(booksDir, { recursive: true });
    }
    const catalogPath = path.join(booksDir, 'catalog.json');
    let existingCatalog: any[] = [];
    if (fs.existsSync(catalogPath)) {
      try {
        existingCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      } catch (e) {
        console.error('Error reading catalog.json, rebuilding:', e);
      }
    }

    const files = fs.readdirSync(booksDir);
    const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    const knownDefaults: Record<string, { title: string; author: string; category: string }> = {
      'favole_da_vinci.pdf': { title: 'Favole Scelte', author: 'Leonardo da Vinci', category: 'Classici' },
      'inferno_canto1.pdf': { title: 'Inferno - Canto I', author: 'Dante Alighieri', category: 'Poesia' },
      'pinocchio_cap1.pdf': { title: 'Pinocchio - Cap I', author: 'Carlo Collodi', category: 'Fiabe' },
      'canti_leopardi.pdf': { title: 'Canti', author: 'Giacomo Leopardi', category: 'Poesia' },
    };

    const updatedCatalog: any[] = [];

    pdfs.forEach(file => {
      const url = `/books/${file}`;
      const stats = fs.statSync(path.join(booksDir, file));
      const fileSize = stats.size;
      const baseId = file.replace(/\.[^/.]+$/, ""); // strip extension

      // 1. Check if we already have it in existingCatalog
      const existing = existingCatalog.find(item => item.url === url || item.id === `public-${baseId}` || item.id === baseId);

      if (existing) {
        // Keep existing metadata but update current size
        updatedCatalog.push({
          ...existing,
          fileSize
        });
      } else {
        // 2. Map known defaults or generate dynamic title/author
        const known = knownDefaults[file] || knownDefaults[file.toLowerCase()];
        if (known) {
          updatedCatalog.push({
            id: `public-${baseId}`,
            title: known.title,
            author: known.author,
            category: known.category || 'Generale',
            url,
            addedAt: stats.birthtimeMs || Date.now(),
            totalPages: 4, // client reads real pages dynamically on open
            fileSize
          });
        } else {
          // Dynamic title/author formatting from filename
          const nameWithoutExt = baseId.replace(/[-_]/g, ' ');
          const prettyTitle = nameWithoutExt.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          updatedCatalog.push({
            id: baseId,
            title: prettyTitle,
            author: 'Autore Sconosciuto',
            category: 'Generale',
            url,
            addedAt: stats.birthtimeMs || Date.now(),
            totalPages: 10,
            fileSize
          });
        }
      }
    });

    // Write back catalog
    fs.writeFileSync(catalogPath, JSON.stringify(updatedCatalog, null, 2), 'utf8');
    console.log(`[Catalog Generator] Synced ${updatedCatalog.length} books automatically in public/books/catalog.json!`);
  } catch (err) {
    console.error('Failed to run book sync plugin:', err);
  }
}

// Execute sync immediately on startup
syncBookCatalog();

// Custom Vite plugin to sync on build starts and intercept in dev server
const catalogPlugin = () => ({
  name: 'generate-book-catalog',
  buildStart() {
    syncBookCatalog();
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      // Decode URL to avoid issues with search parameters (e.g., hash, timestamps)
      const decodedUrl = req.url ? decodeURIComponent(req.url) : '';
      if (decodedUrl === '/books/catalog.json' || decodedUrl.startsWith('/books/catalog.json?')) {
        try {
          syncBookCatalog();
          const booksDir = path.join(process.cwd(), 'public', 'books');
          const catalogPath = path.join(booksDir, 'catalog.json');
          if (fs.existsSync(catalogPath)) {
            const data = fs.readFileSync(catalogPath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.end(data);
            return;
          }
        } catch (err) {
          console.error('Error serving dynamic catalog.json:', err);
        }
      }
      next();
    });
  }
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), catalogPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    }
  };
});
