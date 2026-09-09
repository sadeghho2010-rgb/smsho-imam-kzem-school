import html2canvasPro from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface ExportPdfOptions {
  element: HTMLElement;
  filename: string;
  orientation?: 'portrait' | 'landscape';
  marginMM?: number;
  scale?: number;
  quality?: number;
}

export async function exportElementToPdf({
  element,
  filename,
  orientation = 'portrait',
  marginMM = 6,
  scale = 1.4,
  quality = 0.80
}: ExportPdfOptions): Promise<void> {
  if (!element) {
    throw new Error('PDF Export Error: Element is missing or undefined.');
  }

  // Tag element temporarily for onclone detection
  element.setAttribute('data-pdf-export-target', 'true');

  try {
    const canvas = await html2canvasPro(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      onclone: (clonedDoc: Document) => {
        // Ensure target element and parents in clone are visible
        const clonedEl = clonedDoc.querySelector('[data-pdf-export-target="true"]') as HTMLElement;
        if (clonedEl) {
          let curr: HTMLElement | null = clonedEl;
          while (curr && curr !== clonedDoc.body) {
            if (window.getComputedStyle(curr).display === 'none') {
              curr.style.display = 'block';
            }
            curr.style.visibility = 'visible';
            curr = curr.parentElement;
          }
        }

        // 1. Sanitize all <style> elements in cloned document
        const styleTags = clonedDoc.querySelectorAll('style');
        styleTags.forEach((styleTag) => {
          if (styleTag.textContent) {
            styleTag.textContent = styleTag.textContent
              .replace(/oklab\([^)]+\)/gi, '#4f46e5')
              .replace(/oklch\([^)]+\)/gi, '#4f46e5');
          }
        });

        // 2. Sanitize inline styles on cloned elements
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style && htmlEl.style.cssText) {
            if (htmlEl.style.cssText.includes('oklab') || htmlEl.style.cssText.includes('oklch')) {
              htmlEl.style.cssText = htmlEl.style.cssText
                .replace(/oklab\([^)]+\)/gi, '#4f46e5')
                .replace(/oklch\([^)]+\)/gi, '#4f46e5');
            }
          }
        });
      }
    });

    if (!canvas.width || !canvas.height || canvas.width <= 0 || canvas.height <= 0) {
      throw new Error('PDF Export Error: Generated canvas has invalid dimensions.');
    }

    const imgData = canvas.toDataURL('image/jpeg', quality);
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation,
      compress: true
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const printWidth = pageWidth - (marginMM * 2);
    const imgHeight = (canvas.height * printWidth) / canvas.width;

    if (!isFinite(imgHeight) || imgHeight <= 0) {
      throw new Error('PDF Export Error: Calculated image height is invalid.');
    }

    let heightLeft = imgHeight;
    let position = marginMM;

    pdf.addImage(imgData, 'JPEG', marginMM, position, printWidth, imgHeight, undefined, 'FAST');
    heightLeft -= (pageHeight - (marginMM * 2));

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + marginMM;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', marginMM, position, printWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - (marginMM * 2));
    }

    pdf.save(filename);
  } finally {
    element.removeAttribute('data-pdf-export-target');
  }
}
