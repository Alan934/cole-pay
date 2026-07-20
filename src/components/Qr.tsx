"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renderiza un código QR a partir de un texto/URL, generado en el cliente. */
export function Qr({
  value,
  size = 180,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0a0b0f", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Código QR"
          width={size}
          height={size}
          className="rounded-xl"
        />
      ) : (
        <div className="h-full w-full animate-pulse rounded-xl bg-raised2" />
      )}
    </div>
  );
}
