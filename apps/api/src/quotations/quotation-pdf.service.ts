import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');

interface LineItem { description: string; qty: number; unit_price: number; amount: number; }

@Injectable()
export class QuotationPdfService {
  /** Renders a quotation to a PDF buffer — plain, readable, no external assets (safe to run in a headless Docker container). */
  async render(quote: {
    number: string;
    company_name: string;
    contact_name?: string;
    contact_phone?: string;
    line_items: LineItem[];
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount: number;
    total: number;
    currency: string;
    valid_until?: string | null;
    notes?: string | null;
    terms?: string | null;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fmt = (n: number) => `${quote.currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      doc.fontSize(20).text(quote.company_name, { continued: false });
      doc.moveDown(0.3);
      doc.fontSize(14).fillColor('#555').text(`Quotation ${quote.number}`);
      doc.fillColor('#000');
      doc.moveDown(1);

      if (quote.contact_name) {
        doc.fontSize(10).fillColor('#555').text('Prepared for:');
        doc.fontSize(12).fillColor('#000').text(quote.contact_name);
        if (quote.contact_phone) doc.fontSize(10).fillColor('#555').text(quote.contact_phone);
        doc.fillColor('#000');
        doc.moveDown(1);
      }
      if (quote.valid_until) {
        doc.fontSize(10).fillColor('#555').text(`Valid until: ${quote.valid_until}`);
        doc.fillColor('#000');
        doc.moveDown(1);
      }

      // Line items table
      const tableTop = doc.y + 10;
      const colX = { desc: 50, qty: 320, price: 390, amount: 470 };
      doc.fontSize(9).fillColor('#555');
      doc.text('Description', colX.desc, tableTop);
      doc.text('Qty', colX.qty, tableTop, { width: 50, align: 'right' });
      doc.text('Unit price', colX.price, tableTop, { width: 70, align: 'right' });
      doc.text('Amount', colX.amount, tableTop, { width: 80, align: 'right' });
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#ddd').stroke();

      let y = tableTop + 22;
      doc.fillColor('#000').fontSize(10);
      for (const item of quote.line_items) {
        doc.text(item.description, colX.desc, y, { width: 260 });
        doc.text(String(item.qty), colX.qty, y, { width: 50, align: 'right' });
        doc.text(fmt(item.unit_price), colX.price, y, { width: 70, align: 'right' });
        doc.text(fmt(item.amount), colX.amount, y, { width: 80, align: 'right' });
        y += 20;
      }
      doc.moveTo(50, y + 5).lineTo(550, y + 5).strokeColor('#ddd').stroke();
      y += 15;

      const totalsLine = (label: string, value: string, bold = false) => {
        doc.fontSize(bold ? 12 : 10).font(bold ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(label, 380, y, { width: 90, align: 'right' });
        doc.text(value, colX.amount, y, { width: 80, align: 'right' });
        y += bold ? 20 : 16;
      };
      totalsLine('Subtotal', fmt(quote.subtotal));
      if (quote.tax_rate > 0) totalsLine(`Tax (${quote.tax_rate}%)`, fmt(quote.tax_amount));
      if (quote.discount > 0) totalsLine('Discount', `-${fmt(quote.discount)}`);
      totalsLine('Total', fmt(quote.total), true);
      doc.font('Helvetica');

      if (quote.notes) {
        doc.moveDown(2);
        doc.fontSize(9).fillColor('#555').text('Notes', 50, doc.y);
        doc.fillColor('#000').fontSize(10).text(quote.notes, 50, doc.y + 12, { width: 500 });
      }
      if (quote.terms) {
        doc.moveDown(1);
        doc.fontSize(9).fillColor('#555').text('Terms & conditions', 50, doc.y);
        doc.fillColor('#000').fontSize(10).text(quote.terms, 50, doc.y + 12, { width: 500 });
      }

      doc.end();
    });
  }
}
