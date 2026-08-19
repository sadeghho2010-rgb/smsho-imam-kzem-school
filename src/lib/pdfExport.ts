import html2canvasPro from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface ExportPdfOptions {
  element: HTMLElement;
  filename: string;
  orientation?: 'portrait' | 'landscape';
  marginMM?: number;
}

export async function exportElementToPdf({
  element,
  filename,
  orientation = 'portrait',
  marginMM = 6
}: ExportPdfOptions): Promise<void> {
  const canvas = await html2canvasPro(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc: Document) => {
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

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const printWidth = pageWidth - (marginMM * 2);
  const imgHeight = (canvas.height * printWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = marginMM;

  pdf.addImage(imgData, 'JPEG', marginMM, position, printWidth, imgHeight);
  heightLeft -= (pageHeight - (marginMM * 2));

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + marginMM;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', marginMM, position, printWidth, imgHeight);
    heightLeft -= (pageHeight - (marginMM * 2));
  }

  pdf.save(filename);
}
