import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

interface PDFPageProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}

export const PDFPage: React.FC<PDFPageProps> = ({ pdf, pageNumber, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    if (canvasRef.current) {
      observer.observe(canvasRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const render = async () => {
      if (!canvasRef.current) return;
      
      const page = await pdf.getPage(pageNumber);
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { alpha: false });

      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.height = `${viewport.height / dpr}px`;
      canvas.style.width = `${viewport.width / dpr}px`;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const renderTask = page.render({
        canvasContext: context,
        viewport,
        intent: 'display'
      });

      renderTaskRef.current = renderTask;
      
      try {
        await renderTask.promise;
      } catch (e: any) {
        if (e.name !== 'RenderingCancelledException') {
          console.error(e);
        }
      }
    };

    render();
  }, [pdf, pageNumber, scale, isVisible]);

  return (
    <div className="relative bg-white shadow-2xl ring-1 ring-black/10 mx-auto mb-8 transition-transform hover:scale-[1.01] duration-500">
      <canvas ref={canvasRef} className="block" />
      <div className="absolute bottom-4 right-4 bg-ink/5 px-2 py-1 rounded text-[10px] text-ink/30 font-mono">
        P. {pageNumber}
      </div>
    </div>
  );
};
