import { state } from './state.js';
import { formatCurrency, getQuoteFormData, showError, showToast } from './ui.js';

const ASSET_PATHS = {
  logo: '/salesquotes/components/assets/print/uservices-logo.png',
  easa: '/salesquotes/components/assets/print/easa-logo.jpg',
  sgs: '/salesquotes/components/assets/print/sgs-ukas-logo.png',
  iec: '/salesquotes/components/assets/print/iec-iecex-logo.jpg',
  aemt: '/salesquotes/components/assets/print/aemt-logo.jpg'
};

const BRANCH_HEADER_MAP = {
  USB: {
    description: 'สาขาสระบุรี',
    companyName: 'บริษัท ยู-เซอร์วิสเซส (ประเทศไทย) จำกัด',
    companyAddress: 'เลขที่ 155 หมู่ 10 ต.ตาลเดี่ยว',
    companyAddress2: 'อ.แก่งคอย จ.สระบุรี 18110',
    companyNameEng: 'U-SERVICES (THAILAND) CO.,LTD.',
    companyAddressEng: '155 Moo 10, T.Tan-Dieo,',
    companyAddressEng2: 'A.Kaeng-Khoi, Saraburi',
    vatRegistrationNo: '0215560007917',
    phoneNo: '036-679-609',
    faxNo: ''
  },
  UPB: {
    description: 'สาขาปราจีนบุรี',
    companyName: 'บริษัท ยู-เซอร์วิสเซส (ประเทศไทย) จำกัด',
    companyAddress: 'เลขที่ 229 หมู่ 9 ต.ศรีมหาโพธิ',
    companyAddress2: 'อ.ศรีมหาโพธิ จ.ปราจีนบุรี 25140',
    companyNameEng: 'U-SERVICES (THAILAND) CO.,LTD.',
    companyAddressEng: '229 Moo.9, T.Srimahaphote,',
    companyAddressEng2: 'A.Srimahaphote, Prachinburi',
    vatRegistrationNo: '0215560007917',
    phoneNo: '037-218-989-990',
    faxNo: ''
  },
  UCB: {
    description: 'สาขาชลบุรี',
    companyName: 'บริษัท ยู-เซอร์วิสเซส (ประเทศไทย) จำกัด',
    companyAddress: 'เลขที่ 88/14 หมู่ 7 ต.ทุ่งสุขลา',
    companyAddress2: 'อ.ศรีราชา จ.ชลบุรี 20230',
    companyNameEng: 'U-SERVICES (THAILAND) CO.,LTD.',
    companyAddressEng: '88/14 Moo 7, T.Thungsukla,',
    companyAddressEng2: 'A.Sriracha, Chonburi',
    vatRegistrationNo: '0215560007917',
    phoneNo: '033-135-032',
    faxNo: ''
  },
  USR: {
    description: 'สาขาสุราษฏร์ธานี',
    companyName: 'บริษัท ยู-เซอร์วิสเซส (ประเทศไทย) จำกัด',
    companyAddress: 'เลขที่ 43/9 หมู่ 3 ต.หนองไทร',
    companyAddress2: 'อ.พุนพิน จ.สุราษฏร์ธานี 84130',
    companyNameEng: 'U-SERVICES (THAILAND) CO.,LTD.',
    companyAddressEng: '43/9 Moo.3, T.Nongsai,',
    companyAddressEng2: 'A.Phunphin, Suratthani',
    vatRegistrationNo: '0215560007917',
    phoneNo: '077-310-660',
    faxNo: ''
  },
  UKK: {
    description: 'สาขาขอนแก่น',
    companyName: 'บริษัท ยู-เซอร์วิสเซส (ประเทศไทย) จำกัด',
    companyAddress: 'เลขที่ 301 หมู่ 18 ต.บ้านค้อ',
    companyAddress2: 'อ.เมืองขอนแก่น จ.ขอนแก่น 40000',
    companyNameEng: 'U-SERVICES (THAILAND) CO.,LTD.',
    companyAddressEng: '301 Moo.18, T.Ban kho,',
    companyAddressEng2: 'A.Muang Khonkaen, Khonkaen 40000',
    vatRegistrationNo: '0215560007917',
    phoneNo: '043-423-925',
    faxNo: '043-423-926'
  },
  URY: {
    description: 'สาขาระยอง',
    companyName: 'บริษัท ยู-เซอร์วิสเซส (ประเทศไทย) จำกัด',
    companyAddress: 'เลขที่ 9/9 ซอยคีรี ถ.สุขุมวิท ต.ห้วยโป่ง',
    companyAddress2: 'อ.เมืองระยอง จ.ระยอง 21150',
    companyNameEng: 'U-SERVICES (THAILAND) CO.,LTD.',
    companyAddressEng: '9/9 Soi Kire, Sukhumvit Road,',
    companyAddressEng2: 'T.Huay-pong, A.Muang, Rayong',
    vatRegistrationNo: '0215560007917',
    phoneNo: '033-010-818',
    faxNo: ''
  }
};

const HEAD_OFFICE_BRANCH_CODES = new Set(['URY']);

const DEFAULT_TITLE = 'ใบเสนอราคา/QUOTATION';
const DEFAULT_COMPANY_LINES = [
  'บริษัท ยู-เซอร์วิสเซส (ประเทศไทย) จำกัด (สาขาที่ 00005)',
  'U-SERVICES (THAILAND) CO., LTD. (Branch 00005)',
  '43/9 Moo.3, T.Nongsai, A.Phunphin, Suratthani',
  'เลขที่ 43/9 หมู่ 3 ต.หนองไทร อ.พุนพิน จ.สุราษฎร์ธานี 84130',
  'Tel. 077-310-660 Tax ID 0215556000791'
];
const DEFAULT_DISCLAIMER_TH = '*หากไม่ยืนยันการซ่อมภายใน 90 วัน ทางบริษัทฯ จะไม่รับผิดชอบสินทรัพย์หรือสินค้าใด ๆ ของท่าน';
const DEFAULT_DISCLAIMER_EN = 'If not comfirmed within 90 days to repair the company is not responsible for your goods or any asset.';
const DEFAULT_EFFECTIVE_DATE = '01/04/2023';
const DEFAULT_DOC_CODE = 'CS-FM-RY-004 Rev.00';
const DEFAULT_PAGE_LABEL = 'หน้า 1/1';

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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatUnitOfMeasure(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  if (/^EA\.?$/i.test(normalized)) {
    return 'Ea.';
  }

  return normalized;
}

function formatMoneyOrIncluded(value) {
  const parsed = asNumber(value, NaN);
  if (!Number.isFinite(parsed)) {
    return '';
  }

  return parsed === 0 ? '(Included)' : formatCurrency(parsed);
}

function formatMisRdlUnitPrice(line) {
  // Sale Quote Doc - MIS.rdl displays Unit_Price directly; zero renders as "(Included)".
  return formatMoneyOrIncluded(line.unitPrice);
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

function unique(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function compactLines(values) {
  return values
    .flatMap(value => Array.isArray(value) ? value : [value])
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

function normalizeBranchCode(value) {
  return String(value || '').trim().toUpperCase();
}

function buildBranchHeaderLines(branchCode) {
  const normalizedBranchCode = normalizeBranchCode(branchCode);
  const branchHeader = BRANCH_HEADER_MAP[normalizedBranchCode];
  if (!branchHeader) {
    return [];
  }

  const isHeadOffice = HEAD_OFFICE_BRANCH_CODES.has(normalizedBranchCode);
  const officeLabelTh = isHeadOffice ? 'สำนักงานใหญ่' : branchHeader.description;
  const officeLabelEn = isHeadOffice ? 'Head Office' : '';
  const contactLine = [
    branchHeader.phoneNo ? `Tel. ${branchHeader.phoneNo}` : '',
    branchHeader.faxNo ? `Fax ${branchHeader.faxNo}` : '',
    branchHeader.vatRegistrationNo ? `Tax ID ${branchHeader.vatRegistrationNo}` : ''
  ].filter(Boolean).join(' ');

  return compactLines([
    officeLabelTh ? `${branchHeader.companyName} (${officeLabelTh})` : branchHeader.companyName,
    officeLabelEn ? `${branchHeader.companyNameEng} (${officeLabelEn})` : branchHeader.companyNameEng,
    compactLines([branchHeader.companyAddressEng, branchHeader.companyAddressEng2]).join(' '),
    compactLines([branchHeader.companyAddress, branchHeader.companyAddress2]).join(' '),
    contactLine
  ]);
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
    afterDiscount,
    vatRate,
    vatAmount,
    grandTotal: afterDiscount + vatAmount
  };
}

function buildCustomerAddressLines(formData, reportContext) {
  const reportLines = compactLines(reportContext.customerAddressLines || reportContext.customerInfoLines);
  if (reportLines.length) {
    return reportLines;
  }

  const sellToLines = compactLines([
    formData.sellTo?.address,
    formData.sellTo?.address2,
    joinAddress([formData.sellTo?.city, formData.sellTo?.postCode])
  ]);

  return sellToLines;
}

function buildDeliveryAddressLines(formData, reportContext) {
  if (reportContext.usvtShipTo) {
    return compactLines([reportContext.usvtShipTo]);
  }

  const deliveryLines = compactLines([
    reportContext.shipToName,
    reportContext.shipToAddress,
    reportContext.shipToContact
  ]);

  if (deliveryLines.length) {
    return deliveryLines;
  }

  return [];
}

function buildModel() {
  if (!(state.quote.mode === 'edit' && state.quote.number && state.quote.loadedFromBc)) {
    throw new Error('Please search and load a Sales Quote before printing.');
  }

  const formData = getQuoteFormData();
  const reportContext = formData.reportContext || {};
  const totals = buildTotals(formData);
  const branchCode = normalizeBranchCode(formData.branch || formData.responsibilityCenter || state.quote.branch);
  const branchHeaderLines = buildBranchHeaderLines(branchCode);
  const reportCompanyLines = compactLines(reportContext.companyInfoLines);
  const companyLines = reportCompanyLines.length ? reportCompanyLines : branchHeaderLines;
  const detailNotes = unique(compactLines(reportContext.salesComments));
  const documentRef = formData.quoteNumber || reportContext.documentNo || reportContext.externalDocumentNo || '';
  const requestSignature = reportContext.requestSignature || {};
  const salespersonSignature = normalizeDataUri(requestSignature.signature) || normalizeDataUri(reportContext.salesperson?.signature);
  const approverSignature = normalizeDataUri(reportContext.approver?.signature);

  return {
    title: DEFAULT_TITLE,
    pageLabel: DEFAULT_PAGE_LABEL,
    logoSrc: normalizeDataUri(reportContext.companyLogo) || ASSET_PATHS.logo,
    companyLines: companyLines.length ? companyLines : DEFAULT_COMPANY_LINES,
    certificationLogos: [
      ASSET_PATHS.easa,
      ASSET_PATHS.sgs,
      ASSET_PATHS.iec,
      ASSET_PATHS.aemt
    ],
    arCode: reportContext.billToCustomerNo || reportContext.sellToCustomerNo || formData.customerNo || '',
    customerName: reportContext.customerName || formData.customerName || '',
    customerAddressLines: buildCustomerAddressLines(formData, reportContext),
    ourRef: documentRef,
    documentDate: formatDate(reportContext.documentDate || reportContext.orderDate || formData.orderDate),
    expiredDate: formatDate(reportContext.quoteValidUntilDate),
    paymentText: reportContext.paymentTermsCode || reportContext.paymentTermsDescription || '',
    deliveryText: reportContext.requestedDeliveryDate || formData.requestedDeliveryDate || '',
    attention: formData.contact || reportContext.billToContact || '',
    phone: state.quote.customer?.phone || reportContext.sellToPhoneNo || '',
    taxId: formData.sellTo?.vatRegNo || reportContext.vatRegistrationNo || '',
    deliveryAddressLines: buildDeliveryAddressLines(formData, reportContext),
    lineItems: buildPrintableLines(formData, reportContext),
    detailNotes,
    bottomRemark: '',
    jobNo: reportContext.dimensionName || formData.workStatus || documentRef || '',
    totals,
    vatLabel: reportContext.vatText || `VAT ${totals.vatRate.toFixed(0)}%`,
    salesperson: {
      name: requestSignature.name || reportContext.salesperson?.name || formData.salespersonName || '',
      phone: requestSignature.phone || reportContext.salesperson?.phone || '',
      email: requestSignature.email || reportContext.salesperson?.email || '',
      signature: salespersonSignature
    },
    approver: {
      name: reportContext.approver?.name || '',
      phone: reportContext.approver?.phone || '',
      email: reportContext.approver?.email || '',
      signature: approverSignature
    },
    effectiveDate: DEFAULT_EFFECTIVE_DATE,
    documentCode: DEFAULT_DOC_CODE
  };
}

function renderAddressLines(lines, expected = 2) {
  const normalized = [...lines].map(line => String(line || '').trim()).filter(Boolean);

  if (normalized.length > expected) {
    const head = normalized.slice(0, expected - 1);
    const tail = normalized.slice(expected - 1).join(' ');
    normalized.splice(0, normalized.length, ...head, tail);
  }

  while (normalized.length < expected) {
    normalized.push('');
  }
  return normalized;
}

function renderLineRows(lines) {
  const printableLines = lines.filter(line => {
    const isCommentLine = line.lineType === 'Comment';
    return !(line.printHeader
      || line.printFooter
      || (isCommentLine && !line.itemNo && line.unitPrice === 0 && line.quantity === 0));
  });

  if (!printableLines.length) {
    return '<tr><td colspan="7" class="empty-row">No printable lines available.</td></tr>';
  }

  return printableLines.map(line => {
    return `
      <tr>
        <td class="seq-cell"></td>
        <td class="desc-cell">
          <div>${escapeHtml(line.description)}</div>
        </td>
        <td class="num-cell">${escapeHtml(formatQty(line.quantity))}</td>
        <td class="unit-cell">${escapeHtml(formatUnitOfMeasure(line.unitOfMeasure))}</td>
        <td class="num-cell">${escapeHtml(formatMisRdlUnitPrice(line))}</td>
        <td class="num-cell">${escapeHtml(formatCurrency(line.discountAmount))}</td>
        <td class="num-cell">${escapeHtml(formatMoneyOrIncluded(line.lineTotal))}</td>
      </tr>
    `;
  }).join('');
}

function buildPrintHtml(model) {
  const customerAddressLines = renderAddressLines(model.customerAddressLines, 2);
  const deliveryAddressLines = renderAddressLines(model.deliveryAddressLines, 2);
  const companyMarkup = model.companyLines.slice(2).map(line => `<div class="company-line">${escapeHtml(line)}</div>`).join('');
  const remarkMarkup = model.bottomRemark
    ? escapeHtml(model.bottomRemark)
    : '&nbsp;';
  const certificationMarkup = model.certificationLogos
    .map(src => `<img src="${escapeHtml(src)}" alt="" class="cert-logo">`)
    .join('');
  const detailNotesMarkup = model.detailNotes
    .map(line => `<div class="note-row-text">${escapeHtml(line)}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.ourRef || 'Sales Quote')} Print</title>
  <style>
    @page { size: A4; margin: 8mm 10mm 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #fff; color: #111827; font-family: Tahoma, Arial, sans-serif; font-size: 11px; line-height: 1.28; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page {
      width: 190mm;
      min-height: 277mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
    }
    .topbar { display: grid; grid-template-columns: 30mm 1fr 18mm; align-items: start; column-gap: 4mm; }
    .main-logo { width: 28mm; height: auto; object-fit: contain; margin-top: 0.4mm; }
    .company { padding-top: 0.3mm; line-height: 1.2; }
    .company .th-name { font-size: 16px; font-weight: 700; margin-bottom: 0.35mm; }
    .company .en-name { font-size: 14.8px; font-weight: 700; margin-bottom: 1.1mm; }
    .company-line { font-size: 12px; margin-bottom: 0.45mm; }
    .page-no { text-align: right; font-size: 12px; font-weight: 700; white-space: nowrap; padding-top: 0.5mm; }
    .title-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      margin: 4.2mm 0 2.7mm;
      column-gap: 3mm;
    }
    .title-row .spacer { min-height: 1px; }
    .title { font-size: 14.8px; font-weight: 700; white-space: nowrap; }
    .certs { display: flex; justify-content: flex-end; align-items: center; gap: 0.9mm; min-height: 6mm; }
    .cert-logo { height: 5.4mm; width: auto; object-fit: contain; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 2.5mm; font-size: 10.8px; line-height: 1.22; }
    .meta-table td { padding: 0 0.8mm 1.25mm 0; vertical-align: top; }
    .label { width: 18mm; font-weight: 700; white-space: nowrap; }
    .value { width: 86mm; }
    .mid-label { width: 12mm; font-weight: 700; white-space: nowrap; }
    .mid-value { width: 32mm; }
    .right-label { width: 19mm; text-align: right; font-weight: 700; white-space: nowrap; padding-right: 1.4mm; }
    .right-value { width: 24mm; text-align: right; white-space: nowrap; }
    .line-table { width: 100%; border-collapse: collapse; margin-top: 0.8mm; table-layout: fixed; }
    .line-table thead { display: table-header-group; }
    .line-table th {
      background: #d9d9d9;
      color: #111827;
      font-size: 12px;
      font-weight: 700;
      padding: 1.35mm 0.9mm;
      text-align: center;
    }
    .line-table td {
      padding: 1.2mm 0.9mm 0.95mm;
      vertical-align: top;
      border-bottom: none;
      font-size: 10.8px;
    }
    .line-table tr { page-break-inside: avoid; }
    .seq-cell { width: 9%; text-align: center; color: transparent; }
    .desc-cell { width: 43%; }
    .num-cell { width: 12%; text-align: right; white-space: nowrap; }
    .unit-cell { width: 7%; text-align: center; white-space: nowrap; }
    .item-no { font-size: 10.8px; color: #374151; margin-bottom: 0.3mm; }
    .line-meta { font-size: 10.8px; color: #4b5563; margin-top: 0.4mm; }
    .note-row td { padding-top: 1.6mm; padding-bottom: 1mm; }
    .notes-block { margin-top: 1.8mm; }
    .note-row-text { margin-bottom: 1.2mm; }
    .footer-stack { margin-top: auto; padding-top: 5.6mm; }
    .footer-divider { border-top: 1px solid #111827; margin-bottom: 1.5mm; }
    .summary-grid { display: grid; grid-template-columns: 1fr 42mm; column-gap: 6mm; align-items: start; }
    .footer-note { font-size: 10.2px; line-height: 1.28; }
    .footer-note div { margin-bottom: 0.95mm; }
    .footer-note .thai { font-weight: 700; }
    .totals { width: 100%; border-collapse: collapse; }
    .totals td { padding: 0 0 1.4mm; font-size: 10.8px; font-weight: 700; vertical-align: top; }
    .totals .label-cell { white-space: nowrap; }
    .totals .amount { text-align: right; padding-left: 4mm; white-space: nowrap; }
    .remark-section { margin-top: 2mm; font-size: 10.8px; }
    .remark-row,
    .job-row {
      display: grid;
      grid-template-columns: 16mm 1fr;
      column-gap: 2mm;
      align-items: start;
    }
    .remark-row { min-height: 4.4mm; }
    .remark-label,
    .job-label { font-weight: 700; }
    .remark-value { white-space: pre-wrap; word-break: break-word; }
    .job-row { margin-top: 0.8mm; font-weight: 700; }
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      column-gap: 14mm;
      margin-top: 5.2mm;
      align-items: stretch;
    }
    .signature-col {
      min-height: 29mm;
      display: flex;
      flex-direction: column;
      padding: 0;
    }
    .signature-preline {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      min-height: 9mm;
    }
    .signature-image { display: block; max-width: 26mm; max-height: 10mm; margin: 0 auto 0.2mm; object-fit: contain; }
    .signer-name { text-align: center; min-height: 4mm; margin-bottom: 0.6mm; font-size: 10.8px; }
    .signature-line { width: 72%; margin: 0 auto; border-top: 1px solid #111827; padding-top: 1.2mm; text-align: center; }
    .signature-footer { min-height: 12mm; }
    .signature-title { text-align: center; font-size: 10.8px; margin-top: 1.5mm; }
    .signature-meta { margin: 0.8mm auto 0; width: 84%; min-height: 6.6mm; font-size: 10px; }
    .signature-meta div { margin-bottom: 0.7mm; min-height: 3.2mm; }
    .signature-meta div:last-child { margin-bottom: 0; }
    .signature-meta-spacer { visibility: hidden; }
    .signature-customer .signature-meta { width: 72%; }
    .doc-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 3.8mm; font-size: 10px; }
    .empty-row { text-align: center; color: #666; padding: 6mm 0; }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <img src="${escapeHtml(model.logoSrc)}" alt="U-Services" class="main-logo">
      <div class="company">
        <div class="th-name">${escapeHtml(model.companyLines[0] || DEFAULT_COMPANY_LINES[0])}</div>
        <div class="en-name">${escapeHtml(model.companyLines[1] || DEFAULT_COMPANY_LINES[1])}</div>
        ${companyMarkup}
      </div>
      <div class="page-no">${escapeHtml(model.pageLabel)}</div>
    </div>

    <div class="title-row">
      <div class="spacer"></div>
      <div class="title">${escapeHtml(model.title)}</div>
      <div class="certs">${certificationMarkup}</div>
    </div>

    <table class="meta-table">
      <tr>
        <td class="label">AR Code</td>
        <td class="value">${escapeHtml(model.arCode)}</td>
        <td class="mid-label"></td>
        <td class="mid-value"></td>
        <td class="right-label">Our Ref.</td>
        <td class="right-value">${escapeHtml(model.ourRef)}</td>
      </tr>
      <tr>
        <td class="label">Customer</td>
        <td class="value">${escapeHtml(model.customerName)}</td>
        <td class="mid-label"></td>
        <td class="mid-value"></td>
        <td class="right-label">Date</td>
        <td class="right-value">${escapeHtml(model.documentDate)}</td>
      </tr>
      <tr>
        <td class="label">Address</td>
        <td class="value">${escapeHtml(customerAddressLines[0])}</td>
        <td class="mid-label">Attention</td>
        <td class="mid-value">${escapeHtml(model.attention)}</td>
        <td class="right-label">Expired Date</td>
        <td class="right-value">${escapeHtml(model.expiredDate)}</td>
      </tr>
      <tr>
        <td class="label"></td>
        <td class="value">${escapeHtml(customerAddressLines[1])}</td>
        <td class="mid-label">Tel.</td>
        <td class="mid-value">${escapeHtml(model.phone)}</td>
        <td class="right-label">Payment</td>
        <td class="right-value">${escapeHtml(model.paymentText)}</td>
      </tr>
      <tr>
        <td class="label">Tax ID</td>
        <td class="value">${escapeHtml(model.taxId)}</td>
        <td class="mid-label"></td>
        <td class="mid-value"></td>
        <td class="right-label">Delivery Date</td>
        <td class="right-value">${escapeHtml(model.deliveryText)}</td>
      </tr>
      <tr>
        <td class="label">Delivery Address</td>
        <td class="value">${escapeHtml(deliveryAddressLines[0])}</td>
        <td class="mid-label"></td>
        <td class="mid-value"></td>
        <td class="right-label"></td>
        <td class="right-value"></td>
      </tr>
      <tr>
        <td class="label"></td>
        <td class="value">${escapeHtml(deliveryAddressLines[1])}</td>
        <td class="mid-label"></td>
        <td class="mid-value"></td>
        <td class="right-label"></td>
        <td class="right-value"></td>
      </tr>
    </table>

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
      <tbody>${renderLineRows(model.lineItems)}</tbody>
    </table>

    ${detailNotesMarkup ? `
    <div class="notes-block">
      ${detailNotesMarkup}
    </div>
    ` : ''}

    <div class="footer-stack">
      <div class="footer-divider"></div>

      <div class="summary-grid">
        <div class="footer-note">
          <div class="thai">${escapeHtml(DEFAULT_DISCLAIMER_TH)}</div>
          <div>${escapeHtml(DEFAULT_DISCLAIMER_EN)}</div>
        </div>
        <table class="totals">
          <tr><td class="label-cell">Total</td><td class="amount">${escapeHtml(formatCurrency(model.totals.subtotal))}</td></tr>
          <tr><td class="label-cell">Trade Discount</td><td class="amount">${escapeHtml(formatCurrency(model.totals.tradeDiscount))}</td></tr>
          <tr><td class="label-cell">Sub Total</td><td class="amount">${escapeHtml(formatCurrency(model.totals.afterDiscount))}</td></tr>
          <tr><td class="label-cell">${escapeHtml(model.vatLabel)}</td><td class="amount">${escapeHtml(formatCurrency(model.totals.vatAmount))}</td></tr>
          <tr><td class="label-cell">Grand Total</td><td class="amount">${escapeHtml(formatCurrency(model.totals.grandTotal))}</td></tr>
        </table>
      </div>

      <div class="remark-section">
        <div class="remark-row">
          <div class="remark-label">Remark</div>
          <div class="remark-value">${remarkMarkup}</div>
        </div>
        <div class="job-row">
          <div class="job-label">JOB NO</div>
          <div>: ${escapeHtml(model.jobNo)}</div>
        </div>
      </div>

      <div class="signature-grid">
        <div class="signature-col signature-customer">
          <div class="signature-preline"></div>
          <div class="signature-line"></div>
          <div class="signature-footer">
            <div class="signature-title">Customer Confirmed</div>
            <div class="signature-meta">
              <div>Date_____/_____/_____</div>
              <div class="signature-meta-spacer">.</div>
            </div>
          </div>
        </div>
        <div class="signature-col">
          <div class="signature-preline">
            ${model.salesperson.signature ? `<img src="${escapeHtml(model.salesperson.signature)}" alt="With By Signature" class="signature-image">` : ''}
            <div class="signer-name">${escapeHtml(model.salesperson.name)}</div>
          </div>
          <div class="signature-line"></div>
          <div class="signature-footer">
            <div class="signature-title">With By</div>
            <div class="signature-meta">
              <div>Tel&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(model.salesperson.phone)}</div>
              <div>Email&nbsp;:&nbsp;${escapeHtml(model.salesperson.email)}</div>
            </div>
          </div>
        </div>
        <div class="signature-col">
          <div class="signature-preline">
            ${model.approver.signature ? `<img src="${escapeHtml(model.approver.signature)}" alt="Approved Signature" class="signature-image">` : ''}
            <div class="signer-name">${escapeHtml(model.approver.name)}</div>
          </div>
          <div class="signature-line"></div>
          <div class="signature-footer">
            <div class="signature-title">Approved</div>
            <div class="signature-meta">
              <div>Tel&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(model.approver.phone)}</div>
              <div>Email&nbsp;:&nbsp;${escapeHtml(model.approver.email)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="doc-footer">
        <div>Effective Date : ${escapeHtml(model.effectiveDate)}</div>
        <div>${escapeHtml(model.documentCode)}</div>
      </div>
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
