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
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const normalized = typeof value === 'string'
    ? value.replace(/,/g, '').trim()
    : value;
  const parsed = Number(normalized);
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

function resolveLineAmount(line, fallback = 0) {
  const candidates = [
    line?.amountExcludingTax,
    line?.lineAmount,
    line?.amount,
    line?.total,
    line?.lineTotal
  ];

  for (const candidate of candidates) {
    const parsed = asNumber(candidate, NaN);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
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

function normalizeComparableText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[,:;.-]/g, '')
    .trim()
    .toLowerCase();
}

function comparableLineSetsMatch(leftLines, rightLines) {
  const left = compactLines(leftLines).map(normalizeComparableText).filter(Boolean);
  const right = compactLines(rightLines).map(normalizeComparableText).filter(Boolean);

  if (!left.length || !right.length || left.length !== right.length) {
    return false;
  }

  return left.every((line, index) => line === right[index]);
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
      const calculatedLineTotal = calculateLineTotal(line);
      const resolvedLineTotal = resolveLineAmount(line, NaN);
      const metaLineTotal = resolveLineAmount(meta, NaN);

      return {
        sequence: line.sequence || index + 1,
        itemNo: line.lineObjectNumber || '',
        description: line.description || '',
        description2: line.description2 || meta.description2 || '',
        quantity: asNumber(line.quantity),
        unitOfMeasure: line.unitOfMeasureCode || '',
        unitPrice: asNumber(line.unitPrice),
        discountAmount: asNumber(line.discountAmount),
        lineTotal: Number.isFinite(resolvedLineTotal)
          ? resolvedLineTotal
          : (Number.isFinite(metaLineTotal) ? metaLineTotal : calculatedLineTotal),
        amountExcludingTax: Number.isFinite(resolvedLineTotal)
          ? resolvedLineTotal
          : (Number.isFinite(metaLineTotal) ? metaLineTotal : calculatedLineTotal),
        lineType: line.lineType || '',
        rawType: line.rawType || meta.rawType || '',
        groupNo: line.usvtGroupNo || meta.groupNo || '',
        refSalesQuoteNo: line.usvtRefSalesQuoteno || '',
        showInDocument: typeof line.showInDocument === 'boolean' ? line.showInDocument : meta.showInDocument !== false,
        printHeader: Boolean(line.printHeader || meta.isHeader),
        printFooter: Boolean(line.printFooter || meta.isFooter)
      };
    })
    .filter(line => line.showInDocument !== false);
}

function buildTotals(formData, reportContext = {}) {
  const subtotal = (formData.lines || []).reduce((sum, line) => sum + calculateLineTotal(line), 0);
  const tradeDiscount = asNumber(formData.invoiceDiscount);
  const afterDiscount = subtotal - tradeDiscount;
  const vatRate = asNumber(formData.vatRate, 7);
  const vatAmount = afterDiscount * (vatRate / 100);
  const reportTotals = reportContext.reportTotals || {};

  return {
    subtotal: asNumber(reportTotals.totalAmt1, subtotal),
    tradeDiscount: asNumber(reportTotals.totalAmt2, tradeDiscount),
    afterDiscount: asNumber(reportTotals.totalAmt3, afterDiscount),
    vatRate,
    vatAmount: asNumber(reportTotals.totalAmt4, vatAmount),
    grandTotal: asNumber(reportTotals.totalAmt5, afterDiscount + vatAmount)
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

function buildDeliveryAddressLines(formData, reportContext, customerName = '', customerAddressLines = []) {
  const deliveryLines = reportContext.usvtShipTo
    ? compactLines([reportContext.usvtShipTo])
    : compactLines([
      reportContext.shipToName,
      reportContext.shipToAddress,
      reportContext.shipToContact
    ]);

  if (!deliveryLines.length) {
    return [];
  }

  const normalizedCustomerName = normalizeComparableText(customerName);
  const normalizedDeliveryLines = deliveryLines.map(normalizeComparableText).filter(Boolean);
  const normalizedCustomerLines = compactLines([
    customerName,
    ...customerAddressLines
  ]).map(normalizeComparableText).filter(Boolean);

  if (
    (normalizedDeliveryLines.length === 1 && normalizedDeliveryLines[0] === normalizedCustomerName)
    || comparableLineSetsMatch(deliveryLines, customerAddressLines)
    || comparableLineSetsMatch(deliveryLines, [customerName, ...customerAddressLines])
    || comparableLineSetsMatch(normalizedDeliveryLines, normalizedCustomerLines)
  ) {
    return [];
  }

  return deliveryLines;
}

function buildModel() {
  if (!(state.quote.mode === 'edit' && state.quote.number && state.quote.loadedFromBc)) {
    throw new Error('Please search and load a Sales Quote before printing.');
  }

  const formData = getQuoteFormData();
  const reportContext = formData.reportContext || {};
  const totals = buildTotals(formData, reportContext);
  const branchCode = normalizeBranchCode(formData.branch || formData.responsibilityCenter || state.quote.branch);
  const branchHeaderLines = buildBranchHeaderLines(branchCode);
  const reportCompanyLines = compactLines(reportContext.companyInfoLines);
  const companyLines = reportCompanyLines.length ? reportCompanyLines : branchHeaderLines;
  const detailNotes = unique(compactLines(reportContext.salesComments));
  const documentRef = formData.quoteNumber || reportContext.documentNo || reportContext.externalDocumentNo || '';
  const requestSignature = reportContext.requestSignature || {};
  const salespersonSignature = normalizeDataUri(requestSignature.signature) || normalizeDataUri(reportContext.salesperson?.signature);
  const approverSignature = normalizeDataUri(reportContext.approver?.signature);
  const customerName = reportContext.customerName || formData.customerName || '';
  const customerAddressLines = buildCustomerAddressLines(formData, reportContext);
  const deliveryAddressLines = buildDeliveryAddressLines(formData, reportContext, customerName, customerAddressLines);

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
    customerName,
    customerAddressLines,
    ourRef: documentRef,
    documentDate: formatDate(reportContext.documentDate || reportContext.orderDate || formData.orderDate),
    expiredDate: formatDate(reportContext.quoteValidUntilDate),
    paymentText: reportContext.paymentTermsCode || reportContext.paymentTermsDescription || '',
    deliveryText: formatDate(reportContext.requestedDeliveryDate || formData.requestedDeliveryDate),
    attention: formData.contact || reportContext.billToContact || '',
    phone: state.quote.customer?.phone || reportContext.sellToPhoneNo || '',
    taxId: formData.sellTo?.vatRegNo || reportContext.vatRegistrationNo || '',
    deliveryAddressLines,
    lineItems: buildPrintableLines(formData, reportContext),
    detailNotes: [],
    bottomRemark: detailNotes.join(' '),
    jobNo: documentRef,
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
  const normalized = compactLines(lines);

  while (normalized.length < expected) {
    normalized.push('');
  }

  return normalized;
}

function renderMetaRows(model, customerAddressLines, deliveryAddressLines) {
  const customerRows = customerAddressLines.map((line, index) => `
    <tr>
      <td class="label">${index === 0 ? 'Address' : ''}</td>
      <td class="value">${escapeHtml(line)}</td>
      <td class="mid-label"></td>
      <td class="mid-value"></td>
      <td class="right-label">${index === 0 ? 'Our Ref.' : index === 1 ? 'Date' : ''}</td>
      <td class="right-value">${index === 0 ? escapeHtml(model.ourRef) : index === 1 ? escapeHtml(model.documentDate) : ''}</td>
    </tr>
  `).join('');

  const deliveryRows = deliveryAddressLines.map((line, index) => `
    <tr>
      <td class="label">${index === 0 ? 'Delivery Address' : ''}</td>
      <td class="value">${escapeHtml(line)}</td>
      <td class="mid-label">${index === 0 ? 'Tel.' : ''}</td>
      <td class="mid-value">${index === 0 ? escapeHtml(model.phone) : ''}</td>
      <td class="right-label">${index === 0 ? 'Delivery Date' : ''}</td>
      <td class="right-value">${index === 0 ? escapeHtml(model.deliveryText) : ''}</td>
    </tr>
  `).join('');

  return `
    <tr class="meta-divider">
      <td class="label">AR Code</td>
      <td class="value">${escapeHtml(model.arCode)}</td>
      <td class="mid-label"></td>
      <td class="mid-value"></td>
      <td class="right-label"></td>
      <td class="right-value"></td>
    </tr>
    <tr>
      <td class="label">Customer</td>
      <td class="value">${escapeHtml(model.customerName)}</td>
      <td class="mid-label"></td>
      <td class="mid-value"></td>
      <td class="right-label"></td>
      <td class="right-value"></td>
    </tr>
    ${customerRows}
    <tr>
      <td class="label"></td>
      <td class="value"></td>
      <td class="mid-label">Attention</td>
      <td class="mid-value">${escapeHtml(model.attention)}</td>
      <td class="right-label">Expired Date</td>
      <td class="right-value">${escapeHtml(model.expiredDate)}</td>
    </tr>
    <tr>
      <td class="label">Tax ID</td>
      <td class="value">${escapeHtml(model.taxId)}</td>
      <td class="mid-label"></td>
      <td class="mid-value"></td>
      <td class="right-label">Payment</td>
      <td class="right-value">${escapeHtml(model.paymentText)}</td>
    </tr>
    ${deliveryRows}
  `;
}

function renderLineRows(lines) {
  const printableLines = lines.filter(line => line.showInDocument !== false);

  if (!printableLines.length) {
    return '<tr><td colspan="7" class="empty-row">No printable lines available.</td></tr>';
  }

  const renderContinuationRows = (description) => {
    return compactLines(
      Array.isArray(description)
        ? description.flatMap(text => String(text || '').split(/\r?\n/))
        : String(description || '').split(/\r?\n/)
    )
      .map(text => `
        <tr class="line-comment-row">
          <td class="item-cell"></td>
          <td class="desc-cell">${escapeHtml(text)}</td>
          <td class="qty-cell"></td>
          <td class="unit-cell"></td>
          <td class="num-cell"></td>
          <td class="num-cell"></td>
          <td class="num-cell"></td>
        </tr>
      `)
      .join('');
  };

  return printableLines.map(line => {
    const descriptionLines = compactLines(String(line.description || '').split(/\r?\n/));
    const primaryDescription = descriptionLines.shift() || '';
    const continuationMarkup = renderContinuationRows([
      ...descriptionLines,
      ...compactLines(String(line.description2 || '').split(/\r?\n/))
    ]);
    const isCommentLine = line.lineType === 'Comment';
    const hasLineAmounts = Boolean(
      line.itemNo
      || asNumber(line.quantity, 0) !== 0
      || asNumber(line.unitPrice, 0) !== 0
      || asNumber(line.discountAmount, 0) !== 0
      || asNumber(line.lineTotal, 0) !== 0
    );

    if (line.printFooter) {
      return `
        <tr class="line-footer-row">
          <td class="item-cell"></td>
          <td class="desc-cell">${primaryDescription ? escapeHtml(primaryDescription) : '&nbsp;'}</td>
          <td class="qty-cell"></td>
          <td class="unit-cell"></td>
          <td class="num-cell"></td>
          <td class="footer-label-cell">Total</td>
          <td class="num-cell">${escapeHtml(formatMoneyOrIncluded(resolveLineAmount(line, 0)))}</td>
        </tr>
      `;
    }

    if (line.printHeader && !hasLineAmounts) {
      return `
        <tr class="line-section-row">
          <td class="item-cell"></td>
          <td class="desc-cell">${escapeHtml(primaryDescription)}</td>
          <td class="qty-cell"></td>
          <td class="unit-cell"></td>
          <td class="num-cell"></td>
          <td class="num-cell"></td>
          <td class="num-cell"></td>
        </tr>
        ${continuationMarkup}
      `;
    }

    if (isCommentLine && !hasLineAmounts) {
      return renderContinuationRows([
        primaryDescription,
        ...descriptionLines,
        ...compactLines(String(line.description2 || '').split(/\r?\n/))
      ]);
    }

    return `
      <tr class="line-main-row">
        <td class="item-cell">${escapeHtml(line.itemNo)}</td>
        <td class="desc-cell">${escapeHtml(primaryDescription)}</td>
        <td class="qty-cell">${escapeHtml(formatQty(line.quantity))}</td>
        <td class="unit-cell">${escapeHtml(formatUnitOfMeasure(line.unitOfMeasure))}</td>
        <td class="num-cell">${escapeHtml(formatMisRdlUnitPrice(line))}</td>
        <td class="num-cell">${escapeHtml(formatCurrency(line.discountAmount))}</td>
        <td class="num-cell">${escapeHtml(formatMoneyOrIncluded(resolveLineAmount(line, 0)))}</td>
      </tr>
      ${continuationMarkup}
    `;
  }).join('');
}

function buildPrintHtml(model) {
  const customerAddressLines = renderAddressLines(model.customerAddressLines, 2);
  const deliveryAddressLines = renderAddressLines(model.deliveryAddressLines, 1);
  const metaRowsMarkup = renderMetaRows(model, customerAddressLines, deliveryAddressLines);
  const companyMarkup = model.companyLines.slice(2).map(line => `<div class="company-line">${escapeHtml(line)}</div>`).join('');
  const remarkMarkup = model.bottomRemark
    ? escapeHtml(model.bottomRemark)
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
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #fff; color: #000; font-family: Tahoma, Arial, sans-serif; font-size: 11px; line-height: 1.22; }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 8.5mm 9mm 8mm;
    }
    .page {
      width: 192mm;
      min-height: 279mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
    }
    .topbar { display: grid; grid-template-columns: 30mm 1fr 23mm; align-items: start; column-gap: 4.2mm; }
    .main-logo { width: 28mm; height: auto; object-fit: contain; margin-top: 1.1mm; }
    .company { padding-top: 0.5mm; }
    .company .th-name { font-size: 15px; font-weight: 700; line-height: 1.08; margin-bottom: 1mm; }
    .company .en-name { font-size: 14px; font-weight: 700; line-height: 1.08; margin-bottom: 1.6mm; }
    .company-line { font-size: 10.2px; line-height: 1.24; margin-bottom: 0.48mm; }
    .page-no { text-align: right; font-size: 10.8px; font-weight: 700; white-space: nowrap; padding-top: 1.2mm; }
    .title-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      margin: 7mm 0 3.1mm;
      column-gap: 2.8mm;
    }
    .title-row .spacer { min-height: 1px; }
    .title { font-size: 13px; font-weight: 700; white-space: nowrap; }
    .certs { display: flex; justify-content: flex-end; align-items: flex-end; gap: 1mm; min-height: 7.5mm; }
    .cert-logo { height: 7.1mm; width: auto; object-fit: contain; }
    .meta-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 3.3mm; font-size: 9.5px; line-height: 1.18; }
    .meta-table td { padding: 0 1mm 0.62mm 0; vertical-align: top; }
    .meta-table .meta-divider td {
      border-bottom: 1px solid #000;
      padding-bottom: 0.95mm;
    }
    .label { font-weight: 700; white-space: nowrap; }
    .value { word-break: break-word; }
    .mid-label { font-weight: 700; white-space: nowrap; text-align: right; padding-right: 1.2mm; }
    .mid-value { word-break: break-word; }
    .right-label { text-align: right; font-weight: 700; white-space: nowrap; padding-right: 1.2mm; }
    .right-value { text-align: right; white-space: nowrap; }
    .line-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 1.2mm; table-layout: fixed; font-size: 9.9px; }
    .line-table thead { display: table-header-group; }
    .line-table th {
      background: #d9d9d9;
      color: #000;
      font-size: 10.6px;
      font-weight: 700;
      padding: 1.45mm 0.85mm;
      text-align: center;
    }
    .line-table th:first-child,
    .line-table th:nth-child(2) { text-align: left; }
    .line-table td {
      padding: 0.7mm 0.85mm;
      vertical-align: top;
    }
    .line-table tr { page-break-inside: avoid; }
    .item-cell { white-space: nowrap; text-align: left; }
    .desc-cell { word-break: break-word; padding-left: 0.5mm; }
    .qty-cell,
    .num-cell { text-align: right; white-space: nowrap; }
    .unit-cell { text-align: center; white-space: nowrap; }
    .line-main-row td { min-height: 5.8mm; }
    .line-section-row td { padding-top: 0.95mm; padding-bottom: 0.55mm; font-weight: 400; }
    .line-section-row .desc-cell { padding-left: 4mm; }
    .line-comment-row td { padding-top: 0.12mm; padding-bottom: 0.45mm; }
    .line-comment-row .desc-cell { padding-left: 4mm; }
    .line-footer-row td { padding-top: 1.1mm; padding-bottom: 0.75mm; }
    .footer-label-cell { font-weight: 700; text-align: left; }
    .footer-stack { margin-top: auto; padding-top: 6.6mm; }
    .footer-divider { border-top: 1px solid #000; margin-bottom: 1.35mm; }
    .summary-grid { display: grid; grid-template-columns: 1fr 63mm; column-gap: 4.5mm; align-items: start; }
    .summary-left { min-width: 0; }
    .footer-note { font-size: 9.1px; line-height: 1.28; }
    .footer-note div { margin-bottom: 0.55mm; }
    .footer-note .thai { font-weight: 700; }
    .totals { width: 100%; border-collapse: separate; border-spacing: 0 0.45mm; table-layout: fixed; }
    .totals td { padding: 0.18mm 0; font-size: 9.6px; font-weight: 700; vertical-align: top; }
    .totals .label-cell { width: 56%; white-space: nowrap; padding-right: 4.5mm; }
    .totals .amount { width: 44%; text-align: right; white-space: nowrap; }
    .remark-section { margin-top: 3.1mm; font-size: 9.9px; }
    .remark-row,
    .job-row {
      display: grid;
      grid-template-columns: 15mm 1fr;
      column-gap: 2mm;
      align-items: start;
    }
    .remark-row { min-height: 4.8mm; }
    .remark-label,
    .job-label { font-weight: 700; }
    .remark-value { white-space: pre-wrap; word-break: break-word; }
    .job-row { margin-top: 1.2mm; font-weight: 700; }
    .signature-grid {
      display: grid;
      grid-template-columns: 49mm 57mm 53mm;
      justify-content: space-between;
      column-gap: 0;
      margin-top: 7.2mm;
      align-items: end;
    }
    .signature-col {
      min-height: 47mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }
    .signature-sign {
      min-height: 19mm;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .signature-image { display: block; max-width: 44mm; max-height: 18mm; object-fit: contain; }
    .signature-line { width: 100%; border-top: 1px solid #000; margin-top: 1.2mm; }
    .signature-caption { margin-top: 0.8mm; font-size: 9.8px; }
    .signature-caption.centered { text-align: center; }
    .signature-detail {
      display: grid;
      grid-template-columns: 12mm 1fr;
      column-gap: 1.8mm;
      align-items: baseline;
      font-size: 9.8px;
    }
    .signature-detail .detail-label { white-space: nowrap; }
    .signature-detail .detail-value { min-width: 0; }
    .signature-customer .signature-date { margin-top: 1.4mm; text-align: center; font-size: 9.8px; }
    .doc-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4.8mm; font-size: 9.8px; }
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
      <colgroup>
        <col style="width: 18mm;">
        <col style="width: 77mm;">
        <col style="width: 18mm;">
        <col style="width: 34mm;">
        <col style="width: 19mm;">
        <col style="width: 26mm;">
      </colgroup>
      ${metaRowsMarkup}
    </table>

    <table class="line-table">
      <thead>
        <tr>
          <th style="width: 11%;">Item</th>
          <th style="width: 39%;">Description</th>
          <th style="width: 8.5%;">Qty</th>
          <th style="width: 6%;">@</th>
          <th style="width: 15.5%;">Unit/Price</th>
          <th style="width: 10.5%;">Discount</th>
          <th style="width: 14.5%;">Total</th>
        </tr>
      </thead>
      <tbody>${renderLineRows(model.lineItems)}</tbody>
    </table>

    <div class="footer-stack">
      <div class="footer-divider"></div>

      <div class="summary-grid">
        <div class="summary-left">
          <div class="footer-note">
            <div class="thai">${escapeHtml(DEFAULT_DISCLAIMER_TH)}</div>
            <div>${escapeHtml(DEFAULT_DISCLAIMER_EN)}</div>
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
        </div>
        <table class="totals">
          <tr><td class="label-cell">Total</td><td class="amount">${escapeHtml(formatCurrency(model.totals.subtotal))}</td></tr>
          <tr><td class="label-cell">Trade Discount</td><td class="amount">${escapeHtml(formatCurrency(model.totals.tradeDiscount))}</td></tr>
          <tr><td class="label-cell">Sub Total</td><td class="amount">${escapeHtml(formatCurrency(model.totals.afterDiscount))}</td></tr>
          <tr><td class="label-cell">${escapeHtml(model.vatLabel)}</td><td class="amount">${escapeHtml(formatCurrency(model.totals.vatAmount))}</td></tr>
          <tr><td class="label-cell">Grand Total</td><td class="amount">${escapeHtml(formatCurrency(model.totals.grandTotal))}</td></tr>
        </table>
      </div>

      <div class="signature-grid">
        <div class="signature-col signature-customer">
          <div class="signature-sign"></div>
          <div class="signature-line"></div>
          <div class="signature-caption centered">Customer Confirmed</div>
          <div class="signature-date">Date_____/_____/_____</div>
        </div>
        <div class="signature-col signature-salesperson">
          <div class="signature-sign">
            ${model.salesperson.signature ? `<img src="${escapeHtml(model.salesperson.signature)}" alt="With By Signature" class="signature-image">` : ''}
          </div>
          <div class="signature-line"></div>
          <div class="signature-detail">
            <div class="detail-label">With By</div>
            <div class="detail-value">${escapeHtml(model.salesperson.name)}</div>
          </div>
          <div class="signature-detail">
            <div class="detail-label">Tel</div>
            <div class="detail-value">${escapeHtml(model.salesperson.phone)}</div>
          </div>
          <div class="signature-detail">
            <div class="detail-label">Email :</div>
            <div class="detail-value">${escapeHtml(model.salesperson.email)}</div>
          </div>
        </div>
        <div class="signature-col signature-approver">
          <div class="signature-sign">
            ${model.approver.signature ? `<img src="${escapeHtml(model.approver.signature)}" alt="Approved Signature" class="signature-image">` : ''}
          </div>
          <div class="signature-line"></div>
          <div class="signature-detail">
            <div class="detail-label">Approved</div>
            <div class="detail-value">${escapeHtml(model.approver.name)}</div>
          </div>
          <div class="signature-detail">
            <div class="detail-label">Tel</div>
            <div class="detail-value">${escapeHtml(model.approver.phone)}</div>
          </div>
          <div class="signature-detail">
            <div class="detail-label">Email :</div>
            <div class="detail-value">${escapeHtml(model.approver.email)}</div>
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
