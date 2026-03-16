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

const DEFAULT_TITLE = 'ใบเสนอราคา / QUOTATION';
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
  const branchHeader = BRANCH_HEADER_MAP[normalizeBranchCode(branchCode)];
  if (!branchHeader) {
    return [];
  }

  const contactLine = [
    branchHeader.phoneNo ? `Tel. ${branchHeader.phoneNo}` : '',
    branchHeader.faxNo ? `Fax ${branchHeader.faxNo}` : '',
    branchHeader.vatRegistrationNo ? `Tax ID ${branchHeader.vatRegistrationNo}` : ''
  ].filter(Boolean).join(' ');

  return compactLines([
    branchHeader.companyName,
    branchHeader.companyNameEng,
    branchHeader.companyAddress,
    branchHeader.companyAddress2,
    branchHeader.companyAddressEng,
    branchHeader.companyAddressEng2,
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
    vatRate,
    vatAmount,
    grandTotal: afterDiscount + vatAmount
  };
}

function buildCustomerAddressLines(formData, reportContext) {
  const sellToLines = compactLines([
    formData.sellTo?.address,
    formData.sellTo?.address2,
    joinAddress([formData.sellTo?.city, formData.sellTo?.postCode])
  ]);

  if (sellToLines.length) {
    return sellToLines;
  }

  return compactLines(reportContext.customerInfoLines);
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

  return buildCustomerAddressLines(formData, reportContext);
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
  const companyLines = branchHeaderLines.length ? branchHeaderLines : compactLines(reportContext.companyInfoLines);
  const detailNotes = unique(compactLines(reportContext.salesComments));
  const bottomRemark = String(formData.workDescription || '').trim();

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
    customerName: formData.customerName || '',
    customerAddressLines: buildCustomerAddressLines(formData, reportContext),
    ourRef: reportContext.externalDocumentNo || formData.quoteNumber || '',
    documentDate: formatDate(reportContext.documentDate || formData.orderDate),
    expiredDate: formatDate(reportContext.quoteValidUntilDate),
    paymentText: reportContext.paymentTermsCode || reportContext.paymentTermsDescription || '',
    deliveryText: reportContext.requestedDeliveryDate || formData.requestedDeliveryDate || '',
    attention: formData.contact || reportContext.billToContact || '',
    phone: state.quote.customer?.phone || reportContext.sellToPhoneNo || '',
    taxId: formData.sellTo?.vatRegNo || reportContext.vatRegistrationNo || '',
    deliveryAddressLines: buildDeliveryAddressLines(formData, reportContext),
    lineItems: buildPrintableLines(formData, reportContext),
    detailNotes,
    bottomRemark,
    jobNo: formData.workStatus || reportContext.dimensionName || formData.quoteNumber || '',
    totals,
    vatLabel: reportContext.vatText || `VAT ${totals.vatRate.toFixed(0)}%`,
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
    },
    effectiveDate: DEFAULT_EFFECTIVE_DATE,
    documentCode: DEFAULT_DOC_CODE
  };
}

function renderAddressLines(lines, expected = 2) {
  const normalized = [...lines];
  while (normalized.length < expected) {
    normalized.push('');
  }
  return normalized;
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
      const prefix = line.groupNo ? `${escapeHtml(line.groupNo)} ` : '';
      return `
        <tr class="note-row">
          <td></td>
          <td colspan="6">${prefix}${escapeHtml(line.description)}</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td class="seq-cell">${escapeHtml(line.sequence)}</td>
        <td class="desc-cell">
          ${line.itemNo ? `<div class="item-no">${escapeHtml(line.itemNo)}</div>` : ''}
          <div>${escapeHtml(line.description)}</div>
          ${line.refSalesQuoteNo ? `<div class="line-meta">Ref. SQ No.: ${escapeHtml(line.refSalesQuoteNo)}</div>` : ''}
        </td>
        <td class="num-cell">${escapeHtml(formatQty(line.quantity))}</td>
        <td class="unit-cell">${escapeHtml(line.unitOfMeasure)}</td>
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
  const companyMarkup = model.companyLines.slice(2).map(line => `<div>${escapeHtml(line)}</div>`).join('');
  const remarkMarkup = model.bottomRemark
    ? `<div>${escapeHtml(model.bottomRemark)}</div>`
    : '&nbsp;';
  const certificationMarkup = model.certificationLogos
    .map(src => `<img src="${escapeHtml(src)}" alt="" class="cert-logo">`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.ourRef || 'Sales Quote')} Print</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111; font-family: Tahoma, Arial, sans-serif; font-size: 11px; line-height: 1.22; }
    .page { width: 190mm; margin: 0 auto; }
    .topbar { display: grid; grid-template-columns: 33mm 1fr 18mm; align-items: start; column-gap: 6mm; }
    .main-logo { width: 33mm; height: auto; object-fit: contain; }
    .company { padding-top: 1mm; }
    .company .th-name { font-size: 11px; font-weight: 700; margin-bottom: 1mm; }
    .company .en-name { font-size: 11px; font-weight: 700; margin-bottom: 2mm; }
    .company .line { margin-bottom: 0.7mm; }
    .page-no { text-align: right; font-size: 10px; font-weight: 700; padding-top: 1mm; }
    .title-row { position: relative; margin: 4mm 0 3mm; text-align: center; }
    .title { font-size: 13px; font-weight: 700; }
    .certs { position: absolute; right: 0; bottom: -1mm; display: flex; align-items: center; gap: 1.5mm; }
    .cert-logo { height: 7mm; width: auto; object-fit: contain; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
    .meta-table td { padding: 1.1mm 0.9mm 1mm 0; vertical-align: top; }
    .label { width: 19mm; font-weight: 700; white-space: nowrap; }
    .value { width: 74mm; }
    .mid-label { width: 14mm; font-weight: 700; white-space: nowrap; }
    .mid-value { width: 30mm; }
    .right-label { width: 20mm; text-align: right; font-weight: 700; white-space: nowrap; }
    .right-value { width: 28mm; text-align: right; }
    .line-table { width: 100%; border-collapse: collapse; margin-top: 0.5mm; }
    .line-table thead { display: table-header-group; }
    .line-table th { background: #d9d9d9; font-size: 10px; font-weight: 700; padding: 1.8mm 1.6mm; text-align: center; }
    .line-table td { padding: 1.2mm 1.5mm; vertical-align: top; border-bottom: none; }
    .seq-cell { width: 9%; text-align: center; }
    .desc-cell { width: 43%; }
    .num-cell { width: 13%; text-align: right; white-space: nowrap; }
    .unit-cell { width: 8%; text-align: center; white-space: nowrap; }
    .item-no { font-size: 9px; color: #374151; }
    .line-meta { font-size: 9px; color: #6b7280; }
    .note-row td { padding-top: 1.8mm; padding-bottom: 1.2mm; }
    .underline { margin: 0.8mm 0 1.4mm 22mm; width: 39mm; border-top: 1px solid #666; }
    .below-lines { margin-left: 22mm; margin-bottom: 12mm; }
    .below-lines .row { margin-bottom: 2mm; }
    .footer-band { display: grid; grid-template-columns: 1fr 32mm; column-gap: 10mm; align-items: start; margin-top: 4mm; }
    .footer-note { font-size: 9px; }
    .footer-note div { margin-bottom: 1.3mm; }
    .totals { width: 100%; border-collapse: collapse; }
    .totals td { padding: 1mm 0; font-weight: 700; }
    .totals .amount { text-align: right; }
    .remark-job { display: grid; grid-template-columns: 1fr 32mm; column-gap: 10mm; margin-top: 3mm; min-height: 16mm; }
    .remark-box .heading { font-weight: 700; margin-bottom: 2mm; }
    .remark-box .job { margin-top: 4mm; font-weight: 700; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; column-gap: 10mm; margin-top: 4mm; align-items: end; }
    .signature-col { min-height: 31mm; }
    .signature-image { display: block; max-width: 34mm; max-height: 13mm; margin: 0 auto 1.5mm; object-fit: contain; }
    .signer-name { text-align: center; margin-bottom: 1mm; }
    .signature-line { border-top: 1px solid #333; margin-top: 9mm; padding-top: 2mm; text-align: center; }
    .signature-title { text-align: center; font-size: 10px; margin-top: 6mm; }
    .signature-meta { margin-top: 1.8mm; }
    .signature-meta div { margin-bottom: 1mm; }
    .signature-center .signature-title { margin-top: 1mm; }
    .doc-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4mm; font-size: 9px; }
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

    <div class="underline"></div>
    <div class="below-lines">
      ${model.detailNotes.map(line => `<div class="row">${escapeHtml(line)}</div>`).join('')}
    </div>

    <div class="footer-band">
      <div class="footer-note">
        <div>${escapeHtml(DEFAULT_DISCLAIMER_TH)}</div>
        <div>${escapeHtml(DEFAULT_DISCLAIMER_EN)}</div>
      </div>
      <table class="totals">
        <tr><td>Total</td><td class="amount">${escapeHtml(formatCurrency(model.totals.subtotal))}</td></tr>
        <tr><td>Trade Discount</td><td class="amount">${escapeHtml(formatCurrency(model.totals.tradeDiscount))}</td></tr>
        <tr><td>Sub Total</td><td class="amount">${escapeHtml(formatCurrency(model.totals.subtotal))}</td></tr>
        <tr><td>${escapeHtml(model.vatLabel)}</td><td class="amount">${escapeHtml(formatCurrency(model.totals.vatAmount))}</td></tr>
        <tr><td>Grand Total</td><td class="amount">${escapeHtml(formatCurrency(model.totals.grandTotal))}</td></tr>
      </table>
    </div>

    <div class="remark-job">
      <div class="remark-box">
        <div class="heading">Remark</div>
        <div>${remarkMarkup}</div>
        <div class="job">JOB NO : ${escapeHtml(model.jobNo)}</div>
      </div>
      <div></div>
    </div>

    <div class="signature-grid">
      <div class="signature-col">
        <div class="signature-line"></div>
        <div class="signature-title">Customer Confirmed</div>
        <div class="signature-meta">
          <div>Date_____/_____/_____</div>
        </div>
      </div>
      <div class="signature-col signature-center">
        ${model.salesperson.signature ? `<img src="${escapeHtml(model.salesperson.signature)}" alt="With By Signature" class="signature-image">` : ''}
        <div class="signer-name">${escapeHtml(model.salesperson.name)}</div>
        <div class="signature-line"></div>
        <div class="signature-title">With By</div>
        <div class="signature-meta">
          <div>Tel&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(model.salesperson.phone)}</div>
          <div>Email&nbsp;:&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(model.salesperson.email)}</div>
        </div>
      </div>
      <div class="signature-col">
        ${model.approver.signature ? `<img src="${escapeHtml(model.approver.signature)}" alt="Approved Signature" class="signature-image">` : ''}
        <div class="signer-name">${escapeHtml(model.approver.name)}</div>
        <div class="signature-line"></div>
        <div class="signature-title">Approved</div>
        <div class="signature-meta">
          <div>Tel&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(model.approver.phone)}</div>
          <div>Email&nbsp;:&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(model.approver.email)}</div>
        </div>
      </div>
    </div>

    <div class="doc-footer">
      <div>Effective Date : ${escapeHtml(model.effectiveDate)}</div>
      <div>${escapeHtml(model.documentCode)}</div>
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
