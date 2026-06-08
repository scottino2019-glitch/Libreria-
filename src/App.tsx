import React, { useState, useEffect } from 'react';
import { LibraryView } from './Library';
import { ReaderView } from './Reader';
import { db, type Book } from './db';
import { AnimatePresence } from 'motion/react';

export default function App() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Sync with physical folder static catalog dynamically using Vite's glob import
  useEffect(() => {
    async function syncCatalog() {
      try {
        const globPattern = (import.meta as any).glob('/public/books/*.pdf');
        const filePaths = Object.keys(globPattern);

        const knownDefaults: Record<string, { id?: string; title: string; author: string; category: string; totalPages?: number }> = {
          'favole_da_vinci.pdf': { id: 'public-le-favole-da-vinci', title: 'Favole Scelte', author: 'Leonardo da Vinci', category: 'Classici', totalPages: 4 },
          'inferno_canto1.pdf': { id: 'public-inferno-canto1', title: 'Inferno - Canto I', author: 'Dante Alighieri', category: 'Poesia', totalPages: 4 },
          'pinocchio_cap1.pdf': { id: 'public-pinocchio-cap1', title: 'Pinocchio - Cap I', author: 'Carlo Collodi', category: 'Fiabe', totalPages: 3 },
          'canti_leopardi.pdf': { id: 'public-canti-leopardi', title: 'Canti', author: 'Giacomo Leopardi', category: 'Poesia', totalPages: 20 },
        };

        const list: Book[] = filePaths.map((filePath, index) => {
          const fileName = filePath.split('/').pop() || '';
          const baseName = fileName.replace(/\.[^/.]+$/, ""); // strip extension
          const url = `/books/${fileName}`;

          const known = knownDefaults[fileName] || knownDefaults[fileName.toLowerCase()];

          if (known) {
            return {
              id: known.id || `public-${baseName}`,
              title: known.title,
              author: known.author,
              category: known.category,
              url,
              addedAt: index + 1,
              totalPages: known.totalPages || 4,
              fileSize: 10 * 1024
            };
          } else {
            // Dynamic title/author formatting from filename
            const nameWithoutExt = baseName.replace(/[-_]/g, ' ');
            const prettyTitle = nameWithoutExt.split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            return {
              id: `public-${baseName}`,
              title: prettyTitle,
              author: 'Autore Sconosciuto',
              category: 'Generale',
              url,
              addedAt: Date.now() + index,
              totalPages: 10,
              fileSize: 10 * 1024
            };
          }
        });
        
        // Filter out user-deleted books (stored locally in localStorage)
        const deletedIds: string[] = JSON.parse(localStorage.getItem('deleted_book_ids') || '[]');
        const deletedSet = new Set(deletedIds);
        const filteredList = list.filter(b => !deletedSet.has(b.id));

        const localBooks = await db.books.toArray();
        const localMap = new Map(localBooks.map(b => [b.id, b]));
        
        const syncedBooks: Book[] = filteredList.map(serverBook => {
          const local = localMap.get(serverBook.id);
          return {
            ...serverBook,
            lastPage: local?.lastPage || serverBook.lastPage || 1,
            lastReadAt: local?.lastReadAt || serverBook.lastReadAt,
            file: local?.file // Keep local file offline cache if they toggled offline!
          };
        });

        // Delete local books that are static (no local .file Blob) but are no longer in the static catalog or were deleted by user
        const serverIds = new Set(filteredList.map(b => b.id));
        const idsToDelete = localBooks
          .filter(b => !b.file && (!serverIds.has(b.id) || deletedSet.has(b.id)))
          .map(b => b.id);

        if (idsToDelete.length > 0) {
          await db.books.bulkDelete(idsToDelete);
        }

        if (syncedBooks.length > 0) {
          await db.books.bulkPut(syncedBooks);
        }
        console.log('Catalog synchronized with static books directory successfully.');
      } catch (err) {
        console.error('Failed to sync catalog with static books folder:', err);
      }
    }
    syncCatalog();
  }, []);

  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
  };

  const handleCloseReader = () => {
    setSelectedBook(null);
  };

  return (
    <div className="relative min-h-screen">
      {/* Ancient library background - repeated wood and paper textures are handled in components */}
      <main className="relative z-10 box-border">
        <LibraryView onSelectBook={handleSelectBook} />
      </main>

      {/* Fullscreen Reader Overlay */}
      <AnimatePresence>
        {selectedBook && (
          <ReaderView 
            book={selectedBook} 
            onClose={handleCloseReader} 
          />
        )}
      </AnimatePresence>

      {/* Global CSS for vintage scrollbars */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: var(--color-wood-dark);
          border-left: 1px solid var(--color-brass);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--color-brass);
          border: 2px solid var(--color-wood-dark);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--color-brass-bright);
        }
      `}} />
    </div>
  );
}
