// pdf-parse ships types for the package root but not the lib entry we import
// (the root runs a debug self-test on import; the lib entry skips it).
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string
    numpages: number
    info: unknown
    metadata: unknown
    version: string
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>
  export default pdfParse
}
