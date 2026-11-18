"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, ExternalLink, Printer, RefreshCw } from "lucide-react";

interface QrCodeCardProps {
  tableNumber: string;
  section: string;
  qrToken: string;
  restaurantName?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
  compact?: boolean;
}

export function QrCodeCard({
  tableNumber,
  section,
  qrToken,
  restaurantName = "KORA Kitchen & Grill",
  onRegenerate,
  regenerating,
  compact = false,
}: QrCodeCardProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const targetPath = `/menu/t/${qrToken}`;
  const fullUrl = origin ? `${origin}${targetPath}` : targetPath;

  useEffect(() => {
    if (!fullUrl) return;
    QRCode.toDataURL(fullUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#1C1917", light: "#FFFFFF" },
    })
      .then(setDataUrl)
      .catch(() => {});
  }, [fullUrl]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${tableNumber.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    a.click();
  };

  const handlePrint = () => {
    const win = window.open("", "_blank", "width=420,height=600");
    if (!win || !dataUrl) return;
    win.document.write(`
      <html>
        <head>
          <title>${tableNumber} QR Standee — ${restaurantName}</title>
          <style>
            body { font-family: Georgia, serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#FAF8F5; color:#1C1917; }
            .card { width: 320px; border: 2px solid #1C1917; padding: 32px 24px; text-align:center; background:#fff; border-radius: 16px; }
            .brand { font-size: 20px; letter-spacing: 0.14em; text-transform: uppercase; margin: 0 0 4px; }
            .sub { font-family: system-ui, sans-serif; font-size: 11px; color: #78716C; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 20px; }
            img { width: 220px; height: 220px; border: 1px solid #E7E5E4; border-radius: 12px; padding: 8px; }
            .tbl { font-size: 26px; font-weight: 700; margin: 18px 0 4px; }
            .hint { font-family: system-ui, sans-serif; font-size: 12px; color: #57534E; margin: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="brand">${restaurantName}</div>
            <div class="sub">Scan to Order & Pay</div>
            <img src="${dataUrl}" />
            <div class="tbl">${tableNumber}</div>
            <p class="hint">${section} · No app download required</p>
          </div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-900">{tableNumber}</p>
          <p className="text-xs text-stone-500">{section}</p>
        </div>
        <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
          /t/{qrToken.slice(0, 8)}
        </span>
      </div>

      <div className="my-3 flex justify-center rounded-lg border border-stone-100 bg-stone-50/70 p-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR code for ${tableNumber}`}
            className={compact ? "h-32 w-32 rounded" : "h-40 w-40 rounded"}
          />
        ) : (
          <div className="h-32 w-32 animate-pulse rounded bg-stone-200" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <a
          href={targetPath}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Menu
        </a>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center justify-center rounded-lg border border-stone-200 p-1.5 text-stone-700 hover:bg-stone-100"
          title="Print Tabletop QR Standee"
        >
          <Printer className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center justify-center rounded-lg border border-stone-200 p-1.5 text-stone-700 hover:bg-stone-100"
          title="Download PNG"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        {onRegenerate && (
          <button
            type="button"
            disabled={regenerating}
            onClick={onRegenerate}
            className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            title="Regenerate QR Token (invalidates old QR)"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}
