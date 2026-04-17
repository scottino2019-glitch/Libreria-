import React, { useState } from 'react';
import { LibraryView } from './Library';
import { ReaderView } from './Reader';
import { type Book } from './db';
import { AnimatePresence } from 'motion/react';

export default function App() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

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
