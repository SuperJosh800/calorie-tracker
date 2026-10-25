import { useEffect, useRef, useState } from 'react'

/** Live camera barcode scanner, with a manual entry fallback. Calls `onDetected` once. */
export function Scanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | undefined
    let timer: number | undefined

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser cannot use the camera here. The page must be opened over https.')
        }
        const { createDetector } = await import('../barcode')
        const detectorPromise = createDetector()
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        const detector = await detectorPromise
        const video = videoRef.current
        if (stopped || !video) return
        video.srcObject = stream
        await video.play()
        setStatus('scanning')

        const tick = async () => {
          if (stopped) return
          if (video.readyState >= 2) {
            try {
              const codes = await detector.detect(video)
              const hit = codes.find((c) => /^\d{6,14}$/.test(c.rawValue))
              if (hit && !stopped) {
                stopped = true
                navigator.vibrate?.(60)
                onDetectedRef.current(hit.rawValue)
                return
              }
            } catch {
              // A frame failed to decode; try the next one.
            }
          }
          timer = window.setTimeout(tick, 120)
        }
        tick()
      } catch (e) {
        if (stopped) return
        const name = (e as Error).name
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access for this site in your browser settings, or type the barcode below.'
            : name === 'NotFoundError'
              ? 'No camera found. Type the barcode below instead.'
              : (e as Error).message || 'Could not start the camera.',
        )
        setStatus('error')
      }
    }
    start()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manual.replace(/\D/g, '')
    if (code.length >= 6) onDetected(code)
  }

  return (
    <div className="scanner">
      <div className="scanner-view">
        <video ref={videoRef} playsInline muted autoPlay />
        {status === 'scanning' && (
          <div className="scanner-frame" aria-hidden>
            <span className="scanner-laser" />
          </div>
        )}
        {status === 'starting' && <p className="scanner-msg">Starting camera…</p>}
        {status === 'error' && <p className="scanner-msg">{error}</p>}
      </div>
      {status === 'scanning' && <p className="hint center">Point the camera at the barcode</p>}
      <form className="row-form" onSubmit={submitManual}>
        <input
          inputMode="numeric"
          placeholder="Or type the barcode number"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          aria-label="Barcode number"
        />
        <button className="btn" type="submit" disabled={manual.replace(/\D/g, '').length < 6}>
          Look up
        </button>
      </form>
    </div>
  )
}
