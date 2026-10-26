"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Los dos botones del comprobante. "Compartir" abre el menú del celular
 * (WhatsApp, mail…); donde no existe —la compu— copia el texto al portapapeles.
 * "Imprimir" abre el diálogo del navegador, que también permite guardar en PDF.
 */
export function ReceiptActions({
  shareText,
  fileName,
}: {
  shareText: string;
  fileName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // Se decide después de montar: en el servidor no hay `navigator`.
  useEffect(() => setCanShare("share" in navigator), []);

  async function share() {
    try {
      if (canShare) {
        await navigator.share({ title: "Comprobante de transferencia", text: shareText });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Cerrar el menú de compartir tira AbortError: no es un error de verdad.
    }
  }

  function print() {
    // El nombre del archivo que propone "Guardar como PDF" sale del título.
    const previous = document.title;
    document.title = fileName;
    window.print();
    document.title = previous;
  }

  return (
    <div className="grid grid-cols-2 gap-2 print:hidden">
      <Button size="lg" className="px-3 whitespace-nowrap" onClick={share}>
        {copied ? (
          <Check className="h-5 w-5" />
        ) : canShare ? (
          <Share2 className="h-5 w-5" />
        ) : (
          <Copy className="h-5 w-5" />
        )}
        {copied ? "¡Copiado!" : canShare ? "Compartir" : "Copiar datos"}
      </Button>
      <Button
        size="lg"
        variant="secondary"
        className="px-3 whitespace-nowrap"
        onClick={print}
      >
        <Printer className="h-5 w-5" />
        Imprimir / PDF
      </Button>
    </div>
  );
}
