"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone } from "lucide-react";

const subscribe = () => () => {};

/** QR code for opening a page of this site on a phone. */
export function PhoneQr({ path, size = 132 }: { path: string; size?: number }) {
  const origin = React.useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  return (
    <div className="hidden md:flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="rounded-xl bg-white p-2.5 border border-slate-200">
        {origin ? (
          <QRCodeSVG value={`${origin}${path}`} size={size} fgColor="#0f172a" level="M" />
        ) : (
          <div style={{ width: size, height: size }} />
        )}
      </div>
      <p className="text-xs text-slate-600 flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5" /> Scan to record on your phone
      </p>
    </div>
  );
}
