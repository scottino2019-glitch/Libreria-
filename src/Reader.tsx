import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { db, type Book, type Annotation } from './db';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, 
  MessageSquare, Search, ArrowLeft, Loader2,
  Trash2, Plus, Edit3, X
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { cn } from './utils';
import { PDFPage } from './PDFPageView';

// Configure worker again (best way to ensure it's available)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface ReaderProps {
  book: Book;
  onClose: () => void;
}

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

export const ReaderView = ({ book, onClose }: ReaderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0); // Better base scale for vertical scrolling
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024); // Open by default on desktop
  const [newNote, setNewNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{page: number, text: string}[]>([]);
  const [activeTab, setActiveTab] = useState<'notes' | 'search'>('notes');

  const annotations = useLiveQuery(
    () => db.annotations.where('bookId').equals(book.id).toArray(),
    [book.id]
  );

  const pageAnnotations = annotations?.filter(a => a.pageNumber === currentPage) || [];

  const autoFitScale = useCallback(async (loadedPdf: pdfjsLib.PDFDocumentProxy) => {
    if (!containerRef.current) return;
    try {
      const page = await loadedPdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current.clientWidth - (window.innerWidth < 1024 ? 48 : 80);
      
      // Aim for a comfortable reading width
      const targetWidth = Math.min(containerWidth, 900);
      const newScale = targetWidth / viewport.width;
      setScale(Number(newScale.toFixed(2)));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadPdf = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const arrayBuffer = await book.file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const loadedPdf = await loadingTask.promise;
      setPdf(loadedPdf);
      await autoFitScale(loadedPdf);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      setError(err.message || 'Errore nel caricamento del file');
      setIsLoading(false);
    }
  }, [book.file, autoFitScale]);

  useEffect(() => {
    loadPdf();
  }, [loadPdf]);

  // Track scroll to update current page number
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdf) return;

    const handleScroll = () => {
      const scrollPos = container.scrollTop + (container.clientHeight / 3);
      let activePage = 1;

      for (let i = 1; i <= pdf.numPages; i++) {
        const element = pageRefs.current[i];
        if (element && element.offsetTop <= scrollPos) {
          activePage = i;
        }
      }
      
      if (activePage !== currentPage) {
        setCurrentPage(activePage);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [pdf, currentPage]);

  const scrollToPage = (pageNum: number) => {
    const element = pageRefs.current[pageNum];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const addAnnotation = async () => {
    if (!newNote.trim()) return;
    
    const annotation: Annotation = {
      id: uuidv4(),
      bookId: book.id,
      pageNumber: currentPage,
      content: newNote,
      type: 'note',
      createdAt: Date.now()
    };

    await db.annotations.add(annotation);
    setNewNote('');
  };

  const deleteAnnotation = async (id: string) => {
    await db.annotations.delete(id);
  };

  const performSearch = async () => {
    if (!pdf || !searchQuery) return;
    
    const results: {page: number, text: string}[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(' ');
      
      if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push({ page: i, text: text.substring(0, 100) + '...' });
      }
    }
    setSearchResults(results);
  };

  return (
    <div className="fixed inset-0 bg-wood-dark z-[200] flex flex-col items-center overflow-hidden">
      {/* Top Toolbar */}
      <div className="w-full h-auto min-h-[4rem] py-2 wood-texture brass-border border-t-0 border-x-0 shelf-shadow flex flex-wrap items-center justify-between px-3 sm:px-6 gap-2 z-50">
        <div className="flex items-center gap-2 sm:gap-4 order-1">
          <button 
            onClick={onClose}
            className="p-2 text-[#d4c4b5] hover:text-gold transition-colors"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="max-w-[120px] sm:max-w-md">
            <h2 className="text-[#d4c4b5] font-display text-sm sm:text-xl italic truncate">{book.title}</h2>
            <p className="hidden sm:block text-gold font-serif text-xs opacity-70 italic">{book.author}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-wood-dark/50 p-1 rounded-sm brass-border h-9 sm:h-10 order-3 sm:order-2 w-full sm:w-auto justify-center">
          <button 
            disabled={currentPage <= 1}
            onClick={() => scrollToPage(currentPage - 1)}
            className="p-1 text-[#d4c4b5] hover:text-gold disabled:opacity-30"
          >
            <ChevronLeft size={18} className="sm:w-[20px]" />
          </button>
          <span className="px-2 sm:px-3 text-[#d4c4b5] font-serif text-xs sm:text-sm whitespace-nowrap">
            Pag. {currentPage} / {pdf?.numPages || book.totalPages}
          </span>
          <button 
            disabled={!pdf || currentPage >= pdf.numPages}
            onClick={() => scrollToPage(currentPage + 1)}
            className="p-1 text-[#d4c4b5] hover:text-gold disabled:opacity-30"
          >
            <ChevronRight size={18} className="sm:w-[20px]" />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 order-2 sm:order-3">
          <div className="hidden xs:flex items-center gap-1 bg-wood-dark/50 p-1 rounded-sm brass-border h-9 sm:h-10">
             <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1 text-[#d4c4b5] hover:text-gold" title="Zoom out"><ZoomOut size={16} className="sm:w-[18px]" /></button>
             <span className="text-[10px] sm:text-xs text-[#d4c4b5] font-serif px-1 min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
             <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-1 text-[#d4c4b5] hover:text-gold" title="Zoom in"><ZoomIn size={16} className="sm:w-[18px]" /></button>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={cn(
              "p-2 rounded-sm transition-colors",
              isSidebarOpen ? "bg-gold text-white" : "text-[#d4c4b5] hover:text-gold"
            )}
          >
            <MessageSquare size={18} className="sm:w-[20px]" />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full flex overflow-hidden">
        {/* PDF Stage */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-stone-900/40 p-4 sm:p-8 md:p-12 custom-scrollbar scroll-smooth"
        >
          {error ? (
            <div className="flex flex-col items-center justify-center min-h-full text-center p-8">
              <div className="paper-texture p-8 brass-border max-w-md">
                <Trash2 className="w-12 h-12 text-red-800/40 mx-auto mb-4" />
                <h3 className="font-display text-xl text-wood-dark mb-2 italic">Errore di Lettura</h3>
                <p className="font-serif text-sm text-wood-dark/70 mb-6">{error}</p>
                <AntiqueButton onClick={onClose}>Torna alla Libreria</AntiqueButton>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-full">
              <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-gold animate-spin mb-4" />
              <p className="font-serif italic text-[#d4c4b5] text-sm sm:text-base text-center">Preparazione del manoscritto...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 sm:py-8">
              {pdf && Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((pageNum) => (
                <div 
                  key={pageNum} 
                  ref={el => { pageRefs.current[pageNum] = el; }}
                  className="w-full flex justify-center"
                >
                  <PDFPage 
                    pdf={pdf} 
                    pageNumber={pageNum} 
                    scale={scale} 
                  />
                </div>
              ))}
            </div>
          )}
        </div>

          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="fixed inset-y-0 right-0 w-full sm:w-[320px] bg-white border-l border-ink/10 flex flex-col shadow-2xl z-[210] lg:relative lg:translate-x-0"
              >
                {/* Sidebar Tabs */}
                <div className="flex border-b border-ink/10 pt-16 lg:pt-0 bg-paper-dark">
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="lg:hidden absolute top-4 left-4 text-ink p-2 hover:bg-ink/5 rounded-full"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <button 
                    className={cn(
                      "flex-1 py-4 text-sm font-sans font-bold transition-colors uppercase tracking-widest",
                      activeTab === 'notes' ? "text-ink border-b-2 border-gold" : "text-ink/40"
                    )}
                    onClick={() => setActiveTab('notes')}
                  >
                    Note
                  </button>
                  <button 
                    className={cn(
                      "flex-1 py-4 text-sm font-sans font-bold transition-colors uppercase tracking-widest",
                      activeTab === 'search' ? "text-ink border-b-2 border-gold" : "text-ink/40"
                    )}
                    onClick={() => setActiveTab('search')}
                  >
                    Cerca
                  </button>
                </div>

              {/* Sidebar Content */}
              <div className="flex-1 flex flex-col p-6 overflow-hidden bg-white/5">
                {activeTab === 'notes' ? (
                  <>
                    <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
                      <div className="flex items-center justify-between border-b border-ink/10 pb-2 mb-4">
                         <h3 className="font-sans font-bold text-ink text-xs uppercase tracking-widest">Marginalia</h3>
                         <span className="text-xs text-ink/50 font-sans font-medium">Pagina {currentPage}</span>
                      </div>
                      
                      {pageAnnotations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Edit3 className="w-10 h-10 text-ink/10 mb-3" />
                          <p className="text-base font-sans font-medium text-ink/40">Pagina immacolata.<br/>Il bibliotecario attende le tue note.</p>
                        </div>
                      ) : (
                        pageAnnotations.map((note) => (
                          <div key={note.id} className="bg-paper-dark p-4 border border-ink/5 shadow-sm group relative rounded-md">
                            <button 
                              onClick={() => deleteAnnotation(note.id)}
                              className="absolute -top-2 -right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-lg"
                            >
                              <X size={12} />
                            </button>
                            <p className="text-base font-sans text-ink leading-relaxed font-medium">
                              {note.content}
                            </p>
                            <div className="mt-2 text-xs text-ink/40 font-mono text-right">
                              {new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-gold/30">
                      <div className="relative group">
                        <textarea 
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Scrivi qui i tuoi pensieri..."
                          className="w-full bg-paper border-[#c9b08d] p-4 font-serif text-sm focus:border-gold focus:outline-none min-h-[120px] resize-none placeholder:italic shadow-inner rounded-sm"
                        />
                        <button 
                          onClick={addAnnotation}
                          disabled={!newNote.trim()}
                          className="absolute bottom-4 right-4 p-3 bg-gold text-white rounded-full hover:bg-gold/80 disabled:opacity-30 disabled:grayscale transition-all shadow-xl hover:scale-110 active:scale-95"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gold/70 w-4 h-4" />
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                        placeholder="Cerca testo..."
                        className="w-full bg-paper pl-9 pr-3 py-2 font-serif text-sm border-[#c9b08d] border focus:border-gold focus:outline-none placeholder:italic shadow-inner"
                      />
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                       {searchResults.length > 0 ? (
                         searchResults.map((result, idx) => (
                           <button 
                             key={idx}
                             onClick={() => setCurrentPage(result.page)}
                             className="w-full text-left p-2 hover:bg-gold/10 border-b border-gold/10 transition-colors group"
                           >
                             <div className="flex justify-between items-center mb-1">
                               <span className="text-[10px] text-gold font-bold italic">Pagina {result.page}</span>
                             </div>
                             <p className="text-[12px] font-serif text-wood-dark/70 line-clamp-2 italic">
                               "{result.text}"
                             </p>
                           </button>
                         ))
                       ) : (
                         <p className="text-sm font-serif italic text-wood-dark/40 py-8 text-center">
                           {searchQuery ? 'Nessun risultato trovato.' : 'Digita e premi Invio per cercare.'}
                         </p>
                       )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Search Overlay (Hidden for now, integrated in future) */}
    </div>
  );
};
