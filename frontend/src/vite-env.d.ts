/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: 'jpeg' | 'png' | 'webp'; quality?: number };
    html2canvas?: { scale?: number; useCORS?: boolean; logging?: boolean };
    jsPDF?: { unit?: 'pt' | 'mm' | 'cm' | 'in'; format?: string; orientation?: 'portrait' | 'landscape' };
    pagebreak?: { mode?: string | string[] };
  }

  interface Html2Pdf {
    set(options: Html2PdfOptions): Html2Pdf;
    from(element: HTMLElement | string): Html2Pdf;
    save(): Promise<void>;
    outputPdf(type?: string): Promise<any>;
    toPdf(): Html2Pdf;
  }

  function html2pdf(): Html2Pdf;
  export default html2pdf;
}

