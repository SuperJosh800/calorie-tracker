import { BarcodeDetector as ZXingDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// Retail food barcodes.
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const

export interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}

/**
 * Uses the phone's built-in barcode detector when it has one (Chrome on Android),
 * otherwise a bundled ZXing WebAssembly reader (iPhone Safari, Firefox).
 */
export async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: typeof ZXingDetector }).BarcodeDetector
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats()
      const formats = FORMATS.filter((f) => supported.includes(f))
      if (formats.length) return new Native({ formats })
    } catch {
      // Fall through to the WebAssembly reader.
    }
  }
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
  })
  return new ZXingDetector({ formats: [...FORMATS] })
}
