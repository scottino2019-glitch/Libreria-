import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function getPdfMetadata(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  try {
    const pdf = await loadingTask.promise;
    const metadata = await pdf.getMetadata();
    
    // Normalize title and author with fallbacks
    let title = (metadata.info as any)?.Title || file.name.replace('.pdf', '');
    let author = (metadata.info as any)?.Author || 'Autore Sconosciuto';
    
    // Remove null characters often found in PDF metadata
    title = title.replace(/\0/g, '').trim();
    author = author.replace(/\0/g, '').trim();

    if (!title) title = file.name.replace('.pdf', '');

    return {
      title,
      author,
      totalPages: pdf.numPages
    };
  } catch (error) {
    console.error('Metadata extraction failed:', error);
    return {
      title: file.name.replace('.pdf', ''),
      author: 'Autore Sconosciuto',
      totalPages: 0
    };
  }
}

export async function generateThumbnail(file: Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  
  const viewport = page.getViewport({ scale: 0.5 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error('Could not get canvas context');
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  await page.render({ canvasContext: context, viewport }).promise;
  
  return canvas.toDataURL('image/jpeg', 0.8);
}
