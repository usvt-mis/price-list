import { state } from './state.js';
import { formatCurrency, getQuoteFormData, showError, showToast } from './ui.js';
import { checkApprovalStatus, APPROVAL_STATUS } from './approvals.js';
import { authState } from '../state.js';
import { ROLE } from '../core/config.js';
import { fetchWithAuth } from '../core/utils.js';

const SIGNATURE_API_BASE = '/api/salesquotes/salesperson-signatures';
const SALESDIRECTOR_SIGNATURE_API = '/api/salesdirector-signature';

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
const PRINT_LAYOUT_SETTINGS_API = '/api/salesquotes/print-layout-settings';
const APPROVER_DETAIL_COLUMN_GAP_MM = 6.8;
const TOTALS_LABEL_ALIGNMENT_OFFSET_MM = -2;
const PRINT_PAGE_HEIGHT_MM = 297;
const PRINT_PAGE_PADDING_TOP_MM = 8.5;
const PRINT_PAGE_HORIZONTAL_PADDING_MM = 9;
const PRINT_RESERVED_FOOTER_HEIGHT_MM = 90.5;
const PRINT_TOPBAR_HEIGHT_MM = 25.7;
const PRINT_TITLE_ROW_HEIGHT_MM = 18.7;
const PRINT_META_TABLE_HEIGHT_MM = 40.5;
const PRINT_LINE_TABLE_MARGIN_TOP_MM = 3.3;
const PRINT_LINE_TABLE_HEADER_HEIGHT_MM = 8.9;
const PRINT_LINE_TABLE_SAFETY_MARGIN_MM = 0.25;
const PRINT_PAGE_LINE_ROOM_ALLOWANCE_MM = 8;
const LINE_TABLE_DESCRIPTION_WIDTH_RATIO = 0.385;
const LINE_TABLE_CHILD_DESCRIPTION_INDENT_MM = 8;
const CSS_PX_TO_MM = 25.4 / 96;
const SIGNATURE_BLOCK_BASE_NUDGE_Y_MM = 2;
const DEFAULT_PRINT_LAYOUT_SETTINGS = Object.freeze({
  baseFontSize: 11.4,
  companyThaiFontSize: 15.5,
  companyEnglishFontSize: 14.6,
  titleFontSize: 13.6,
  metaFontSize: 9.9,
  addressColumnWidthMm: 77,
  attentionValueWidthMm: 34,
  leftMetaValuePaddingMm: 1.2,
  lineTableFontSize: 10.2,
  lineTableHeaderFontSize: 10.9,
  footerNoteFontSize: 9.5,
  totalsFontSize: 10.0,
  remarkFontSize: 10.2,
  signatureFontSize: 10.1,
  docFooterFontSize: 10.1,
  logoWidthMm: 31.0,
  logoOffsetXMm: 0,
  logoOffsetYMm: 0,
  companyBlockOffsetXMm: 0,
  companyBlockOffsetYMm: 0,
  attentionTelBlockOffsetXMm: 0,
  attentionTelBlockOffsetYMm: 0,
  certsOffsetYMm: 3.2,
  certsOffsetXMm: 0,
  certsSizeScale: 1.0,
  totalsOffsetXMm: 0,
  footerSummaryBlockOffsetXMm: 0,
  footerSummaryBlockOffsetYMm: 0,
  signatureBlockOffsetXMm: 0,
  signatureBlockOffsetYMm: 0,
  signatureGridMarginTopMm: 5.4,
  signatureColMinHeightMm: 41.0,
  signatureSignMinHeightMm: 16.0
});

const META_TABLE_BASE_WIDTHS_MM = Object.freeze({
  label: 18,
  address: 77,
  midLabel: 18,
  midValue: 34,
  rightLabel: 19,
  rightValue: 26
});

const META_TABLE_MIN_WIDTHS_MM = Object.freeze({
  label: 14,
  address: 55,
  midLabel: 15,
  midValue: 10,
  rightLabel: 14,
  rightValue: 19
});

let printLayoutSettingsPromise = null;

/**
 * Fetch uploaded signature for a salesperson from backoffice
 * Priority: Uploaded signature > BC signature data > No signature
 */
export async function fetchSalespersonSignature(salespersonCode) {
  if (!salespersonCode) return null;

  try {
    const response = await fetchWithAuth(`${SIGNATURE_API_BASE}/${encodeURIComponent(salespersonCode)}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No signature uploaded, that's OK
      }
      throw new Error('Failed to fetch salesperson signature');
    }
    const data = await response.json();
    return data.signatureData;
  } catch (error) {
    console.warn('Unable to fetch salesperson signature:', error);
    return null;
  }
}

/**
 * Fetch Sales Director signature and contact info (public endpoint)
 * Returns null if no signature is uploaded
 */
export async function fetchSalesDirectorSignature() {
  try {
    const response = await fetch(SALESDIRECTOR_SIGNATURE_API);
    if (!response.ok) {
      console.warn('Failed to fetch Sales Director signature:', response.status);
      return null;
    }
    const data = await response.json();
    return {
      signatureData: data.signatureData || null,
      fullName: data.fullName || 'Supachai Masphui',
      phoneNo: data.phoneNo || '08-6320-7404',
      email: data.email || 'supachai@uservices-thailand.com'
    };
  } catch (error) {
    console.warn('Unable to fetch Sales Director signature:', error);
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSingleLineText(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function clampNumber(value, fallback, min, max) {
  const parsed = asNumber(value, NaN);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function normalizePrintLayoutSettings(value = {}) {
  const addressColumnWidthMm = clampNumber(
    value.addressColumnWidthMm,
    DEFAULT_PRINT_LAYOUT_SETTINGS.addressColumnWidthMm,
    55,
    120
  );
  const derivedMetaColumnWidths = resolveMetaTableColumnWidths({ addressColumnWidthMm });

  return {
    baseFontSize: clampNumber(value.baseFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.baseFontSize, 9, 16),
    companyThaiFontSize: clampNumber(value.companyThaiFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.companyThaiFontSize, 11, 22),
    companyEnglishFontSize: clampNumber(value.companyEnglishFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.companyEnglishFontSize, 11, 22),
    titleFontSize: clampNumber(value.titleFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.titleFontSize, 11, 20),
    metaFontSize: clampNumber(value.metaFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.metaFontSize, 8, 16),
    addressColumnWidthMm,
    attentionValueWidthMm: clampNumber(value.attentionValueWidthMm, derivedMetaColumnWidths.midValue, 10, 120),
    leftMetaValuePaddingMm: clampNumber(value.leftMetaValuePaddingMm, DEFAULT_PRINT_LAYOUT_SETTINGS.leftMetaValuePaddingMm, 0, 6),
    lineTableFontSize: clampNumber(value.lineTableFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.lineTableFontSize, 8, 16),
    lineTableHeaderFontSize: clampNumber(value.lineTableHeaderFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.lineTableHeaderFontSize, 8, 18),
    footerNoteFontSize: clampNumber(value.footerNoteFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.footerNoteFontSize, 8, 16),
    totalsFontSize: clampNumber(value.totalsFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.totalsFontSize, 8, 16),
    remarkFontSize: clampNumber(value.remarkFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.remarkFontSize, 8, 16),
    signatureFontSize: clampNumber(value.signatureFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.signatureFontSize, 8, 16),
    docFooterFontSize: clampNumber(value.docFooterFontSize, DEFAULT_PRINT_LAYOUT_SETTINGS.docFooterFontSize, 8, 16),
    logoWidthMm: clampNumber(value.logoWidthMm, DEFAULT_PRINT_LAYOUT_SETTINGS.logoWidthMm, 20, 45),
    logoOffsetXMm: clampNumber(value.logoOffsetXMm, DEFAULT_PRINT_LAYOUT_SETTINGS.logoOffsetXMm, -20, 20),
    logoOffsetYMm: clampNumber(value.logoOffsetYMm, DEFAULT_PRINT_LAYOUT_SETTINGS.logoOffsetYMm, -10, 16),
    companyBlockOffsetXMm: clampNumber(value.companyBlockOffsetXMm, DEFAULT_PRINT_LAYOUT_SETTINGS.companyBlockOffsetXMm, -20, 20),
    companyBlockOffsetYMm: clampNumber(value.companyBlockOffsetYMm, DEFAULT_PRINT_LAYOUT_SETTINGS.companyBlockOffsetYMm, -10, 16),
    attentionTelBlockOffsetXMm: clampNumber(value.attentionTelBlockOffsetXMm, DEFAULT_PRINT_LAYOUT_SETTINGS.attentionTelBlockOffsetXMm, -40, 20),
    attentionTelBlockOffsetYMm: clampNumber(value.attentionTelBlockOffsetYMm, DEFAULT_PRINT_LAYOUT_SETTINGS.attentionTelBlockOffsetYMm, -10, 16),
    certsOffsetYMm: clampNumber(value.certsOffsetYMm, DEFAULT_PRINT_LAYOUT_SETTINGS.certsOffsetYMm, -8, 12),
    certsOffsetXMm: clampNumber(value.certsOffsetXMm, DEFAULT_PRINT_LAYOUT_SETTINGS.certsOffsetXMm, -30, 30),
    certsSizeScale: clampNumber(value.certsSizeScale, DEFAULT_PRINT_LAYOUT_SETTINGS.certsSizeScale, 0.5, 3),
    totalsOffsetXMm: clampNumber(value.totalsOffsetXMm, DEFAULT_PRINT_LAYOUT_SETTINGS.totalsOffsetXMm, -20, 20),
    footerSummaryBlockOffsetXMm: clampNumber(value.footerSummaryBlockOffsetXMm, DEFAULT_PRINT_LAYOUT_SETTINGS.footerSummaryBlockOffsetXMm, -20, 20),
    footerSummaryBlockOffsetYMm: clampNumber(value.footerSummaryBlockOffsetYMm, DEFAULT_PRINT_LAYOUT_SETTINGS.footerSummaryBlockOffsetYMm, -10, 16),
    signatureBlockOffsetXMm: clampNumber(value.signatureBlockOffsetXMm, DEFAULT_PRINT_LAYOUT_SETTINGS.signatureBlockOffsetXMm, -20, 20),
    signatureBlockOffsetYMm: clampNumber(value.signatureBlockOffsetYMm, DEFAULT_PRINT_LAYOUT_SETTINGS.signatureBlockOffsetYMm, -10, 16),
    signatureGridMarginTopMm: clampNumber(value.signatureGridMarginTopMm, DEFAULT_PRINT_LAYOUT_SETTINGS.signatureGridMarginTopMm, 0, 20),
    signatureColMinHeightMm: clampNumber(value.signatureColMinHeightMm, DEFAULT_PRINT_LAYOUT_SETTINGS.signatureColMinHeightMm, 20, 70),
    signatureSignMinHeightMm: clampNumber(value.signatureSignMinHeightMm, DEFAULT_PRINT_LAYOUT_SETTINGS.signatureSignMinHeightMm, 5, 35)
  };
}

async function loadPrintLayoutSettings(forceRefresh = false) {
  if (!forceRefresh && printLayoutSettingsPromise) {
    return printLayoutSettingsPromise;
  }

  printLayoutSettingsPromise = (async () => {
    try {
      const response = await fetch(PRINT_LAYOUT_SETTINGS_API, {
        headers: {
          Accept: 'application/json'
        }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Failed to load print layout settings (${response.status})`);
      }

      return normalizePrintLayoutSettings(data.value || {});
    } catch (error) {
      console.warn('Falling back to default Sales Quote print layout settings:', error);
      return normalizePrintLayoutSettings();
    }
  })();

  return printLayoutSettingsPromise;
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

function joinInlineAddress(parts) {
  return compactLines(parts).join(' ');
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
    });
}

function buildPrintableRenderRows(lines) {
  const groups = new Map();

  lines.forEach((line, index) => {
    const groupKey = String(line.groupNo || '').trim();
    const groupState = groups.get(groupKey) || {
      total: 0,
      headerIndex: null,
      footerIndex: null
    };

    groupState.total += resolveLineAmount(line, 0);

    if (line.showInDocument !== false && line.printHeader && groupState.headerIndex === null) {
      groupState.headerIndex = index;
    }

    if (line.showInDocument !== false && line.printFooter && groupState.footerIndex === null) {
      groupState.footerIndex = index;
    }

    groups.set(groupKey, groupState);
  });

  let headerCounter = 0;

  return lines.flatMap((line, index) => {
    const groupKey = String(line.groupNo || '').trim();
    const groupState = groups.get(groupKey) || {
      total: resolveLineAmount(line, 0),
      headerIndex: null,
      footerIndex: null
    };
    const footerIndex = Number.isInteger(groupState.footerIndex) ? groupState.footerIndex : null;
    const isHiddenByFooter = footerIndex !== null && index > footerIndex;

    if (line.showInDocument === false || isHiddenByFooter) {
      return [];
    }

    const isHeader = groupState.headerIndex === index;
    const isFooter = groupState.footerIndex === index;
    const isChild = Number.isInteger(groupState.headerIndex) && index > groupState.headerIndex;

    const baseRow = {
      ...line,
      rowType: 'line',
      itemLabel: isHeader ? String(++headerCounter) : '',
      printIsHeader: isHeader,
      printIsFooter: isFooter,
      printIsChild: isChild,
      groupTotal: groupState.total
    };

    if (!isFooter) {
      return [baseRow];
    }

    return [
      baseRow,
      {
        rowType: 'groupTotal',
        groupNo: line.groupNo || '',
        groupTotal: groupState.total
      }
    ];
  });
}

function buildTotals(formData, reportContext = {}) {
  const subtotal = (formData.lines || []).reduce((sum, line) => sum + calculateLineTotal(line), 0);
  const tradeDiscount = asNumber(formData.invoiceDiscount);
  const reportTotals = reportContext.reportTotals || {};
  const subtotalAmount = asNumber(reportTotals.totalAmt1, subtotal);
  const tradeDiscountAmount = asNumber(reportTotals.totalAmt2, tradeDiscount);
  const afterDiscount = asNumber(reportTotals.totalAmt3, subtotalAmount - tradeDiscountAmount);
  const vatEnabled = formData.vatEnabled !== false && asNumber(formData.vatRate, 7) > 0;
  const vatRate = vatEnabled ? asNumber(formData.vatRate, 7) : 0;
  const vatAmount = vatEnabled
    ? asNumber(reportTotals.totalAmt4, afterDiscount * (vatRate / 100))
    : 0;

  return {
    subtotal: subtotalAmount,
    tradeDiscount: tradeDiscountAmount,
    afterDiscount,
    vatRate,
    vatAmount,
    grandTotal: vatEnabled
      ? asNumber(reportTotals.totalAmt5, afterDiscount + vatAmount)
      : afterDiscount
  };
}

function buildCustomerAddressLines(formData, reportContext) {
  const reportLines = compactLines(reportContext.customerAddressLines || reportContext.customerInfoLines);
  if (reportLines.length) {
    if (reportLines.length <= 2) {
      return reportLines;
    }

    return compactLines([
      reportLines[0],
      joinInlineAddress(reportLines.slice(1))
    ]);
  }

  const sellToLines = compactLines([
    formData.sellTo?.address,
    joinInlineAddress([
      formData.sellTo?.address2,
      formData.sellTo?.city,
      formData.sellTo?.postCode
    ])
  ]);

  return sellToLines;
}

async function buildModel() {
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
  const uploadedSalespersonSignature = await fetchSalespersonSignature(formData.salespersonCode);
  const salespersonSignature = uploadedSalespersonSignature || normalizeDataUri(requestSignature.signature) || normalizeDataUri(reportContext.salesperson?.signature);
  const customerName = reportContext.customerName || formData.customerName || '';
  const customerAddressLines = buildCustomerAddressLines(formData, reportContext);
  const printableLines = buildPrintableLines(formData, reportContext);

  // Check approval status for Sales Director signature
  let approverSignature = normalizeDataUri(reportContext.approver?.signature);
  let approverName = reportContext.approver?.name || '';
  let approverPhone = reportContext.approver?.phone || '';
  let approverEmail = reportContext.approver?.email || '';

  // Only show Sales Director signature if quote is approved
  const quoteNumber = formData.quoteNumber || state.quote.number;
  if (quoteNumber) {
    try {
      const approval = await checkApprovalStatus(quoteNumber);
      if (approval && approval.approvalStatus === APPROVAL_STATUS.APPROVED) {
        // Fetch Sales Director signature
        const directorSignature = await fetchSalesDirectorSignature();
        if (directorSignature) {
          approverSignature = directorSignature.signatureData;
          approverName = directorSignature.fullName;
          approverPhone = directorSignature.phoneNo;
          approverEmail = directorSignature.email;
          console.log('[Print] Using Sales Director signature from approval system');
        } else {
          // Fallback to BC approver if director signature not found
          console.log('[Print] Director signature not found, using BC approver');
        }
      } else if (approval && approval.approvalStatus !== APPROVAL_STATUS.APPROVED) {
        // Quote not approved - don't show approver signature
        console.log('[Print] Quote not approved, hiding approver signature. Status:', approval.approvalStatus);
        approverSignature = '';
        approverName = '';
        approverPhone = '';
        approverEmail = '';
      }
    } catch (error) {
      console.error('[Print] Failed to check approval status:', error);
      // Fallback to BC approver signature
    }
  }

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
    paymentText: reportContext.paymentTermsCode || formData.paymentTermsCode || reportContext.paymentTermsDescription || '',
    deliveryText: formatDate(formData.deliveryDate),
    attention: formData.contact || reportContext.billToContact || '',
    phone: state.quote.customer?.phone || reportContext.sellToPhoneNo || '',
    taxId: formData.sellTo?.vatRegNo || reportContext.vatRegistrationNo || '',
    lineItems: buildPrintableRenderRows(printableLines),
    detailNotes: [],
    bottomRemark: normalizeSingleLineText(formData.remark) || normalizeSingleLineText(detailNotes.join(' ')),
    jobNo: documentRef,
    totals,
    vatLabel: totals.vatRate > 0
      ? (reportContext.vatText || `VAT ${totals.vatRate.toFixed(0)}%`)
      : 'VAT 0%',
    salesperson: {
      name: requestSignature.name || reportContext.salesperson?.name || formData.salespersonName || '',
      phone: formData.salesPhoneNo || requestSignature.phone || reportContext.salesperson?.phone || '',
      email: formData.salesEmail || requestSignature.email || reportContext.salesperson?.email || '',
      signature: salespersonSignature
    },
    approver: {
      name: approverName,
      phone: approverPhone,
      email: approverEmail,
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

function renderApproverSignatureColumn(model) {
  return `
            <div class="signature-col signature-approver">
              <div class="signature-sign">
                ${model.approver.signature ? `<img src="${escapeHtml(model.approver.signature)}" alt="Approved Signature" class="signature-image">` : ''}
              </div>
              <div class="signature-line"></div>
              <div class="signature-meta">
                <div class="signature-meta-row">
                  <div class="signature-detail signature-detail-approver-name">
                    <div class="detail-label">Approved</div>
                    <div class="detail-value">${escapeHtml(model.approver.name)}</div>
                  </div>
                </div>
                <div class="signature-meta-row">
                  <div class="signature-detail">
                    <div class="detail-label">Tel</div>
                    <div class="detail-value">${escapeHtml(model.approver.phone)}</div>
                  </div>
                </div>
                <div class="signature-meta-row">
                  <div class="signature-detail signature-detail-approver-email">
                    <div class="detail-label">Email :</div>
                    <div class="detail-value detail-value-email">${escapeHtml(model.approver.email)}</div>
                  </div>
                </div>
              </div>
            </div>`;
}

function renderMetaOffsetContent(content, kind = 'value', extraClass = '') {
  const normalized = String(content ?? '').trim();
  if (!normalized) {
    return '';
  }

  const className = ['meta-offset-block', `meta-offset-block-${kind}`, extraClass]
    .filter(Boolean)
    .join(' ');

  return `<span class="${className}">${escapeHtml(normalized)}</span>`;
}

function renderLeftMetaValueContent(content) {
  const normalized = String(content ?? '').trim();
  if (!normalized) {
    return '';
  }

  return `<span class="left-meta-value">${escapeHtml(normalized)}</span>`;
}

function renderRightMetaContent(content, kind = 'label', extraClass = '') {
  const normalized = String(content ?? '').trim();
  if (!normalized) {
    return '';
  }

  const className = ['right-meta', kind, extraClass]
    .filter(Boolean)
    .join(' ');

  return `<span class="${className}">${escapeHtml(normalized)}</span>`;
}

function renderMetaRows(model, customerAddressLines) {
  const customerRows = customerAddressLines.map((line, index) => `
    <tr${index === 0 ? ' class="meta-address-row"' : ''}>
      <td class="label">${index === 0 ? 'Address' : ''}</td>
      <td class="value">${renderLeftMetaValueContent(line)}</td>
      <td class="mid-label"></td>
      <td class="mid-value"></td>
      <td class="right-label shifted">${index === 0 ? renderRightMetaContent('Our Ref.', 'label', 'meta-fixed-width') : index === 1 ? renderRightMetaContent('Date', 'label', 'meta-fixed-width') : ''}</td>
      <td class="right-value shifted">${index === 0 ? renderRightMetaContent(model.ourRef, 'value') : index === 1 ? renderRightMetaContent(model.documentDate, 'value') : ''}</td>
    </tr>
  `).join('');

  const deliveryRow = `
    <tr>
      <td class="label">Delivery Address</td>
      <td class="value"></td>
      <td class="mid-label">${renderMetaOffsetContent('Tel.', 'label')}</td>
      <td class="mid-value">${renderMetaOffsetContent(model.phone, 'value')}</td>
      <td class="right-label shifted">${renderRightMetaContent('Delivery Date', 'label', 'meta-fixed-width')}</td>
      <td class="right-value shifted">${renderRightMetaContent(model.deliveryText, 'value')}</td>
    </tr>
  `;

  return `
    <tr class="meta-divider">
      <td class="label">AR Code</td>
      <td class="value">${renderLeftMetaValueContent(model.arCode)}</td>
      <td class="mid-label"></td>
      <td class="mid-value"></td>
      <td class="right-label"></td>
      <td class="right-value"></td>
    </tr>
    <tr class="meta-customer-row">
      <td class="label">Customer</td>
      <td class="value">${renderLeftMetaValueContent(model.customerName)}</td>
      <td class="mid-label"></td>
      <td class="mid-value"></td>
      <td class="right-label"></td>
      <td class="right-value"></td>
    </tr>
    ${customerRows}
    <tr>
      <td class="label"></td>
      <td class="value"></td>
      <td class="mid-label">${renderMetaOffsetContent('Attention', 'label')}</td>
      <td class="mid-value">${renderMetaOffsetContent(model.attention, 'value', 'meta-attention-value')}</td>
      <td class="right-label shifted">${renderRightMetaContent('Expired Date', 'label', 'meta-fixed-width')}</td>
      <td class="right-value shifted">${renderRightMetaContent(model.expiredDate, 'value')}</td>
    </tr>
    <tr>
      <td class="label">Tax ID</td>
      <td class="value">${renderLeftMetaValueContent(model.taxId)}</td>
      <td class="mid-label"></td>
      <td class="mid-value"></td>
      <td class="right-label shifted">${renderRightMetaContent('Payment', 'label', 'meta-fixed-width')}</td>
      <td class="right-value shifted">${renderRightMetaContent(model.paymentText, 'value')}</td>
    </tr>
    ${deliveryRow}
  `;
}

function resolveMetaTableColumnWidths(layoutSettings) {
  const addressWidth = clampNumber(
    layoutSettings.addressColumnWidthMm,
    DEFAULT_PRINT_LAYOUT_SETTINGS.addressColumnWidthMm,
    META_TABLE_MIN_WIDTHS_MM.address,
    120
  );

  if (addressWidth <= META_TABLE_BASE_WIDTHS_MM.address) {
    return {
      label: META_TABLE_BASE_WIDTHS_MM.label,
      address: addressWidth,
      midLabel: META_TABLE_BASE_WIDTHS_MM.midLabel,
      midValue: META_TABLE_BASE_WIDTHS_MM.midValue + (META_TABLE_BASE_WIDTHS_MM.address - addressWidth),
      rightLabel: META_TABLE_BASE_WIDTHS_MM.rightLabel,
      rightValue: META_TABLE_BASE_WIDTHS_MM.rightValue
    };
  }

  const progress = (addressWidth - META_TABLE_BASE_WIDTHS_MM.address) / (120 - META_TABLE_BASE_WIDTHS_MM.address);
  const interpolateWidth = (base, min) => base - ((base - min) * progress);

  return {
    label: interpolateWidth(META_TABLE_BASE_WIDTHS_MM.label, META_TABLE_MIN_WIDTHS_MM.label),
    address: addressWidth,
    midLabel: interpolateWidth(META_TABLE_BASE_WIDTHS_MM.midLabel, META_TABLE_MIN_WIDTHS_MM.midLabel),
    midValue: interpolateWidth(META_TABLE_BASE_WIDTHS_MM.midValue, META_TABLE_MIN_WIDTHS_MM.midValue),
    rightLabel: interpolateWidth(META_TABLE_BASE_WIDTHS_MM.rightLabel, META_TABLE_MIN_WIDTHS_MM.rightLabel),
    rightValue: interpolateWidth(META_TABLE_BASE_WIDTHS_MM.rightValue, META_TABLE_MIN_WIDTHS_MM.rightValue)
  };
}

function renderLineTableHeader() {
  return `
        <thead>
          <tr>
            <th style="width: 6.5%;">Item</th>
            <th style="width: 38.5%;">Description</th>
            <th style="width: 8.5%;">Qty</th>
            <th style="width: 6%;">@</th>
            <th style="width: 15.5%;">Unit/Price</th>
            <th style="width: 10.5%;">Discount</th>
            <th style="width: 14.5%;">Total</th>
          </tr>
        </thead>`;
}

function renderLineRows(lines) {
  if (!lines.length) {
    return '<tr><td colspan="7" class="empty-row">No printable lines available.</td></tr>';
  }

  const renderContinuationRows = (description, rowClassName = '') => {
    return compactLines(
      Array.isArray(description)
        ? description.flatMap(text => String(text || '').split(/\r?\n/))
        : String(description || '').split(/\r?\n/)
    )
      .map(text => `
        <tr class="${['line-comment-row', rowClassName].filter(Boolean).join(' ')}">
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

  return lines.map(line => {
    if (line.rowType === 'groupTotal') {
      return `
        <tr class="line-group-total-row">
          <td class="item-cell"></td>
          <td class="desc-cell"></td>
          <td class="qty-cell"></td>
          <td class="unit-cell"></td>
          <td class="num-cell"></td>
          <td class="group-total-label-cell"><span class="group-total-label-text">Total</span></td>
          <td class="group-total-amount-cell"><span class="group-total-amount">${escapeHtml(formatCurrency(asNumber(line.groupTotal, 0)))}</span></td>
        </tr>
      `;
    }

    const descriptionLines = compactLines(String(line.description || '').split(/\r?\n/));
    const primaryDescription = descriptionLines.shift() || '';
    const continuationLines = [
      ...descriptionLines,
      ...compactLines(String(line.description2 || '').split(/\r?\n/))
    ];
    const rowClassNames = ['line-main-row'];

    if (line.printIsHeader) {
      rowClassNames.push('line-group-header');
    } else {
      rowClassNames.push('line-group-child');
    }

    if (line.printIsFooter) {
      rowClassNames.push('line-group-footer');
    }

    const rowClassName = rowClassNames.join(' ');
    const hasLineAmounts = Boolean(
      line.itemNo
      || asNumber(line.quantity, 0) !== 0
      || asNumber(line.unitPrice, 0) !== 0
      || asNumber(line.discountAmount, 0) !== 0
      || asNumber(line.lineTotal, 0) !== 0
    );
    const hasVisibleQuantity = asNumber(line.quantity, 0) !== 0;
    const qtyText = hasVisibleQuantity ? formatQty(line.quantity) : '';
    const unitText = hasVisibleQuantity ? formatUnitOfMeasure(line.unitOfMeasure) : '';
    const shouldHideHeaderAmounts = line.printIsHeader;
    const unitPriceText = !shouldHideHeaderAmounts && hasLineAmounts ? formatMisRdlUnitPrice(line) : '';
    const discountText = !shouldHideHeaderAmounts && hasLineAmounts ? formatCurrency(line.discountAmount) : '';
    const totalText = !shouldHideHeaderAmounts && hasLineAmounts ? formatMoneyOrIncluded(resolveLineAmount(line, 0)) : '';

    const continuationRowClassName = line.printIsHeader
      ? 'line-group-header'
      : 'line-group-child';

    return `
      <tr class="${rowClassName}">
        <td class="item-cell"><span class="item-cell-value">${escapeHtml(line.itemLabel || '')}</span></td>
        <td class="desc-cell">${escapeHtml(primaryDescription)}</td>
        <td class="qty-cell">${escapeHtml(qtyText)}</td>
        <td class="unit-cell">${escapeHtml(unitText)}</td>
        <td class="num-cell">${escapeHtml(unitPriceText)}</td>
        <td class="num-cell">${escapeHtml(discountText)}</td>
        <td class="num-cell">${escapeHtml(totalText)}</td>
      </tr>
      ${renderContinuationRows(continuationLines, continuationRowClassName)}
    `;
  }).join('');
}

function estimateDescriptionCharsPerLine(settings, isChildLine = false) {
  const printableWidthMm = 210 - (PRINT_PAGE_HORIZONTAL_PADDING_MM * 2);
  const descriptionWidthMm = printableWidthMm * LINE_TABLE_DESCRIPTION_WIDTH_RATIO;
  const usableDescriptionWidthMm = Math.max(
    30,
    descriptionWidthMm - (isChildLine ? LINE_TABLE_CHILD_DESCRIPTION_INDENT_MM : 0)
  );
  const fontSizeMm = settings.lineTableFontSize * 0.264583;
  const averageGlyphWidthMm = Math.max(1, fontSizeMm * 0.47);

  return Math.max(24, Math.floor(usableDescriptionWidthMm / averageGlyphWidthMm));
}

function estimateWrappedLineCount(text, charsPerLine) {
  const normalized = normalizeSingleLineText(text);
  if (!normalized) {
    return 1;
  }

  return Math.max(1, Math.ceil(Array.from(normalized).length / charsPerLine));
}

/**
 * Calculate the height in mm for each printable line row
 * Accounts for base row height, description continuations, and special row types
 */
function calculateRowHeights(lines, settings) {
  const lineHeightMm = settings.lineTableFontSize * 0.264583 * 1.3;
  const baseRowHeightMm = Math.max(5.7, lineHeightMm + 1.9);
  const wrappedLineHeightMm = Math.max(3.8, lineHeightMm + 0.3);
  const commentRowHeightMm = Math.max(4.5, lineHeightMm + 1.05);
  const groupTotalRowHeightMm = 5.6;

  const heights = [];

  for (const line of lines) {
    if (line.rowType === 'groupTotal') {
      heights.push(groupTotalRowHeightMm);
      continue;
    }

    const descriptionLines = compactLines(String(line.description || '').split(/\r?\n/));
    const primaryDescription = descriptionLines.shift() || '';
    const continuationLines = [
      ...descriptionLines,
      ...compactLines(String(line.description2 || '').split(/\r?\n/))
    ];
    let rowHeight = baseRowHeightMm;
    const descWidthChars = estimateDescriptionCharsPerLine(settings, !line.printIsHeader);

    const primaryDescriptionLineCount = estimateWrappedLineCount(primaryDescription, descWidthChars);
    rowHeight += Math.max(0, primaryDescriptionLineCount - 1) * wrappedLineHeightMm;

    continuationLines.forEach(text => {
      const estimatedLineCount = estimateWrappedLineCount(text, descWidthChars);
      rowHeight += estimatedLineCount * commentRowHeightMm;
    });

    heights.push(rowHeight);
  }

  return heights;
}

/**
 * Calculate available content space per page type in mm
 */
function calculateAvailablePageHeights(hasMetaTable = true) {
  const fullHeaderHeight = PRINT_TOPBAR_HEIGHT_MM
    + PRINT_TITLE_ROW_HEIGHT_MM
    + (hasMetaTable ? PRINT_META_TABLE_HEIGHT_MM : 0);
  const availableWithFullFooter = PRINT_PAGE_HEIGHT_MM
    - PRINT_PAGE_PADDING_TOP_MM
    - PRINT_RESERVED_FOOTER_HEIGHT_MM
    - fullHeaderHeight
    - PRINT_LINE_TABLE_MARGIN_TOP_MM
    - PRINT_LINE_TABLE_HEADER_HEIGHT_MM
    - PRINT_LINE_TABLE_SAFETY_MARGIN_MM;

  return {
    firstPage: Math.max(20, availableWithFullFooter + PRINT_PAGE_LINE_ROOM_ALLOWANCE_MM),
    middlePage: Math.max(20, availableWithFullFooter + PRINT_PAGE_LINE_ROOM_ALLOWANCE_MM),
    lastPage: Math.max(20, availableWithFullFooter + PRINT_PAGE_LINE_ROOM_ALLOWANCE_MM)
  };
}

/**
 * Split line items into page chunks based on available height
 */
function resolveRowHeights(lines, settings, measuredRowHeights = null) {
  if (Array.isArray(measuredRowHeights) && measuredRowHeights.length === lines.length) {
    const normalizedHeights = measuredRowHeights.map(value => asNumber(value, NaN));

    if (normalizedHeights.every(value => Number.isFinite(value) && value > 0)) {
      return normalizedHeights;
    }
  }

  return calculateRowHeights(lines, settings);
}

function chunkLineItemsForPages(lines, settings, hasMetaTable = true, measuredRowHeights = null) {
  const rowHeights = resolveRowHeights(lines, settings, measuredRowHeights);
  const pageHeights = calculateAvailablePageHeights(hasMetaTable);
  const chunks = [];
  let startIndex = 0;
  let currentHeight = 0;
  let pageIndex = 0;

  const getAvailableHeightForCurrentPage = () => (
    pageIndex === 0
      ? pageHeights.firstPage
      : pageHeights.middlePage
  );

  // Check if everything fits on one page
  const totalHeight = rowHeights.reduce((a, b) => a + b, 0);
  if (totalHeight <= pageHeights.firstPage) {
    chunks.push({
      startIndex: 0,
      endIndex: lines.length,
      pageType: 'only',
      lines: lines
    });
  } else {
    // Build chunks with the footer reserved on every page.
    for (let i = 0; i < lines.length; i++) {
      const rowHeight = rowHeights[i];
      const isLastItem = i === lines.length - 1;

      // Calculate available height for current page
      const availableHeight = getAvailableHeightForCurrentPage();

      if (currentHeight + rowHeight <= availableHeight) {
        currentHeight += rowHeight;
      } else {
        // Row doesn't fit, start a new page
        if (startIndex < i) {
          chunks.push({
            startIndex,
            endIndex: i,
            pageType: 'middle',
            lines: lines.slice(startIndex, i)
          });
        }

        startIndex = i;
        currentHeight = rowHeight;
        pageIndex += 1;
      }

      // If this is the last item, add the final chunk
      if (isLastItem && startIndex < lines.length) {
        chunks.push({
          startIndex,
          endIndex: lines.length,
          pageType: 'last',
          lines: lines.slice(startIndex)
        });
      }
    }
  }

  // Adjust page types
  if (chunks.length === 1) {
    chunks[0].pageType = 'only';
  } else if (chunks.length > 1) {
    chunks[0].pageType = 'first';
    for (let i = 1; i < chunks.length - 1; i++) {
      chunks[i].pageType = 'middle';
    }
    chunks[chunks.length - 1].pageType = 'last';
  }

  return chunks;
}

/**
 * Build page header HTML (full or compact)
 */
function buildPageHeader(model, settings, pageNumber, totalPages, headerType = 'full') {
  const topbarLogoColumnWidthMm = Math.max(settings.logoWidthMm + 2 + Math.max(settings.logoOffsetXMm, 0), 30);
  const companyLineFontSize = Math.max(settings.baseFontSize - 0.8, 9);
  const pageNoFontSize = Math.max(settings.baseFontSize - 0.3, 9);
  const pageLabel = totalPages > 1 ? `หน้า ${pageNumber}/${totalPages}` : 'หน้า 1/1';

  if (headerType === 'compact') {
    // Compact header for continuation pages
    const logoWidth = 22; // Smaller logo
    const companyFontSize = 13; // Smaller font

    return `
      <div class="topbar topbar--compact">
        <div style="display: grid; grid-template-columns: ${logoWidth}mm 1fr ${45}mm; align-items: start; column-gap: 4mm; width: 100%;">
          <img src="${escapeHtml(model.logoSrc)}" alt="U-Services" class="main-logo main-logo--compact" style="width: ${logoWidth}mm;">
          <div class="company company--compact">
            <div class="th-name" style="font-size: ${companyFontSize}px;">${escapeHtml(model.companyLines[0] || DEFAULT_COMPANY_LINES[0])}</div>
          </div>
          <div class="page-no">${escapeHtml(pageLabel)}</div>
        </div>
      </div>`;
  }

  // Full header
  const companyMarkup = model.companyLines.slice(2).map(line => `<div class="company-line">${escapeHtml(line)}</div>`).join('');
  const certificationMarkup = model.certificationLogos
    .map(src => {
      const isAemt = src.includes('aemt-logo');
      const extraClass = isAemt ? ' cert-logo-aemt' : '';
      return `<img src="${escapeHtml(src)}" alt="" class="cert-logo${extraClass}">`;
    })
    .join('');

  return `
    <div class="topbar">
      <img src="${escapeHtml(model.logoSrc)}" alt="U-Services" class="main-logo">
      <div class="company">
        <div class="th-name">${escapeHtml(model.companyLines[0] || DEFAULT_COMPANY_LINES[0])}</div>
        <div class="en-name">${escapeHtml(model.companyLines[1] || DEFAULT_COMPANY_LINES[1])}</div>
        ${companyMarkup}
      </div>
      <div class="page-no">${escapeHtml(pageLabel)}</div>
    </div>

    <div class="title-row">
      <div class="spacer"></div>
      <div class="title">${escapeHtml(model.title)}</div>
      <div class="certs">${certificationMarkup}</div>
    </div>`;
}

/**
 * Build page footer HTML (none, partial, or full)
 */
function renderTotalsRows(totals, vatLabel, showValues = true) {
  const getAmountMarkup = (value) => (showValues ? escapeHtml(formatCurrency(value)) : '&nbsp;');

  return `
                <tr><td class="label-cell"><span class="totals-label-text">Total</span></td><td class="amount">${getAmountMarkup(totals.subtotal)}</td></tr>
                <tr><td class="label-cell"><span class="totals-label-text">Trade Discount</span></td><td class="amount">${getAmountMarkup(totals.tradeDiscount)}</td></tr>
                <tr><td class="label-cell"><span class="totals-label-text">Sub Total</span></td><td class="amount">${getAmountMarkup(totals.afterDiscount)}</td></tr>
                <tr><td class="label-cell"><span class="totals-label-text">${escapeHtml(vatLabel)}</span></td><td class="amount">${getAmountMarkup(totals.vatAmount)}</td></tr>
                <tr><td class="label-cell"><span class="totals-label-text">Grand Total</span></td><td class="amount">${getAmountMarkup(totals.grandTotal)}</td></tr>`;
}

function buildPageFooter(model, settings, totals, footerType = 'full', options = {}) {
  const { showTotalValues = true } = options;
  const remarkMarkup = model.bottomRemark
    ? escapeHtml(model.bottomRemark)
    : '&nbsp;';
  const signatureSignHeightMm = Math.max(settings.signatureSignMinHeightMm, 22);

  if (footerType === 'none') {
    return ''; // No footer for middle pages
  }

  if (footerType === 'partial') {
    // Disclaimer + signatures for first/middle pages in multi-page documents
    return `
      <div class="footer-stack footer-stack--partial">
        <div class="footer-summary-block">
          <div class="footer-divider"></div>
          <div class="footer-note">
            <div class="thai">${escapeHtml(DEFAULT_DISCLAIMER_TH)}</div>
            <div>${escapeHtml(DEFAULT_DISCLAIMER_EN)}</div>
          </div>
        </div>

        <div class="signature-block">
          <div class="signature-grid">
            <div class="signature-col signature-customer">
              <div class="signature-sign"></div>
              <div class="signature-line"></div>
              <div class="signature-meta">
                <div class="signature-meta-row"></div>
                <div class="signature-meta-row centered">
                  <div class="signature-caption centered">Customer Confirmed</div>
                </div>
                <div class="signature-meta-row centered">
                  <div class="signature-date">Date_____/_____/_____</div>
                </div>
              </div>
            </div>
            <div class="signature-col signature-salesperson">
              <div class="signature-sign">
                ${model.salesperson.signature ? `<img src="${escapeHtml(model.salesperson.signature)}" alt="With By Signature" class="signature-image">` : ''}
              </div>
              <div class="signature-line"></div>
              <div class="signature-meta">
                <div class="signature-meta-row">
                  <div class="signature-detail">
                    <div class="detail-label">With By</div>
                    <div class="detail-value">${escapeHtml(model.salesperson.name)}</div>
                  </div>
                </div>
                <div class="signature-meta-row">
                  <div class="signature-detail">
                    <div class="detail-label">Tel</div>
                    <div class="detail-value">${escapeHtml(model.salesperson.phone)}</div>
                  </div>
                </div>
                <div class="signature-meta-row">
                  <div class="signature-detail">
                    <div class="detail-label">Email :</div>
                    <div class="detail-value">${escapeHtml(model.salesperson.email)}</div>
                  </div>
                </div>
              </div>
            </div>
            ${renderApproverSignatureColumn(model)}
          </div>

          <div class="doc-footer">
            <div>Effective Date : ${escapeHtml(model.effectiveDate)}</div>
            <div>${escapeHtml(model.documentCode)}</div>
          </div>
        </div>
      </div>`;
  }

  // Full footer with totals and signatures
  return `
      <div class="footer-stack">
        <div class="footer-summary-block">
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
                  <div class="job-value">: ${escapeHtml(model.jobNo)}</div>
                </div>
              </div>
            </div>
            <div class="totals-panel">
              <table class="totals">
                ${renderTotalsRows(totals, model.vatLabel, showTotalValues)}
              </table>
            </div>
          </div>
        </div>

        <div class="signature-block">
          <div class="signature-grid">
            <div class="signature-col signature-customer">
              <div class="signature-sign"></div>
              <div class="signature-line"></div>
              <div class="signature-meta">
                <div class="signature-meta-row"></div>
                <div class="signature-meta-row centered">
                  <div class="signature-caption centered">Customer Confirmed</div>
                </div>
                <div class="signature-meta-row centered">
                  <div class="signature-date">Date_____/_____/_____</div>
                </div>
              </div>
            </div>
            <div class="signature-col signature-salesperson">
              <div class="signature-sign">
                ${model.salesperson.signature ? `<img src="${escapeHtml(model.salesperson.signature)}" alt="With By Signature" class="signature-image">` : ''}
              </div>
              <div class="signature-line"></div>
              <div class="signature-meta">
                <div class="signature-meta-row">
                  <div class="signature-detail">
                    <div class="detail-label">With By</div>
                    <div class="detail-value">${escapeHtml(model.salesperson.name)}</div>
                  </div>
                </div>
                <div class="signature-meta-row">
                  <div class="signature-detail">
                    <div class="detail-label">Tel</div>
                    <div class="detail-value">${escapeHtml(model.salesperson.phone)}</div>
                  </div>
                </div>
                <div class="signature-meta-row">
                  <div class="signature-detail">
                    <div class="detail-label">Email :</div>
                    <div class="detail-value">${escapeHtml(model.salesperson.email)}</div>
                  </div>
                </div>
              </div>
            </div>
            ${renderApproverSignatureColumn(model)}
          </div>

          <div class="doc-footer">
            <div>Effective Date : ${escapeHtml(model.effectiveDate)}</div>
            <div>${escapeHtml(model.documentCode)}</div>
          </div>
        </div>
      </div>`;
}

function buildRowMeasurementHtml(model, layoutSettings = DEFAULT_PRINT_LAYOUT_SETTINGS) {
  const settings = normalizePrintLayoutSettings(layoutSettings);
  const measurementRows = model.lineItems.map((line, index) => `
    <table class="line-table line-table-measure">
      ${renderLineTableHeader()}
      <tbody data-print-line-measure="${index}">${renderLineRows([line])}</tbody>
    </table>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(model.ourRef || 'Sales Quote')} Row Measurement</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      background: #fff;
      color: #000;
      font-family: Tahoma, Arial, sans-serif;
      font-size: ${settings.baseFontSize}px;
      line-height: 1.22;
    }
    body {
      width: 210mm;
      padding: 0 9mm;
      opacity: 0;
      overflow: hidden;
    }
    .line-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 0; table-layout: fixed; font-size: ${settings.lineTableFontSize}px; line-height: 1.3; }
    .line-table thead { display: table-header-group; }
    .line-table th {
      background: #d9d9d9;
      color: #000;
      font-size: ${settings.lineTableHeaderFontSize}px;
      font-weight: 700;
      padding: 2.35mm 0.85mm;
      text-align: center;
    }
    .line-table th:first-child { text-align: left; }
    .line-table th:nth-child(2) { text-align: center; }
    .line-table td {
      padding: 0.95mm 1.15mm;
      vertical-align: top;
    }
    .line-table tr { page-break-inside: avoid; }
    .line-table-measure { margin-bottom: 0; }
    .item-cell { white-space: nowrap; text-align: left; padding-right: 1.6mm; }
    .item-cell-value { display: inline-block; }
    .desc-cell { word-break: break-word; padding-left: 1.2mm; }
    .qty-cell,
    .num-cell { text-align: right; white-space: nowrap; }
    .unit-cell { text-align: center; white-space: nowrap; }
    .line-main-row td { min-height: 6.8mm; }
    .line-comment-row td { padding-top: 0.35mm; padding-bottom: 0.7mm; }
    .line-comment-row .desc-cell { padding-left: 1.2mm; }
    .line-group-header .item-cell { padding-left: 0.85mm; padding-right: 0; }
    .line-group-header .item-cell .item-cell-value { min-width: 4.6mm; text-align: center; transform: translateX(1.15mm); }
    .line-group-header .desc-cell,
    .line-comment-row.line-group-header .desc-cell { padding-left: 0; padding-right: 0; }
    .line-group-child .desc-cell { padding-left: 8mm; }
    .line-comment-row.line-group-child .desc-cell { padding-left: 8mm; }
    .line-group-total-row td { padding-top: 1.25mm; padding-bottom: 0.9mm; }
    .group-total-label-cell { font-weight: 700; text-align: left; padding-left: 0; }
    .group-total-label-text { display: block; width: 100%; white-space: nowrap; transform: none; }
    .group-total-amount-cell { text-align: right; }
    .group-total-amount { display: block; width: 100%; max-width: 100%; box-sizing: border-box; padding-bottom: 0.95mm; text-align: right; border-bottom: 4px double #000; }
    .empty-row { text-align: center; color: #666; padding: 6mm 0; }
  </style>
</head>
<body>
  ${measurementRows}
</body>
</html>`;
}

function waitForPrintWindowReady(printWindow) {
  return new Promise(resolve => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      printWindow.setTimeout(resolve, 80);
    };

    if (printWindow.document.readyState === 'complete') {
      finish();
      return;
    }

    printWindow.addEventListener('load', finish, { once: true });
    printWindow.setTimeout(finish, 1500);
  });
}

async function measurePrintableRowHeights(printWindow, model, settings) {
  try {
    printWindow.document.open();
    printWindow.document.write(buildRowMeasurementHtml(model, settings));
    printWindow.document.close();
    await waitForPrintWindowReady(printWindow);

    const measuredHeights = Array.from(
      printWindow.document.querySelectorAll('[data-print-line-measure]')
    ).map(element => element.getBoundingClientRect().height * CSS_PX_TO_MM);

    return measuredHeights.length === model.lineItems.length
      ? measuredHeights
      : null;
  } catch (error) {
    console.warn('Falling back to estimated Sales Quote print row heights:', error);
    return null;
  }
}

/**
 * Build multi-page HTML for documents that span multiple pages
 */
function buildMultiPageHtml(model, layoutSettings = DEFAULT_PRINT_LAYOUT_SETTINGS, measuredRowHeights = null) {
  const settings = normalizePrintLayoutSettings(layoutSettings);
  const customerAddressLines = renderAddressLines(model.customerAddressLines, 2);
  const metaRowsMarkup = renderMetaRows(model, customerAddressLines);
  const metaColumnWidths = resolveMetaTableColumnWidths(settings);
  const signatureSignHeightMm = Math.max(settings.signatureSignMinHeightMm, 22);
  const reservedFooterHeightMm = PRINT_RESERVED_FOOTER_HEIGHT_MM;

  // Chunk line items into pages
  const pageChunks = chunkLineItemsForPages(model.lineItems, settings, true, measuredRowHeights);
  const totalPages = pageChunks.length;

  let pagesHtml = '';

  for (let i = 0; i < pageChunks.length; i++) {
    const chunk = pageChunks[i];
    const pageNumber = i + 1;
    const isLastPage = i === pageChunks.length - 1;

    // ALL pages have identical structure: header, meta, disclaimer, totals, signatures, footer
    // Only line items and page number differ

    // Build page - all pages have full header and meta table
    pagesHtml += `
  <div class="page">
    <div class="page-body">
      ${buildPageHeader(model, settings, pageNumber, totalPages, 'full')}

      <table class="meta-table">
        <colgroup>
          <col style="width: ${metaColumnWidths.label}mm;">
          <col style="width: ${metaColumnWidths.address}mm;">
          <col style="width: ${metaColumnWidths.midLabel}mm;">
          <col style="width: ${metaColumnWidths.midValue}mm;">
          <col style="width: ${metaColumnWidths.rightLabel}mm;">
          <col style="width: ${metaColumnWidths.rightValue}mm;">
        </colgroup>
        ${metaRowsMarkup}
      </table>

      <table class="line-table">
        ${renderLineTableHeader()}
        <tbody>${renderLineRows(chunk.lines)}</tbody>
      </table>
    </div>

    ${buildPageFooter(model, settings, model.totals, 'full', { showTotalValues: isLastPage })}
  </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.ourRef || 'Sales Quote')} Print</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #fff; color: #000; font-family: Tahoma, Arial, sans-serif; font-size: ${settings.baseFontSize}px; line-height: 1.22; }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 0;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      height: 297mm;
      margin: 0 auto;
      position: relative;
      padding: 8.5mm 9mm 8mm;
      padding-bottom: ${reservedFooterHeightMm}mm;
      overflow: hidden;
    }
    .page + .page {
      margin-top: 11mm;
    }
    .page:last-child {
      page-break-after: auto;
    }
    .page-body {
      width: 100%;
      min-height: 0;
    }
    .topbar { display: grid; grid-template-columns: ${Math.max(settings.logoWidthMm + 2 + Math.max(settings.logoOffsetXMm, 0), 30)}mm 1fr 23mm; align-items: start; column-gap: 4mm; }
    .topbar--compact { margin-bottom: 3mm; }
    .main-logo {
      width: ${settings.logoWidthMm}mm;
      height: auto;
      object-fit: contain;
      margin-top: 0.8mm;
      transform: translate(${settings.logoOffsetXMm}mm, ${settings.logoOffsetYMm}mm);
      transform-origin: top left;
    }
    .main-logo--compact { width: 22mm; }
    .company {
      padding-top: 0.5mm;
      transform: translate(${settings.companyBlockOffsetXMm}mm, ${settings.companyBlockOffsetYMm}mm);
      transform-origin: top left;
    }
    .company .th-name { font-size: ${settings.companyThaiFontSize}px; font-weight: 700; line-height: 1.08; margin-bottom: 1mm; }
    .company .en-name { font-size: ${settings.companyEnglishFontSize}px; font-weight: 700; line-height: 1.08; margin-bottom: 1.6mm; }
    .company-line { font-size: ${Math.max(settings.baseFontSize - 0.8, 9)}px; line-height: 1.24; margin-bottom: 0.48mm; }
    .company--compact .th-name { font-size: 13px; margin-bottom: 0.5mm; }
    .company--compact .en-name { font-size: 12px; }
    .page-no { text-align: right; font-size: ${Math.max(settings.baseFontSize - 0.3, 9)}px; font-weight: 400; white-space: nowrap; padding-top: 1.2mm; }
    .title-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      margin: 7mm 0 3.1mm;
      column-gap: 0.8mm;
    }
    .title-row .spacer { min-height: 1px; }
    .title { font-size: ${settings.titleFontSize}px; font-weight: 700; white-space: nowrap; }
    .certs { display: flex; justify-content: flex-start; align-items: flex-end; gap: 1.1mm; min-height: ${8.6 * settings.certsSizeScale}mm; transform: translate(${settings.certsOffsetXMm}mm, ${settings.certsOffsetYMm}mm); }
    .cert-logo { height: ${8.1 * settings.certsSizeScale}mm; width: auto; object-fit: contain; }
    .cert-logo.cert-logo-aemt { max-width: ${22 * settings.certsSizeScale}mm;}
    .meta-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 3.3mm; font-size: ${settings.metaFontSize}px; line-height: 1.18; }
    .meta-table td { padding: 0 1mm 1.8mm 0; vertical-align: top; }
    .meta-table .meta-divider td {
      border-bottom: 1px solid #000;
      padding-bottom: 1.5mm;
    }
    .meta-table .meta-customer-row td {
      padding-top: 0.8mm;
    }
    .meta-table .meta-address-row td {
      padding-top: 1.4mm;
    }
    .meta-table td.label { font-weight: 700; white-space: nowrap; }
    .meta-table td.value { word-break: break-word; }
    .meta-table td.mid-label { font-weight: 700; white-space: nowrap; text-align: right; padding-right: 1.2mm; }
    .meta-table td.mid-value { word-break: break-word; }
    .left-meta-value {
      display: block;
      padding-left: ${settings.leftMetaValuePaddingMm}mm;
      box-sizing: border-box;
    }
    .meta-offset-block {
      position: relative;
      left: ${settings.attentionTelBlockOffsetXMm - 5}mm;
      top: ${settings.attentionTelBlockOffsetYMm}mm;
    }
    .meta-offset-block-label {
      display: inline-block;
    }
    .meta-offset-block-value {
      display: block;
    }
    .meta-attention-value {
      width: ${settings.attentionValueWidthMm}mm;
      max-width: none;
    }
    .meta-table td.right-label { font-weight: 700; white-space: nowrap; }
    .meta-table td.right-value { white-space: nowrap; }
    .right-meta-label,
    .right-meta-value {
      display: block;
      width: 100%;
      text-align: left;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .right-meta-label {
      padding-right: 2mm;
    }
    .right-meta.label.meta-fixed-width {
      display: inline-block;
      width: 13ch;
      text-align: right;
      padding-right: 2.5mm;
    }
    .meta-table td.right-label.shifted {
      position: relative;
      left: -21mm;
    }
    .meta-table td.right-value.shifted {
      position: relative;
      left: -10mm;
    }
    .line-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 1.2mm; table-layout: fixed; font-size: ${settings.lineTableFontSize}px; line-height: 1.3; }
    .line-table thead { display: table-header-group; }
    .line-table th {
      background: #d9d9d9;
      color: #000;
      font-size: ${settings.lineTableHeaderFontSize}px;
      font-weight: 700;
      padding: 2.35mm 0.85mm;
      text-align: center;
    }
    .line-table th:first-child { text-align: left; }
    .line-table th:nth-child(2) {
      text-align: center;
    }
    .line-table td {
      padding: 0.95mm 1.15mm;
      vertical-align: top;
    }
    .line-table tr { page-break-inside: avoid; }
    .item-cell { white-space: nowrap; text-align: left; padding-right: 1.6mm; }
    .item-cell-value { display: inline-block; }
    .desc-cell { word-break: break-word; padding-left: 1.2mm; }
    .qty-cell,
    .num-cell { text-align: right; white-space: nowrap; }
    .unit-cell { text-align: center; white-space: nowrap; }
    .line-main-row td { min-height: 6.8mm; }
    .line-comment-row td { padding-top: 0.35mm; padding-bottom: 0.7mm; }
    .line-comment-row .desc-cell { padding-left: 1.2mm; }
    .line-group-header .item-cell { padding-left: 0.85mm; padding-right: 0; }
    .line-group-header .item-cell .item-cell-value { min-width: 4.6mm; text-align: center; transform: translateX(1.15mm); }
    .line-group-header .desc-cell,
    .line-comment-row.line-group-header .desc-cell { padding-left: 0; padding-right: 0; }
    .line-group-child .desc-cell { padding-left: 8mm; }
    .line-comment-row.line-group-child .desc-cell { padding-left: 8mm; }
    .line-group-total-row td { padding-top: 1.25mm; padding-bottom: 0.9mm; }
    .group-total-label-cell { font-weight: 700; text-align: left; padding-left: 0; }
    .group-total-label-text { display: block; width: 100%; white-space: nowrap; transform: none; }
    .group-total-amount-cell { text-align: right; }
    .group-total-amount { display: block; width: 100%; max-width: 100%; box-sizing: border-box; padding-bottom: 0.95mm; text-align: right; border-bottom: 4px double #000; }
    .footer-stack {
      position: absolute;
      left: 9mm;
      right: 9mm;
      bottom: 5mm;
      margin-top: 0;
      padding-top: 6.6mm;
      max-width: calc(100% - 18mm);
    }
    .footer-stack--partial {
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 1px solid #ccc;
    }
    .footer-summary-block {
      transform: translate(${settings.footerSummaryBlockOffsetXMm}mm, ${settings.footerSummaryBlockOffsetYMm}mm);
      transform-origin: top left;
    }
    .footer-divider { border-top: 1px solid #000; margin-bottom: 1.35mm; }
    .summary-grid { display: grid; grid-template-columns: 1fr 58mm; column-gap: 1mm; align-items: start; }
    .summary-left { min-width: 0; }
    .footer-note { font-size: ${settings.footerNoteFontSize}px; line-height: 1.42; }
    .footer-note div { margin-bottom: 0.9mm; }
    .footer-note .thai { font-weight: 700; }
    .totals-panel { min-width: 0; }
    .totals { width: 100%; border-collapse: separate; border-spacing: 0 0.8mm; table-layout: fixed; }
    .totals td { padding: 0.35mm 0; font-size: ${settings.totalsFontSize}px; font-weight: 700; line-height: 1.35; vertical-align: top; }
    .totals .label-cell { width: 56%; white-space: nowrap; padding-right: 4.5mm; }
    .totals .amount { width: 44%; text-align: right; white-space: nowrap; font-weight: 400; }
    .totals-label-text { display: inline-block; transform: translateX(${settings.totalsOffsetXMm + TOTALS_LABEL_ALIGNMENT_OFFSET_MM}mm); }
    .remark-section { margin-top: 3.1mm; font-size: ${settings.remarkFontSize}px; }
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
    .job-row { margin-top: 1.2mm; }
    .job-value { font-weight: 400; }
    .signature-block {
      transform: translate(${settings.signatureBlockOffsetXMm}mm, ${settings.signatureBlockOffsetYMm + SIGNATURE_BLOCK_BASE_NUDGE_Y_MM}mm);
      transform-origin: top left;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 49mm 57mm 60mm;
      justify-content: space-between;
      column-gap: 0;
      margin-top: ${settings.signatureGridMarginTopMm}mm;
      align-items: start;
    }
    .signature-col {
      min-height: ${settings.signatureColMinHeightMm}mm;
      display: grid;
      grid-template-rows: ${signatureSignHeightMm}mm auto auto;
      align-content: start;
    }
    .signature-sign {
      min-height: ${signatureSignHeightMm}mm;
      height: ${signatureSignHeightMm}mm;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .signature-image {
      display: block;
      max-width: 48mm;
      max-height: 22mm;
      object-fit: contain;
      image-rendering: auto;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .signature-line { width: 100%; border-top: 1px solid #000; margin-top: 1.2mm; }
    .signature-meta {
      display: grid;
      grid-template-rows: repeat(3, minmax(4.8mm, auto));
      row-gap: 1mm;
      margin-top: 1.8mm;
      align-content: start;
    }
    .signature-meta-row {
      min-height: 4.8mm;
      display: flex;
      align-items: baseline;
    }
    .signature-meta-row.centered {
      justify-content: center;
    }
    .signature-caption { font-size: ${settings.signatureFontSize}px; }
    .signature-caption.centered { text-align: center; }
    .signature-detail {
      width: 100%;
      display: grid;
      grid-template-columns: 10mm 1fr;
      column-gap: 1.8mm;
      align-items: baseline;
      font-size: ${settings.signatureFontSize}px;
    }
    .signature-detail .detail-label { white-space: nowrap; }
    .signature-detail .detail-value { min-width: 0; }
    .signature-approver .signature-detail { column-gap: ${APPROVER_DETAIL_COLUMN_GAP_MM}mm; }
    .signature-approver .signature-detail-approver-email .detail-value-email { white-space: nowrap; }
    .signature-customer .signature-date { text-align: center; font-size: ${settings.signatureFontSize}px; }
    .doc-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4.5mm !important; font-size: ${settings.docFooterFontSize}px; }
    .doc-footer > div { min-width: 0; }
    .empty-row { text-align: center; color: #666; padding: 6mm 0; }
  </style>
</head>
<body>
${pagesHtml}
  <script>
    (function () {
      var go = function () { setTimeout(function () { window.print(); }, 180); };
      if (document.readyState === 'complete') { go(); } else { window.addEventListener('load', go, { once: true }); }
    }());
  </script>
</body>
</html>`;
}

/**
 * Build single-page HTML (original behavior for backward compatibility)
 */
function buildPrintHtml(model, layoutSettings = DEFAULT_PRINT_LAYOUT_SETTINGS) {
  const settings = normalizePrintLayoutSettings(layoutSettings);
  const customerAddressLines = renderAddressLines(model.customerAddressLines, 2);
  const metaRowsMarkup = renderMetaRows(model, customerAddressLines);
  const companyMarkup = model.companyLines.slice(2).map(line => `<div class="company-line">${escapeHtml(line)}</div>`).join('');
  const remarkMarkup = model.bottomRemark
    ? escapeHtml(model.bottomRemark)
    : '&nbsp;';
  const certificationMarkup = model.certificationLogos
    .map(src => {
      const isAemt = src.includes('aemt-logo');
      const extraClass = isAemt ? ' cert-logo-aemt' : '';
      return `<img src="${escapeHtml(src)}" alt="" class="cert-logo${extraClass}">`;
    })
    .join('');
  const topbarLogoColumnWidthMm = Math.max(settings.logoWidthMm + 2 + Math.max(settings.logoOffsetXMm, 0), 30);
  const metaColumnWidths = resolveMetaTableColumnWidths(settings);
  const companyLineFontSize = Math.max(settings.baseFontSize - 0.8, 9);
  const pageNoFontSize = Math.max(settings.baseFontSize - 0.3, 9);
  const signatureSignHeightMm = Math.max(settings.signatureSignMinHeightMm, 22);
  const reservedFooterHeightMm = 112;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.ourRef || 'Sales Quote')} Print</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #fff; color: #000; font-family: Tahoma, Arial, sans-serif; font-size: ${settings.baseFontSize}px; line-height: 1.22; }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 0;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      height: 297mm;
      margin: 0 auto;
      position: relative;
      padding: 8.5mm 9mm 8mm;
      padding-bottom: ${reservedFooterHeightMm}mm;
      overflow: hidden;
    }
    .page + .page {
      margin-top: 11mm;
    }
    .page:last-child {
      page-break-after: auto;
    }
    .page-body {
      width: 100%;
      min-height: 0;
    }
    .topbar { display: grid; grid-template-columns: ${topbarLogoColumnWidthMm}mm 1fr 23mm; align-items: start; column-gap: 4mm; }
    .main-logo {
      width: ${settings.logoWidthMm}mm;
      height: auto;
      object-fit: contain;
      margin-top: 0.8mm;
      transform: translate(${settings.logoOffsetXMm}mm, ${settings.logoOffsetYMm}mm);
      transform-origin: top left;
    }
    .company {
      padding-top: 0.5mm;
      transform: translate(${settings.companyBlockOffsetXMm}mm, ${settings.companyBlockOffsetYMm}mm);
      transform-origin: top left;
    }
    .company .th-name { font-size: ${settings.companyThaiFontSize}px; font-weight: 700; line-height: 1.08; margin-bottom: 1mm; }
    .company .en-name { font-size: ${settings.companyEnglishFontSize}px; font-weight: 700; line-height: 1.08; margin-bottom: 1.6mm; }
    .company-line { font-size: ${companyLineFontSize}px; line-height: 1.24; margin-bottom: 0.48mm; }
    .page-no { text-align: right; font-size: ${pageNoFontSize}px; font-weight: 400; white-space: nowrap; padding-top: 1.2mm; }
    .title-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      margin: 7mm 0 3.1mm;
      column-gap: 0.8mm;
    }
    .title-row .spacer { min-height: 1px; }
    .title { font-size: ${settings.titleFontSize}px; font-weight: 700; white-space: nowrap; }
    .certs { display: flex; justify-content: flex-start; align-items: flex-end; gap: 1.1mm; min-height: ${8.6 * settings.certsSizeScale}mm; transform: translate(${settings.certsOffsetXMm}mm, ${settings.certsOffsetYMm}mm); }
    .cert-logo { height: ${8.1 * settings.certsSizeScale}mm; width: auto; object-fit: contain; }
    .cert-logo.cert-logo-aemt { max-width: ${22 * settings.certsSizeScale}mm;}
    .meta-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 3.3mm; font-size: ${settings.metaFontSize}px; line-height: 1.18; }
    .meta-table td { padding: 0 1mm 1.8mm 0; vertical-align: top; }
    .meta-table .meta-divider td {
      border-bottom: 1px solid #000;
      padding-bottom: 1.5mm;
    }
    .meta-table .meta-customer-row td {
      padding-top: 0.8mm;
    }
    .meta-table .meta-address-row td {
      padding-top: 1.4mm;
    }
    .meta-table td.label { font-weight: 700; white-space: nowrap; }
    .meta-table td.value { word-break: break-word; }
    .meta-table td.mid-label { font-weight: 700; white-space: nowrap; text-align: right; padding-right: 1.2mm; }
    .meta-table td.mid-value { word-break: break-word; }
    .left-meta-value {
      display: block;
      padding-left: ${settings.leftMetaValuePaddingMm}mm;
      box-sizing: border-box;
    }
    .meta-offset-block {
      position: relative;
      left: ${settings.attentionTelBlockOffsetXMm - 5}mm;
      top: ${settings.attentionTelBlockOffsetYMm}mm;
    }
    .meta-offset-block-label {
      display: inline-block;
    }
    .meta-offset-block-value {
      display: block;
    }
    .meta-attention-value {
      width: ${settings.attentionValueWidthMm}mm;
      max-width: none;
    }
    .meta-table td.right-label { font-weight: 700; white-space: nowrap; }
    .meta-table td.right-value { white-space: nowrap; }
    .right-meta-label,
    .right-meta-value {
      display: block;
      width: 100%;
      text-align: left;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .right-meta-label {
      padding-right: 2mm;
    }
    .right-meta.label.meta-fixed-width {
      display: inline-block;
      width: 13ch;
      text-align: right;
      padding-right: 2.5mm;
    }
    .meta-table td.right-label.shifted {
      position: relative;
      left: -21mm;
    }
    .meta-table td.right-value.shifted {
      position: relative;
      left: -10mm;
    }
    .line-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 1.2mm; table-layout: fixed; font-size: ${settings.lineTableFontSize}px; line-height: 1.3; }
    .line-table thead { display: table-header-group; }
    .line-table th {
      background: #d9d9d9;
      color: #000;
      font-size: ${settings.lineTableHeaderFontSize}px;
      font-weight: 700;
      padding: 2.35mm 0.85mm;
      text-align: center;
    }
    .line-table th:first-child { text-align: left; }
    .line-table th:nth-child(2) {
      text-align: center;
    }
    .line-table td {
      padding: 0.95mm 1.15mm;
      vertical-align: top;
    }
    .line-table tr { page-break-inside: avoid; }
    .item-cell { white-space: nowrap; text-align: left; padding-right: 1.6mm; }
    .item-cell-value { display: inline-block; }
    .desc-cell { word-break: break-word; padding-left: 1.2mm; }
    .qty-cell,
    .num-cell { text-align: right; white-space: nowrap; }
    .unit-cell { text-align: center; white-space: nowrap; }
    .line-main-row td { min-height: 6.8mm; }
    .line-comment-row td { padding-top: 0.35mm; padding-bottom: 0.7mm; }
    .line-comment-row .desc-cell { padding-left: 1.2mm; }
    .line-group-header .item-cell { padding-left: 0.85mm; padding-right: 0; }
    .line-group-header .item-cell .item-cell-value { min-width: 4.6mm; text-align: center; transform: translateX(1.15mm); }
    .line-group-header .desc-cell,
    .line-comment-row.line-group-header .desc-cell { padding-left: 0; padding-right: 0; }
    .line-group-child .desc-cell { padding-left: 8mm; }
    .line-comment-row.line-group-child .desc-cell { padding-left: 8mm; }
    .line-group-total-row td { padding-top: 1.25mm; padding-bottom: 0.9mm; }
    .group-total-label-cell { font-weight: 700; text-align: left; padding-left: 0; }
    .group-total-label-text { display: block; width: 100%; white-space: nowrap; transform: none; }
    .group-total-amount-cell { text-align: right; }
    .group-total-amount { display: block; width: 100%; max-width: 100%; box-sizing: border-box; padding-bottom: 0.95mm; text-align: right; border-bottom: 4px double #000; }
    .footer-stack {
      position: absolute;
      left: 9mm;
      right: 9mm;
      bottom: 5mm;
      margin-top: 0;
      padding-top: 6.6mm;
      max-width: calc(100% - 18mm);
    }
    .footer-summary-block {
      transform: translate(${settings.footerSummaryBlockOffsetXMm}mm, ${settings.footerSummaryBlockOffsetYMm}mm);
      transform-origin: top left;
    }
    .footer-divider { border-top: 1px solid #000; margin-bottom: 1.35mm; }
    .summary-grid { display: grid; grid-template-columns: 1fr 58mm; column-gap: 1mm; align-items: start; }
    .summary-left { min-width: 0; }
    .footer-note { font-size: ${settings.footerNoteFontSize}px; line-height: 1.42; }
    .footer-note div { margin-bottom: 0.9mm; }
    .footer-note .thai { font-weight: 700; }
    .totals-panel { min-width: 0; }
    .totals { width: 100%; border-collapse: separate; border-spacing: 0 0.8mm; table-layout: fixed; }
    .totals td { padding: 0.35mm 0; font-size: ${settings.totalsFontSize}px; font-weight: 700; line-height: 1.35; vertical-align: top; }
    .totals .label-cell { width: 56%; white-space: nowrap; padding-right: 4.5mm; }
    .totals .amount { width: 44%; text-align: right; white-space: nowrap; font-weight: 400; }
    .totals-label-text { display: inline-block; transform: translateX(${settings.totalsOffsetXMm + TOTALS_LABEL_ALIGNMENT_OFFSET_MM}mm); }
    .remark-section { margin-top: 3.1mm; font-size: ${settings.remarkFontSize}px; }
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
    .job-row { margin-top: 1.2mm; }
    .job-value { font-weight: 400; }
    .signature-block {
      transform: translate(${settings.signatureBlockOffsetXMm}mm, ${settings.signatureBlockOffsetYMm + SIGNATURE_BLOCK_BASE_NUDGE_Y_MM}mm);
      transform-origin: top left;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 49mm 57mm 60mm;
      justify-content: space-between;
      column-gap: 0;
      margin-top: ${settings.signatureGridMarginTopMm}mm;
      align-items: start;
    }
    .signature-col {
      min-height: ${settings.signatureColMinHeightMm}mm;
      display: grid;
      grid-template-rows: ${signatureSignHeightMm}mm auto auto;
      align-content: start;
    }
    .signature-sign {
      min-height: ${signatureSignHeightMm}mm;
      height: ${signatureSignHeightMm}mm;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .signature-image {
      display: block;
      max-width: 48mm;
      max-height: 22mm;
      object-fit: contain;
      image-rendering: auto;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .signature-line { width: 100%; border-top: 1px solid #000; margin-top: 1.2mm; }
    .signature-meta {
      display: grid;
      grid-template-rows: repeat(3, minmax(4.8mm, auto));
      row-gap: 1mm;
      margin-top: 1.8mm;
      align-content: start;
    }
    .signature-meta-row {
      min-height: 4.8mm;
      display: flex;
      align-items: baseline;
    }
    .signature-meta-row.centered {
      justify-content: center;
    }
    .signature-caption { font-size: ${settings.signatureFontSize}px; }
    .signature-caption.centered { text-align: center; }
    .signature-detail {
      width: 100%;
      display: grid;
      grid-template-columns: 10mm 1fr;
      column-gap: 1.8mm;
      align-items: baseline;
      font-size: ${settings.signatureFontSize}px;
    }
    .signature-detail .detail-label { white-space: nowrap; }
    .signature-detail .detail-value { min-width: 0; }
    .signature-approver .signature-detail { column-gap: ${APPROVER_DETAIL_COLUMN_GAP_MM}mm; }
    .signature-approver .signature-detail-approver-email .detail-value-email { white-space: nowrap; }
    .signature-customer .signature-date { text-align: center; font-size: ${settings.signatureFontSize}px; }
    .doc-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4.5mm !important; font-size: ${settings.docFooterFontSize}px; }
    .doc-footer > div { min-width: 0; }
    .empty-row { text-align: center; color: #666; padding: 6mm 0; }

    @media screen {
      body {
        padding: 8mm 0 16mm;
        background: #f3f4f6;
      }
      .page {
        background: #fff;
        box-shadow: 0 12px 36px rgba(15, 23, 42, 0.16);
      }
    }

    @media print {
      .page {
        width: 100%;
        margin: 0;
        page-break-after: always;
      }
      .page + .page {
        margin-top: 0;
      }
      .page:last-child {
        page-break-after: auto;
      }
      .line-table tr {
        page-break-inside: avoid;
      }
      .footer-stack {
        page-break-inside: avoid;
      }
      .signature-grid {
        page-break-inside: avoid;
      }
      .topbar,
      .title-row,
      .meta-table {
        page-break-after: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="page-body">
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
          <col style="width: ${metaColumnWidths.label}mm;">
          <col style="width: ${metaColumnWidths.address}mm;">
          <col style="width: ${metaColumnWidths.midLabel}mm;">
          <col style="width: ${metaColumnWidths.midValue}mm;">
          <col style="width: ${metaColumnWidths.rightLabel}mm;">
          <col style="width: ${metaColumnWidths.rightValue}mm;">
        </colgroup>
        ${metaRowsMarkup}
      </table>

      <table class="line-table">
        <thead>
          <tr>
            <th style="width: 6.5%;">Item</th>
            <th style="width: 38.5%;">Description</th>
            <th style="width: 8.5%;">Qty</th>
            <th style="width: 6%;">@</th>
            <th style="width: 15.5%;">Unit/Price</th>
            <th style="width: 10.5%;">Discount</th>
            <th style="width: 14.5%;">Total</th>
          </tr>
        </thead>
        <tbody>${renderLineRows(model.lineItems)}</tbody>
      </table>
    </div>

    <div class="footer-stack">
      <div class="footer-summary-block">
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
                <div class="job-value">: ${escapeHtml(model.jobNo)}</div>
              </div>
            </div>
          </div>
          <div class="totals-panel">
            <table class="totals">
              <tr><td class="label-cell"><span class="totals-label-text">Total</span></td><td class="amount">${escapeHtml(formatCurrency(model.totals.subtotal))}</td></tr>
              <tr><td class="label-cell"><span class="totals-label-text">Trade Discount</span></td><td class="amount">${escapeHtml(formatCurrency(model.totals.tradeDiscount))}</td></tr>
              <tr><td class="label-cell"><span class="totals-label-text">Sub Total</span></td><td class="amount">${escapeHtml(formatCurrency(model.totals.afterDiscount))}</td></tr>
              <tr><td class="label-cell"><span class="totals-label-text">${escapeHtml(model.vatLabel)}</span></td><td class="amount">${escapeHtml(formatCurrency(model.totals.vatAmount))}</td></tr>
              <tr><td class="label-cell"><span class="totals-label-text">Grand Total</span></td><td class="amount">${escapeHtml(formatCurrency(model.totals.grandTotal))}</td></tr>
            </table>
          </div>
        </div>
      </div>

      <div class="signature-block">
        <div class="signature-grid">
          <div class="signature-col signature-customer">
            <div class="signature-sign"></div>
            <div class="signature-line"></div>
            <div class="signature-meta">
              <div class="signature-meta-row"></div>
              <div class="signature-meta-row centered">
                <div class="signature-caption centered">Customer Confirmed</div>
              </div>
              <div class="signature-meta-row centered">
                <div class="signature-date">Date_____/_____/_____</div>
              </div>
            </div>
          </div>
          <div class="signature-col signature-salesperson">
            <div class="signature-sign">
              ${model.salesperson.signature ? `<img src="${escapeHtml(model.salesperson.signature)}" alt="With By Signature" class="signature-image">` : ''}
            </div>
            <div class="signature-line"></div>
            <div class="signature-meta">
              <div class="signature-meta-row">
                <div class="signature-detail">
                  <div class="detail-label">With By</div>
                  <div class="detail-value">${escapeHtml(model.salesperson.name)}</div>
                </div>
              </div>
              <div class="signature-meta-row">
                <div class="signature-detail">
                  <div class="detail-label">Tel</div>
                  <div class="detail-value">${escapeHtml(model.salesperson.phone)}</div>
                </div>
              </div>
              <div class="signature-meta-row">
                <div class="signature-detail">
                  <div class="detail-label">Email :</div>
                  <div class="detail-value">${escapeHtml(model.salesperson.email)}</div>
                </div>
              </div>
            </div>
          </div>
          ${renderApproverSignatureColumn(model)}
        </div>

        <div class="doc-footer">
          <div>Effective Date : ${escapeHtml(model.effectiveDate)}</div>
          <div>${escapeHtml(model.documentCode)}</div>
        </div>
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

/**
 * Detect if the quote content will overflow a single page
 */
function willOverflowSinglePage(model, settings) {
  const pageHeight = 279; // A4 printable height
  const bodyPaddingTop = 8.5;
  const bodyPaddingBottom = 8;

  // Single page has: full header + meta table + line table header + line items + full footer
  const topbarHeight = 18;
  const titleRowHeight = 14;
  const metaTableHeight = 42;
  const lineTableHeaderHeight = 9;
  const footerHeight = 95;

  // Calculate available space for line items on a single page
  const singlePageAvailable = pageHeight - bodyPaddingTop - bodyPaddingBottom
    - topbarHeight - titleRowHeight - metaTableHeight - lineTableHeaderHeight - footerHeight;

  const rowHeights = calculateRowHeights(model.lineItems, settings);
  const totalLineItemsHeight = rowHeights.reduce((sum, h) => sum + h, 0);

  return totalLineItemsHeight > singlePageAvailable;
}

export async function printSearchedSalesQuote() {
  let printWindow = null;

  try {
    const model = await buildModel();
    printWindow = window.open('', '_blank');

    if (!printWindow) {
      throw new Error('Popup was blocked. Please allow popups for this site and try again.');
    }

    printWindow.document.open();
    printWindow.document.write('<!DOCTYPE html><html><head><title>Preparing print preview...</title></head><body style="font-family: Tahoma, Arial, sans-serif; padding: 24px;">Preparing print preview...</body></html>');
    printWindow.document.close();

    const layoutSettings = await loadPrintLayoutSettings();
    const normalizedSettings = normalizePrintLayoutSettings(layoutSettings);
    const measuredRowHeights = await measurePrintableRowHeights(printWindow, model, normalizedSettings);

    // Use multi-page mode (split content across pages)
    printWindow.document.open();
    printWindow.document.write(buildMultiPageHtml(model, normalizedSettings, measuredRowHeights));
    printWindow.document.close();
    showToast(`Opening print preview for ${state.quote.number}`, 'success');
  } catch (error) {
    if (printWindow && !printWindow.closed) {
      printWindow.close();
    }
    console.error('Unable to print Sales Quote:', error);
    showError(error.message || 'Unable to print Sales Quote right now.');
  }
}

if (typeof window !== 'undefined') {
  window.printSearchedSalesQuote = printSearchedSalesQuote;
}
