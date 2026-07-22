import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface Props {
  onDetect: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetect, onClose }: Props) {
  const divId = 'ghpos-barcode-scanner';
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      divId,
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
      },
      false,
    );

    scanner.render(
      (decodedText) => {
        scanner.clear().catch(() => null);
        onDetect(decodedText.trim());
      },
      (err) => {
        // Suppress the per-frame "no QR code found" errors
        if (!err.includes('No MultiFormat Readers')) {
          setError(err);
        }
      },
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => null);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4">
      <div className="bg-paper w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="text-sm font-semibold">Scan barcode</span>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-lg leading-none"
            aria-label="Close scanner"
          >
            ×
          </button>
        </div>
        <div className="p-3">
          <div id={divId} />
          {error && (
            <p className="text-xs text-danger mt-2 px-1">{error}</p>
          )}
        </div>
        <div className="px-4 pb-4">
          <p className="text-xs text-muted text-center">
            Point the camera at a barcode to add the product
          </p>
        </div>
      </div>
    </div>
  );
}
