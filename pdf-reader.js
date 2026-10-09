import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerUrl;

export async function readPdf(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error("El PDF supera el límite de 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("El archivo no es un PDF válido.");
  const loading = getDocument({ data: bytes });
  let pdf;
  try {
    pdf = await loading.promise;
    if (pdf.numPages > 20) throw new Error("Importa una factura de hasta 20 páginas.");
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      const rows = new Map();
      for (const item of content.items) {
        if (!item.str) continue;
        const y = Math.round(item.transform[5] / 3) * 3;
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ x: item.transform[4], width: item.width, text: item.str });
      }
      pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, items]) => {
        // Algunos generadores PDF separan cada letra: unir por posición, no por item.
        const sorted = items.sort((a, b) => a.x - b.x);
        return sorted.map((item, index) => {
          const previous = sorted[index - 1];
          const gap = previous ? item.x - previous.x - previous.width : 0;
          return (gap > 4 ? "  " : "") + item.text;
        }).join("");
      }).join("\n"));
    }
    return pages.join("\n\n");
  } finally {
    if (pdf) await pdf.destroy();
    else await loading.destroy();
  }
}
