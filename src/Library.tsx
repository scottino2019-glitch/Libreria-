import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Book as BookIcon, X, Upload, Loader2, Library as LibraryIcon, ChevronLeft, Menu, Trash2, Edit3 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Book } from './db';
import { getPdfMetadata, generateThumbnail } from './pdfUtils';
import { v4 as uuidv4 } from 'uuid';
import { cn } from './utils';

// --- Shared Components ---

const AntiqueButton = ({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "px-6 py-2 bg-gold text-white font-serif border-gold border hover:bg-gold/80 transition-all shadow-md active:translate-y-0.5 rounded-sm",
      className
    )}
    {...props}
  >
    {children}
  </button>
);

const AntiqueInput = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "px-6 py-2 bg-paper border-[#c9b08d] border focus:border-gold focus:outline-none placeholder:text-ink/40 font-serif shadow-inner italic",
      className
    )}
    {...props}
  />
);

// --- Layout Components ---

const WoodShelf = ({ children, title }: { children: React.ReactNode, title?: string }) => (
  <div className="mb-10">
    {title && (
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl text-ink font-display font-bold uppercase tracking-widest leading-none whitespace-nowrap">
          {title}
        </h2>
        <div className="h-[1px] bg-gold/30 flex-1" />
      </div>
    )}
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-10 gap-y-16">
      {children}
    </div>
  </div>
);

// --- Main Views ---

export const LibraryView = ({ onSelectBook }: { onSelectBook: (book: Book) => void }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024); // Responsive initial state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [bookCategory, setBookCategory] = useState('Generale');
  const [editForm, setEditForm] = useState({ title: '', author: '', category: '' });

  // Dynamic categories from database
  const allBooks = useLiveQuery(() => db.books.toArray());
  const categories = React.useMemo(() => {
    const cats = new Set(allBooks?.map(b => b.category).filter(Boolean) || []);
    return Array.from(cats).sort();
  }, [allBooks]);

  const books = useLiveQuery(() => {
    let query = db.books.orderBy('addedAt').reverse();
    if (selectedCategory) {
      return db.books.where('category').equals(selectedCategory).toArray();
    }
    if (searchQuery) {
      return db.books
        .filter(b => 
          b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          b.author.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .toArray();
    }
    return query.toArray();
  }, [searchQuery, selectedCategory]);

  const annotations = useLiveQuery(() => db.annotations.orderBy('createdAt').reverse().limit(1).toArray());
  const lastAnnotation = annotations?.[0];

  const handleDeleteBook = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation(); // Don't open the book
    if (window.confirm('Sei sicuro di voler eliminare questo volume dalla tua biblioteca? Le note associate verranno eliminate.')) {
      try {
        await db.books.delete(bookId);
        await db.annotations.where('bookId').equals(bookId).delete();
      } catch (err) {
        console.error('Errore durante l\'eliminazione del libro:', err);
      }
    }
  };

  const handleEditBook = (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    setEditingBook(book);
    setEditForm({ title: book.title, author: book.author, category: book.category || 'Generale' });
  };

  const saveEdit = async () => {
    if (!editingBook) return;
    try {
      await db.books.update(editingBook.id, {
        title: editForm.title,
        author: editForm.author,
        category: editForm.category
      });
      setEditingBook(null);
    } catch (err) {
      console.error('Errore durante l\'aggiornamento del libro:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus('processing');
      const meta = await getPdfMetadata(file);
      const thumb = await generateThumbnail(file);

      const newBook: Book = {
        id: uuidv4(),
        title: meta.title,
        author: meta.author,
        category: bookCategory,
        file: file,
        thumbnail: thumb,
        addedAt: Date.now(),
        totalPages: meta.totalPages
      };

      await db.books.add(newBook);
      setUploadStatus('idle');
      setIsUploading(false);
    } catch (error) {
      console.error(error);
      setUploadStatus('error');
    }
  };

  return (
    <div className="flex min-h-screen bg-paper overflow-hidden relative selection:bg-gold/30">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Scaffale */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-[260px] bg-paper-dark border-r border-ink/10 shelf-shadow z-[70] flex flex-col transition-all duration-300 transform outline-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        !isSidebarOpen && "lg:w-0 lg:overflow-hidden" // Collapse desktop
      )}>
        <div className={cn("p-8 flex-1 flex flex-col overflow-y-auto custom-scrollbar transition-all duration-300", !isSidebarOpen && "opacity-0 invisible")}>
          <div className="flex justify-between items-start mb-10 border-b border-gold/40 pb-6 relative">
             <div className="text-center flex-1">
                <h1 className="text-2xl text-ink font-display uppercase tracking-[4px]">Codex</h1>
                <p className="text-sm text-ink font-sans font-bold mt-1 tracking-[2px] opacity-70">DIGITALIS</p>
             </div>
             <button 
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-2 text-ink/40 hover:text-ink"
             >
                <X className="w-6 h-6" />
             </button>
          </div>

          <nav className="space-y-10 flex-1">
            <div className="space-y-4">
              <span className="text-xs text-ink uppercase tracking-widest block font-bold px-2 opacity-50">Archivio</span>
              <div className="space-y-1">
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    "w-full text-left px-5 py-3 text-sm font-sans rounded-md transition-all",
                    !selectedCategory ? "bg-ink text-white shadow-lg font-bold" : "text-ink hover:bg-ink/5"
                  )}
                >
                  Indice Generale
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <span className="text-xs text-ink uppercase tracking-widest block font-bold px-2 opacity-50">Sezioni</span>
              <div className="space-y-1">
                {categories.length === 0 ? (
                  <p className="px-4 py-2 text-xs italic text-ink/30 font-sans">Nessuna sezione creata</p>
                ) : (
                  categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        if (window.innerWidth < 1024) setIsSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-5 py-3 text-sm font-sans transition-all truncate rounded-md",
                        selectedCategory === cat ? "bg-ink text-white font-bold" : "text-ink hover:bg-ink/5"
                      )}
                    >
                      {cat}
                    </button>
                  ))
                )}
              </div>
            </div>
          </nav>

          <footer className="mt-auto pt-6 border-t border-ink/10 text-center">
             <p className="text-sm text-ink font-sans font-medium">Codex Digitalis v3.0</p>
          </footer>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-paper">
        <header className="px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-ink/5 bg-paper/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-6 w-full md:w-auto">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 text-ink hover:text-gold transition-colors"
              title="Toggle Library Index"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative flex-1 md:w-[400px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30 w-5 h-5 pointer-events-none" />
              <input 
                type="text"
                placeholder='Cerca nei volumi...' 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-ink/5 border-none rounded-sm font-serif text-sm focus:bg-ink/[0.08] focus:ring-1 focus:ring-gold/30 transition-all outline-none italic"
              />
            </div>
          </div>
          
          <AntiqueButton 
            onClick={() => setIsUploading(true)} 
            className="w-full md:w-auto flex items-center justify-center gap-2 uppercase tracking-[2px] text-xs py-2 px-5 bg-ink text-paper border-ink hover:bg-gold hover:text-ink hover:border-gold rounded-full shadow-lg h-10"
          >
            Aggiungi Documento <Plus className="w-4 h-4" />
          </AntiqueButton>
        </header>

        <div className="flex-1 p-8 sm:p-12 overflow-y-auto custom-scrollbar">
          {!books || books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 opacity-30 text-center">
              <LibraryIcon className="w-16 h-16 text-ink mb-4" />
              <h2 className="text-xl font-serif italic text-ink">L&apos;archivio è vuoto.</h2>
              <p className="text-xs font-serif mt-1">Carica il tuo primo volume per iniziare la collezione.</p>
            </div>
          ) : (
            <WoodShelf title={selectedCategory || "Indice dei Volumi"}>
              {books.map((book) => (
                <motion.div
                  key={book.id}
                  whileHover={{ y: -6 }}
                  className="flex flex-col gap-3 group cursor-pointer"
                  onClick={() => onSelectBook(book)}
                >
                  <div className="relative flex-1 bg-ink/5 aspect-[3/4] aspect-h-4 rounded-sm shadow-sm overflow-hidden border border-ink/10 group-hover:shadow-xl transition-all group-hover:border-gold/30">
                    {book.thumbnail ? (
                      <img 
                        src={book.thumbnail} 
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        alt={book.title} 
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-4 bg-paper-dark">
                         <BookIcon className="w-12 h-12 text-ink/20" />
                      </div>
                    )}
                    
                    {/* Action Buttons - More visible for accessibility */}
                    <div className="absolute top-2 right-2 flex flex-col gap-2 z-20">
                      <button 
                        onClick={(e) => handleDeleteBook(e, book.id)}
                        className="p-2.5 bg-red-600/90 text-white rounded-full opacity-100 shadow-xl border border-white/20 active:scale-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-red-700"
                        title="Elimina Libro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleEditBook(e, book)}
                        className="p-2.5 bg-gold/90 text-white rounded-full opacity-100 shadow-xl border border-white/20 active:scale-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-gold"
                        title="Modifica Libro"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Visual hint for mobile that actions exist */}
                    <div className="sm:hidden absolute bottom-2 right-2 flex gap-1 scale-75 opacity-50">
                       <div className="w-2 h-2 rounded-full bg-ink/40" />
                       <div className="w-2 h-2 rounded-full bg-ink/40" />
                    </div>
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-ink uppercase tracking-tight leading-tight line-clamp-2 group-hover:text-gold transition-colors">
                      {book.title}
                    </h3>
                    <p className="text-xs text-ink/70 italic truncate">
                      {book.author}
                    </p>
                  </div>
                </motion.div>
              ))}
            </WoodShelf>
          )}
        </div>


        {/* Reader Preview (Floating) - Hidden on Mobile */}
        {lastAnnotation && (
          <div className="hidden md:block absolute bottom-10 right-10 w-[320px] bg-paper border border-[#c9b08d] p-7 shadow-[0_15px_40px_rgba(0,0,0,0.6)] z-20">
            <h3 className="font-display text-sm mb-3 border-b border-[#d4c4b5] pb-2 text-gold uppercase tracking-wider">Ultima Annotazione</h3>
            <div className="relative italic text-[12px] leading-relaxed text-[#5a544d] mb-4">
              <span className="absolute -top-3 -left-4 text-4xl opacity-20 font-serif">"</span>
              {lastAnnotation.content.length > 100 ? lastAnnotation.content.substring(0, 100) + '...' : lastAnnotation.content}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] px-2 py-1 bg-gold text-white rounded-full">Pagina {lastAnnotation.pageNumber}</span>
              <button 
                className="text-[11px] text-gold hover:underline"
                onClick={() => {
                   const book = books?.find(b => b.id === lastAnnotation.bookId);
                   if (book) onSelectBook(book);
                }}
              >
                Continua a leggere →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingBook && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[110] backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-white p-8 rounded-lg shadow-2xl relative border border-gold/20"
            >
              <button 
                onClick={() => setEditingBook(null)}
                className="absolute top-4 right-4 text-ink/40 hover:text-ink transition-colors"
                title="Cancel"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-xl font-display font-bold text-ink mb-6 uppercase tracking-wider">Modifica Dettagli</h2>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink/50">Titolo</label>
                  <input 
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(s => ({ ...s, title: e.target.value }))}
                    className="w-full bg-ink/5 border-none p-3 font-sans focus:ring-1 focus:ring-gold/30 outline-none rounded-md"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink/50">Autore</label>
                  <input 
                    type="text"
                    value={editForm.author}
                    onChange={(e) => setEditForm(s => ({ ...s, author: e.target.value }))}
                    className="w-full bg-ink/5 border-none p-3 font-sans focus:ring-1 focus:ring-gold/30 outline-none rounded-md"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-ink/50">Categoria</label>
                  <input 
                    type="text"
                    list="category-suggestions"
                    value={editForm.category}
                    onChange={(e) => setEditForm(s => ({ ...s, category: e.target.value }))}
                    className="w-full bg-ink/5 border-none p-3 font-sans focus:ring-1 focus:ring-gold/30 outline-none rounded-md"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => setEditingBook(null)}
                  className="flex-1 py-3 px-4 border border-ink/10 rounded-md text-sm font-bold text-ink/60 hover:bg-ink/5 transition-colors"
                >
                  Annulla
                </button>
                <button 
                  onClick={saveEdit}
                  className="flex-1 py-3 px-4 bg-ink text-white rounded-md text-sm font-bold hover:bg-gold transition-colors"
                >
                  Salva Modifiche
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[100] backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xl paper-texture p-12 relative border border-[#c9b08d]"
            >
              <button 
                onClick={() => setIsUploading(false)}
                className="absolute top-4 right-4 text-wood-dark hover:text-gold transition-colors"
                disabled={uploadStatus === 'processing'}
              >
                <X className="w-8 h-8" />
              </button>

              <h2 className="font-display text-2xl text-wood-dark mb-4 text-center italic underline decoration-gold underline-offset-4">
                Nuovo Volume
              </h2>

              <div className="space-y-6 mb-8 text-left">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest font-bold text-ink/70 block">Genere / Sezione</label>
                  <input 
                    type="text"
                    list="category-suggestions"
                    placeholder="Esempio: Filosofia, Romanzo..."
                    value={bookCategory}
                    onChange={(e) => setBookCategory(e.target.value)}
                    className="w-full bg-white border-ink/20 border p-4 font-sans focus:border-gold outline-none shadow-sm rounded-md"
                  />
                  <datalist id="category-suggestions">
                    {categories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                  <p className="text-[10px] text-ink/40 font-sans">Digita un nuovo genere o scegline uno esistente</p>
                </div>

                <label className="block w-full border-2 border-dashed border-gold/40 h-48 rounded-sm cursor-pointer hover:border-gold transition-all hover:bg-gold/5 group relative overflow-hidden">
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={uploadStatus === 'processing'} />
                  
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-wood-dark/60 group-hover:text-wood-dark">
                    {uploadStatus === 'processing' ? (
                      <>
                        <Loader2 className="w-12 h-12 animate-spin text-gold" />
                        <p className="font-serif italic text-base">Archiviazione...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 group-hover:scale-110 transition-transform" />
                        <div className="text-center">
                          <p className="font-serif italic text-lg">Pergamena PDF</p>
                          <p className="text-xs font-serif opacity-60">Clicca o trascina</p>
                        </div>
                      </>
                    )}
                  </div>
                </label>
              </div>

              <div className="text-center bg-gold/5 p-4 rounded-sm border border-gold/20 italic text-wood-dark/60 text-sm font-serif">
                Consigna il documento per la catalogazione nell&apos;indice imperiale.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
