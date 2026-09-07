import html2canvasPro from 'html2canvas-pro';

interface ExportImageOptions {
  element: HTMLElement;
  filename: string;
  backgroundColor?: string;
  scale?: number;
}

export async function exportElementToImage({
  element,
  filename,
  backgroundColor = '#ffffff',
  scale = 2
}: ExportImageOptions): Promise<void> {
  if (!element) {
    throw new Error('Image Export Error: Element is missing or undefined.');
  }

  const canvas = await html2canvasPro(element, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor,
    windowWidth: 1200,
    onclone: (clonedDoc: Document) => {
      // 1. Sanitize style tags
      const styleTags = clonedDoc.querySelectorAll('style');
      styleTags.forEach((styleTag) => {
        if (styleTag.textContent) {
          styleTag.textContent = styleTag.textContent
            .replace(/oklab\([^)]+\)/gi, '#4f46e5')
            .replace(/oklch\([^)]+\)/gi, '#4f46e5');
        }
      });

      // 2. Sanitize inline styles
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

  if (!canvas.width || !canvas.height) {
    throw new Error('Image Export Error: Generated canvas has invalid dimensions.');
  }

  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
