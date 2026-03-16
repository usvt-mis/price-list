import { state } from './state.js';
import { formatCurrency, getQuoteFormData, showError, showToast } from './ui.js';

const DEFAULT_TITLE = 'ใบเสนอราคา / QUOTATION';
const DEFAULT_REMARK = 'If not confirmed within 90 days to repair the company is not responsible for your goods or any asset.';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-GB');
}

function formatQty(value) {
  const parsed = asNumber(value, NaN);
  if (!Number.isFinite(parsed)) {
    return '';
  }

  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function formatMoneyOrIncluded(value) {
  const parsed = asNumber(value, NaN);
  if (!Number.isFinite(parsed)) {
    return '';
  }

  return parsed === 0 ? '(Included)' : formatCurrency(parsed);
}

function normalizeDataUri(value, mimeType = 'image/png') {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  const looksLikeBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length > 120;
  return looksLikeBase64 ? `data:${mimeType};base64,${trimmed.replace(/\s+/g, '')}` : '';
}

function joinAddress(parts) {
  return parts
    .map(part => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

function calculateLineTotal(line) {
  return (asNumber(line.quantity) * asNumber(line.unitPrice)) - asNumber(line.discountAmount);
}

function buildLineMetaMap(reportContext) {
  const map = new Map();
  const lines = Array.isArray(reportContext.rawLines) ? reportContext.rawLines : [];

  lines.forEach((line, index) => {
    if (line.bcId) {
      map.set(`bc:${line.bcId}`, line);
    }
    if (line.sequence) {
      map.set(`seq:${line.sequence}`, line);
    }
    map.set(`idx:${index}`, line);
  });

  return map;
}

function buildPrintableLines(formData, reportContext) {
  const metaMap = buildLineMetaMap(reportContext);

  return (formData.lines || [])
    .map((line, index) => {
      const meta = metaMap.get(`bc:${line.bcId}`) || metaMap.get(`seq:${line.sequence}`) || metaMap.get(`idx:${index}`) || {};

      return {
        sequence: line.sequence || index + 1,
        itemNo: line.lineObjectNumber || '',
        description: line.description || '',
        quantity: asNumber(line.quantity),
        unitOfMeasure: line.unitOfMeasureCode || '',
        unitPrice: asNumber(line.unitPrice),
        discountAmount: asNumber(line.discountAmount),
        lineTotal: calculateLineTotal(line),
        lineType: line.lineType || '',
        groupNo: line.usvtGroupNo || meta.groupNo || '',
        refSalesQuoteNo: line.usvtRefSalesQuoteno || '',
        showInDocument: typeof line.showInDocument === 'boolean' ? line.showInDocument : meta.showInDocument !== false,
        printHeader: Boolean(line.printHeader || meta.isHeader),
        printFooter: Boolean(line.printFooter || meta.isFooter)
      };
    })
    .filter(line => line.showInDocument !== false);
}

function buildTotals(formData) {
  const subtotal = (formData.lines || []).reduce((sum, line) => sum + calculateLineTotal(line), 0);
  const tradeDiscount = asNumber(formData.invoiceDiscount);
  const afterDiscount = subtotal - tradeDiscount;
  const vatRate = asNumber(formData.vatRate, 7);
  const vatAmount = afterDiscount * (vatRate / 100);

  return {
    subtotal,
    tradeDiscount,
    vatRate,
    vatAmount,
    grandTotal: afterDiscount + vatAmount
  };
}

function buildCustomerAddress(formData, reportContext) {
  const sellToAddress = joinAddress([
    formData.sellTo?.address,
    formData.sellTo?.address2,
    formData.sellTo?.city,
    formData.sellTo?.postCode
  ]);

  if (sellToAddress) {
    return sellToAddress;
  }

  return Array.isArray(reportContext.customerInfoLines) ? reportContext.customerInfoLines.join(', ') : '';
}

function buildModel() {
  if (!(state.quote.mode === 'edit' && state.quote.number && state.quote.loadedFromBc)) {
    throw new Error('Please search and load a Sales Quote before printing.');
  }

  const formData = getQuoteFormData();
  const reportContext = formData.reportContext || {};
  const totals = buildTotals(formData);
  const paymentText = [
    reportContext.paymentTermsDescription || reportContext.paymentTermsCode || '',
    reportContext.paymentMethodDescription || '',
    reportContext.shipMethodDescription || ''
  ].filter(Boolean).join(' / ');
  const remarks = [
    ...((Array.isArray(reportContext.salesComments) ? reportContext.salesComments : []).map(value => String(value || '').trim()).filter(Boolean)),
    String(formData.workDescription || '').trim()
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  return {
    title: DEFAULT_TITLE,
    quoteNumber: formData.quoteNumber || '',
    documentDate: formatDate(reportContext.documentDate || formData.orderDate),
    quoteValidUntilDate: formatDate(reportContext.quoteValidUntilDate),
    requestedDeliveryDate: formatDate(formData.requestedDeliveryDate || reportContext.requestedDeliveryDate),
    dueDate: formatDate(reportContext.dueDate),
    companyInfoLines: Array.isArray(reportContext.companyInfoLines) && reportContext.companyInfoLines.length
      ? reportContext.companyInfoLines
      : ['Sales Quote'],
    companyLogo: normalizeDataUri(reportContext.companyLogo),
    customerName: formData.customerName || '',
    customerAddress: buildCustomerAddress(formData, reportContext),
    attention: formData.contact || reportContext.billToContact || '',
    phone: state.quote.customer?.phone || reportContext.sellToPhoneNo || '',
    taxId: formData.sellTo?.vatRegNo || reportContext.vatRegistrationNo || '',
    taxBranchNo: formData.sellTo?.taxBranchNo || '',
    faxNo: reportContext.faxNo || '',
    deliveryAddress: reportContext.usvtShipTo
      || joinAddress([reportContext.shipToName, reportContext.shipToAddress, reportContext.shipToContact])
      || buildCustomerAddress(formData, reportContext),
    arCode: reportContext.billToCustomerNo || reportContext.sellToCustomerNo || formData.customerNo || '',
    ourRef: reportContext.externalDocumentNo || formData.quoteNumber || '',
    jobNo: formData.workStatus || reportContext.dimensionName || '',
    paymentText,
    vatLabel: reportContext.vatText || `VAT ${totals.vatRate.toFixed(0)}%`,
    remarks,
    remarkFooter: DEFAULT_REMARK,
    lines: buildPrintableLines(formData, reportContext),
    totals,
    salesperson: {
      name: formData.salespersonName || reportContext.salesperson?.name || '',
      phone: reportContext.salesperson?.phone || '',
      email: reportContext.salesperson?.email || '',
      signature: normalizeDataUri(reportContext.salesperson?.signature)
    },
    approver: {
      name: reportContext.approver?.name || '',
      phone: reportContext.approver?.phone || '',
      email: reportContext.approver?.email || '',
      signature: normalizeDataUri(reportContext.approver?.signature)
    }
  };
}

function renderLineRows(lines) {
  if (!lines.length) {
    return '<tr><td colspan="7" class="empty-row">No printable lines available.</td></tr>';
  }

  return lines.map(line => {
    const isCommentLine = line.lineType === 'Comment';
    const renderAsNote = line.printHeader
      || line.printFooter
      || (isCommentLine && !line.itemNo && line.unitPrice === 0 && line.quantity === 0);

    if (renderAsNote) {
      const prefix = line.groupNo ? `${escapeHtml(line.groupNo)}: ` : '';
      return `
        <tr class="note-row">
          <td class="text-center">${escapeHtml(line.sequence)}</td>
          <td colspan="6">${prefix}${escapeHtml(line.description)}</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td class="text-center">${escapeHtml(line.sequence)}</td>
        <td>
          ${line.itemNo ? `<div class="item-no">${escapeHtml(line.itemNo)}</div>` : ''}
          <div>${escapeHtml(line.description)}</div>
          ${line.refSalesQuoteNo ? `<div class="line-meta">Ref. SQ No.: ${escapeHtml(line.refSalesQuoteNo)}</div>` : ''}
        </td>
        <td class="text-right">${escapeHtml(formatQty(line.quantity))}</td>
        <td class="text-center">${escapeHtml(line.unitOfMeasure)}</td>
        <td class="text-right">${escapeHtml(formatMoneyOrIncluded(line.unitPrice))}</td>
        <td class="text-right">${escapeHtml(formatCurrency(line.discountAmount))}</td>
        <td class="text-right">${escapeHtml(formatMoneyOrIncluded(line.lineTotal))}</td>
      </tr>
    `;
  }).join('');
}

function buildPrintHtml(model) {
  const companyMarkup = model.companyInfoLines.map(line => `<div>${escapeHtml(line)}</div>`).join('');
  const remarksMarkup = model.remarks.length ? model.remarks.map(line => `<div>${escapeHtml(line)}</div>`).join('') : '<div>&nbsp;</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.quoteNumber || 'Sales Quote')} Print</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Tahoma, Arial, sans-serif; font-size: 12px; color: #111827; line-height: 1.45; }
    .page { width: 190mm; margin: 0 auto; }
    .header { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; border-bottom: 1.5px solid #334155; padding-bottom: 10px; margin-bottom: 10px; }
    .company-logo { max-width: 85mm; max-height: 22mm; display: block; margin-bottom: 6px; object-fit: contain; }
    .title { text-align: right; }
    .title h1 { margin: 0 0 8px; font-size: 22px; }
    .info-grid, .signature-grid, .summary-grid { display: grid; gap: 10px; }
    .info-grid { grid-template-columns: 1fr 1fr; margin-bottom: 10px; }
    .summary-grid { grid-template-columns: 1.2fr 0.8fr; margin-top: 12px; }
    .signature-grid { grid-template-columns: 1fr 1fr; margin-top: 12px; }
    .box { border: 1px solid #cbd5e1; padding: 8px 10px; page-break-inside: avoid; }
    .box h2, .box h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; }
    .meta-table, .info-table, .totals-table, .line-table { width: 100%; border-collapse: collapse; }
    .meta-table td, .info-table td, .totals-table td { padding: 3px 0; vertical-align: top; }
    .label { width: 34mm; font-weight: 700; white-space: nowrap; }
    .line-table thead { display: table-header-group; }
    .line-table th, .line-table td { border: 1px solid #94a3b8; padding: 6px 7px; vertical-align: top; }
    .line-table th { background: #e5e7eb; font-size: 11px; text-align: center; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .note-row td { background: #f8fafc; font-style: italic; }
    .item-no, .line-meta, .muted { color: #64748b; font-size: 10px; }
    .empty-row { text-align: center; color: #64748b; padding: 16px 10px; }
    .signature-image { display: block; max-height: 18mm; max-width: 60mm; object-fit: contain; margin-bottom: 6px; }
    .signature-name { margin-top: 18px; padding-top: 6px; border-top: 1px solid #94a3b8; font-weight: 700; }
    .total-row td { padding-top: 8px; border-top: 1px solid #94a3b8; font-size: 14px; font-weight: 700; }
    .remark-footer { margin-top: 10px; font-size: 10px; color: #475569; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        ${model.companyLogo ? `<img class="company-logo" src="${escapeHtml(model.companyLogo)}" alt="Company Logo">` : ''}
        ${companyMarkup}
      </div>
      <div class="title">
        <h1>${escapeHtml(model.title)}</h1>
        <table class="meta-table">
          <tr><td class="label">Quote No.</td><td>${escapeHtml(model.quoteNumber)}</td></tr>
          <tr><td class="label">Date</td><td>${escapeHtml(model.documentDate)}</td></tr>
          <tr><td class="label">Expired Date</td><td>${escapeHtml(model.quoteValidUntilDate)}</td></tr>
          <tr><td class="label">Delivery Date</td><td>${escapeHtml(model.requestedDeliveryDate)}</td></tr>
        </table>
      </div>
    </div>

    <div class="info-grid">
      <section class="box">
        <h2>Customer</h2>
        <table class="info-table">
          <tr><td class="label">Customer</td><td>${escapeHtml(model.customerName)}</td></tr>
          <tr><td class="label">Address</td><td>${escapeHtml(model.customerAddress)}</td></tr>
          <tr><td class="label">Attention</td><td>${escapeHtml(model.attention)}</td></tr>
          <tr><td class="label">Tel</td><td>${escapeHtml(model.phone)}</td></tr>
          <tr><td class="label">Tax ID</td><td>${escapeHtml(model.taxId)}</td></tr>
        </table>
      </section>
      <section class="box">
        <h2>Delivery Address</h2>
        <table class="info-table">
          <tr><td class="label">Delivery Address</td><td>${escapeHtml(model.deliveryAddress)}</td></tr>
          <tr><td class="label">AR Code</td><td>${escapeHtml(model.arCode)}</td></tr>
          <tr><td class="label">Our Ref.</td><td>${escapeHtml(model.ourRef)}</td></tr>
          <tr><td class="label">JOB NO :</td><td>${escapeHtml(model.jobNo)}</td></tr>
          <tr><td class="label">Fax</td><td>${escapeHtml(model.faxNo)}</td></tr>
        </table>
      </section>
    </div>

    <div class="info-grid">
      <section class="box">
        <h2>Payment</h2>
        <table class="info-table">
          <tr><td class="label">Payment</td><td>${escapeHtml(model.paymentText)}</td></tr>
          <tr><td class="label">Tax Branch</td><td>${escapeHtml(model.taxBranchNo)}</td></tr>
          <tr><td class="label">Due Date</td><td>${escapeHtml(model.dueDate)}</td></tr>
        </table>
      </section>
      <section class="box">
        <h2>With By</h2>
        <table class="info-table">
          <tr><td class="label">With By</td><td>${escapeHtml(model.salesperson.name)}</td></tr>
          <tr><td class="label">Tel.</td><td>${escapeHtml(model.salesperson.phone)}</td></tr>
          <tr><td class="label">Email :</td><td>${escapeHtml(model.salesperson.email)}</td></tr>
        </table>
      </section>
    </div>

    <table class="line-table">
      <thead>
        <tr>
          <th style="width: 9%;">Item</th>
          <th style="width: 43%;">Description</th>
          <th style="width: 9%;">Qty</th>
          <th style="width: 8%;">@</th>
          <th style="width: 13%;">Unit/Price</th>
          <th style="width: 9%;">Discount</th>
          <th style="width: 13%;">Total</th>
        </tr>
      </thead>
      <tbody>${renderLineRows(model.lines)}</tbody>
    </table>

    <div class="summary-grid">
      <section class="box">
        <h3>Remark</h3>
        ${remarksMarkup}
        <div class="remark-footer">${escapeHtml(model.remarkFooter)}</div>
      </section>
      <section class="box">
        <h3>Summary</h3>
        <table class="totals-table">
          <tr><td>Sub Total</td><td class="text-right">${escapeHtml(formatCurrency(model.totals.subtotal))}</td></tr>
          <tr><td>Trade Discount</td><td class="text-right">${escapeHtml(formatCurrency(model.totals.tradeDiscount))}</td></tr>
          <tr><td>${escapeHtml(model.vatLabel)}</td><td class="text-right">${escapeHtml(formatCurrency(model.totals.vatAmount))}</td></tr>
          <tr class="total-row"><td>Grand Total</td><td class="text-right">${escapeHtml(formatCurrency(model.totals.grandTotal))}</td></tr>
        </table>
      </section>
    </div>

    <div class="signature-grid">
      <section class="box">
        <h3>With By</h3>
        ${model.salesperson.signature ? `<img class="signature-image" src="${escapeHtml(model.salesperson.signature)}" alt="Salesperson Signature">` : ''}
        <div class="signature-name">${escapeHtml(model.salesperson.name || ' ')}</div>
        <div class="muted">${escapeHtml(model.salesperson.phone)}</div>
        <div class="muted">${escapeHtml(model.salesperson.email)}</div>
      </section>
      <section class="box">
        <h3>Approved</h3>
        ${model.approver.signature ? `<img class="signature-image" src="${escapeHtml(model.approver.signature)}" alt="Approver Signature">` : ''}
        <div class="signature-name">${escapeHtml(model.approver.name || ' ')}</div>
        <div class="muted">${escapeHtml(model.approver.phone)}</div>
        <div class="muted">${escapeHtml(model.approver.email)}</div>
      </section>
    </div>
  </div>
  <script>
    (function () {
      var go = function () { setTimeout(function () { window.print(); }, 180); };
      if (document.readyState === 'complete') { go(); } else { window.addEventListener('load', go, { once: true }); }
    }());
  </script>
</body>
</html>`;
}

export function printSearchedSalesQuote() {
  try {
    const model = buildModel();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Popup was blocked. Please allow popups for this site and try again.');
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintHtml(model));
    printWindow.document.close();
    showToast(`Opening print preview for ${state.quote.number}`, 'success');
  } catch (error) {
    console.error('Unable to print Sales Quote:', error);
    showError(error.message || 'Unable to print Sales Quote right now.');
  }
}

if (typeof window !== 'undefined') {
  window.printSearchedSalesQuote = printSearchedSalesQuote;
}
