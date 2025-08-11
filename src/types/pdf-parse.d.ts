// Minimal typings for pdf-parse to satisfy TS
declare module 'pdf-parse' {
  interface PDFInfoMeta {
    [key: string]: unknown
  }
  interface PDFResult {
    numpages: number
    numrender: number
    info: PDFInfoMeta | undefined
    metadata: unknown
    text: string
    version: string
  }
  function pdf(data: Buffer | Uint8Array | ArrayBuffer): Promise<PDFResult>
  export default pdf
}

