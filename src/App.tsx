import React, { useState, useEffect } from 'react';
import { LibraryView } from './Library';
import { ReaderView } from './Reader';
import { db, type Book } from './db';
import { AnimatePresence } from 'motion/react';

export default function App() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Sync with physical folder static catalog dynamically
  useEffect(() => {
    async function syncCatalog() {
      try {
        const response = await fetch(`/books/catalog.json?t=${Date.now()}`);
        if (!response.ok) {
          throw new Error(`File catalog.json non trovato: ${response.status}`);
        }
        const list: Book[] = await response.json();
        
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

        // Delete local books that are static (served from server) but are no longer in the static catalog or were deleted by user
        const serverIds = new Set(filteredList.map(b => b.id));
        const idsToDelete = localBooks
          .filter(b => {
            // A book is static/server-side if its ID starts with 'public-' or if it has a server url
            const isStaticBook = b.id.startsWith('public-') || (b.url && b.url.startsWith('/books/'));
            if (isStaticBook) {
              return !serverIds.has(b.id) || deletedSet.has(b.id);
            }
            // User-uploaded books (which aren't static server books) are preserved safely
            return false;
          })
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

