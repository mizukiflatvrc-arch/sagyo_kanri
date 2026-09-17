declare module "pdfmake/build/pdfmake.js" {
  interface GeneratedPdf {
    getBlob(): Promise<Blob>;
  }

  interface PdfMakeBrowser {
    addFonts(fonts: Record<string, Record<string, string>>): void;
    setUrlAccessPolicy(policy: (url: string) => boolean): void;
    createPdf(documentDefinition: unknown): GeneratedPdf;
  }

  const pdfMake: PdfMakeBrowser;
  export default pdfMake;
}
