/**
 * The donor's acknowledgement as a PDF, drawn with jsPDF (vector text, ~1 page A4).
 * Replaces the old site's html2pdf screenshot. jsPDF is imported only when a donor
 * clicks Download. Its built-in Helvetica has no ₹ glyph, so amounts read "Rs.".
 * Keep the strings plain ASCII (no curly quotes or long dashes) for the same reason.
 */
import { trust } from "@/config";

import { formatAmount } from "./format";

export interface Acknowledgement {
  /** confirmed = the API recorded the payment; received = Easebuzz said success, API not yet updated. */
  status: "confirmed" | "received";
  donorName: string;
  donorId: string;
  date: string;
  cause: string;
  mode: string;
  amount: number;
  easebuzzId?: string;
  trustTxnId?: string;
  reference: string;
}

type RGB = [number, number, number];
const INK: RGB = [23, 25, 59];
const MUTED: RGB = [94, 98, 131];
const CRIMSON: RGB = [200, 16, 58];
const SUCCESS: RGB = [15, 122, 74];
const LINE: RGB = [227, 232, 241];
const PAPER_2: RGB = [243, 246, 251];

/** The logo, scaled down for print (20 mm ≈ 160 px at 200 dpi) so the PDF stays small. */
function logoDataUrl(src: string, px = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = px;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, px, px);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("logo failed to load"));
    img.src = src;
  });
}

export async function downloadAcknowledgementPdf(a: Acknowledgement) {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), logoDataUrl("/logo-mark.png").catch(() => null)]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 18;
  const right = W - M;

  doc.setProperties({ title: `Donation acknowledgement ${a.reference}`, author: trust.name, subject: "Donation acknowledgement" });

  // Letterhead.
  let y = 16;
  if (logo) doc.addImage(logo, "PNG", M, y, 20, 20, "logo", "FAST");
  const tx = logo ? M + 25 : M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(trust.name, tx, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const addressLines = doc.splitTextToSize(trust.address.join(", "), right - tx) as string[];
  doc.text(addressLines, tx, y + 12);
  const afterAddress = y + 12 + addressLines.length * 3.6;
  doc.text(
    `Public trust reg. ${trust.legal.registrationNo}  |  PAN ${trust.legal.pan}  |  80G ${trust.legal.eightyGNo}`,
    tx,
    afterAddress,
  );
  doc.text(`${trust.phone}  |  ${trust.email}`, tx, afterAddress + 3.6);

  y = Math.max(y + 24, afterAddress + 8);
  doc.setDrawColor(...CRIMSON);
  doc.setLineWidth(0.8);
  doc.line(M, y, right, y);

  // Title and status.
  y += 13;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("Donation acknowledgement", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(a.date, right, y, { align: "right" });

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  if (a.status === "confirmed") {
    doc.setTextColor(...SUCCESS);
    doc.text("Payment confirmed", M, y);
  } else {
    doc.setTextColor(...MUTED);
    doc.text("Payment received by Easebuzz - confirmation pending", M, y);
  }

  // Amount panel.
  y += 7;
  doc.setFillColor(...PAPER_2);
  doc.roundedRect(M, y, right - M, 26, 3, 3, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("AMOUNT", M + 7, y + 9);
  doc.text("CAUSE", W / 2 + 4, y + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(`Rs. ${formatAmount(a.amount)}`, M + 7, y + 19.5);
  doc.setFontSize(13);
  doc.text(doc.splitTextToSize(a.cause || "General donation", right - (W / 2 + 4) - 7) as string[], W / 2 + 4, y + 18);

  // Details.
  y += 38;
  const rows: [string, string | undefined][] = [
    ["Donor name", a.donorName],
    ["Donor ID", a.donorId],
    ["Payment mode", a.mode],
    ["Easebuzz transaction ID", a.easebuzzId],
    ["Trust transaction no.", a.trustTxnId],
    ["Payment reference", a.reference],
  ];
  doc.setLineWidth(0.25);
  doc.setDrawColor(...LINE);
  for (const [label, value] of rows) {
    if (!value) continue;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(label, M, y);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.text(doc.splitTextToSize(value, right - (M + 62)) as string[], M + 62, y);
    y += 5;
    doc.line(M, y, right, y);
    y += 7;
  }

  // Note.
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const note = doc.splitTextToSize(
    `Thank you for your donation to ${trust.name}. This acknowledges your online payment. The trust issues your official donation receipt, with its 80G details, separately. Online donations are accepted only from Indian citizens living in India.`,
    right - M,
  ) as string[];
  doc.text(note, M, y);

  // Footer.
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("This is a computer-generated acknowledgement.", M, 285);
  doc.text(`Payments processed by Easebuzz`, right, 285, { align: "right" });

  doc.save(`Sarvamangal-donation-acknowledgement-${a.reference}.pdf`);
}
