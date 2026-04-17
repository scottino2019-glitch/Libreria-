import Dexie, { type Table } from 'dexie';

export interface Book {
  id: string;
  title: string;
  author: string;
  category?: string;
  file: Blob;
  thumbnail?: string; // Base64 or URL
  addedAt: number;
  lastReadAt?: number;
  totalPages: number;
}

export interface Annotation {
  id: string;
  bookId: string;
  pageNumber: number;
  content: string;
  type: 'note' | 'highlight';
  color?: string;
  rects?: { x: number; y: number; w: number; h: number }[]; // For highlights
  createdAt: number;
}

export class BibliothecaDatabase extends Dexie {
  books!: Table<Book>;
  annotations!: Table<Annotation>;

  constructor() {
    super('BibliothecaDB');
    this.version(2).stores({
      books: 'id, title, author, category, addedAt',
      annotations: 'id, bookId, pageNumber, createdAt'
    });
  }
}

export const db = new BibliothecaDatabase();
