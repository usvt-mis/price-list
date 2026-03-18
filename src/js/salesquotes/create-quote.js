/**
 * Sales Quotes Create Quote Logic
 * Handles quote creation, line management, and BC API integration
 */

import { state, addQuoteLine, insertQuoteLine, removeQuoteLine, clearQuoteLines, setQuoteCustomer, saveState, calculateTotals, initNewQuote, resetDropdownValidationState } from './state.js';
import { bcClient } from './bc-api-client.js';
import { GATEWAY_API } from './config.js';
import { validateQuote, validateAndUpdate, sanitizeQuoteData, validateQuoteLineData, sanitizeDiscountInput } from './validations.js';
import { showLoading, hideLoading, showSaving, hideSaving, showSuccess, showError, clearToasts, showQuoteCreatedSuccess, showQuoteSendFailure } from './ui.js';
import { el, formatCurrency, renderQuoteLines, renderTotals, displaySelectedCustomer, clearCustomerSelection, hideCustomerDropdown, hideItemDropdown, openAddLineModal, closeAddLineModal, updateLineTotalPreview, displayValidationErrors, clearValidationErrors, getQuoteFormData, populateQuoteForm, clearQuoteForm, setupRequiredAsteriskHandlers, setupEditModalAsteriskHandlers, updateRequiredAsterisk, initDateFields, showConfirmClearQuoteModal, hideConfirmClearQuoteModal, updateFullscreenTable, showToast, switchTab, updateQuoteEditorModeUi, setFieldValue } from './ui.js';
import { cacheCustomers, cacheItems, searchCachedCustomers, searchCachedItems } from './state.js';
import { getUserInfo } from '../auth/ui.js';
import { recordQuoteSubmission } from './records.js';

function normalizeGroupNo(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function normalizeLineType(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return 'Item';
  }

  const canonical = normalized.toLowerCase();
  if (canonical === 'comment' || canonical === '_x2000_' || canonical === '_x0020_') {
    return 'Comment';
  }

  if (canonical === 'item') {
    return 'Item';
  }

  return 'Item';
}

function getGroupServiceItemLockMessage(groupNo) {
  return `Group No ${groupNo} already has a Service Item No. Only one Service Item is allowed per group.`;
}

function setServiceItemFieldLockState(field, locked, { clearValue = false, title = '' } = {}) {
  if (!field) {
    return;
  }

  field.disabled = locked;
  field.classList.toggle('opacity-50', locked);
  field.classList.toggle('cursor-not-allowed', locked);
  field.classList.toggle('bg-slate-50', locked);
  field.classList.toggle('text-slate-600', locked);

  if (clearValue) {
    field.value = '';
  }

  if (title) {
    field.title = title;
  } else {
    field.removeAttribute('title');
  }
}

function normalizeBcDate(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('0001-01-01')) {
    return '';
  }

  return trimmed.slice(0, 10);
}

function normalizeBcBoolean(value, defaultValue = false) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return defaultValue;
    }
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  return Boolean(value);
}

function pickSourceValue(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key];
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || trimmed.startsWith('0001-01-01')) {
        continue;
      }
      return trimmed;
    }

    return value;
  }

  return fallback;
}

function collectSequentialSourceValues(source, prefixes, indexes) {
  return indexes
    .map(index => pickSourceValue(source, prefixes.map(prefix => `${prefix}${index}`), ''))
    .filter(Boolean);
}

function uniqueObjectReferences(values) {
  const seen = new Set();

  return values.filter(value => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function normalizeRecordCollection(value) {
  if (Array.isArray(value)) {
    return value.filter(item => item && typeof item === 'object');
  }

  if (value && typeof value === 'object') {
    return [value];
  }

  return [];
}

function isReportLineSource(line) {
  return [
    'description',
    'Description_SaleLine',
    'itemNo',
    'ItemNo_SaleLine',
    'No_',
    'Line_No_',
    'LineNo',
    'Quantity',
    'Qty_SaleLine',
    'Unit_Price',
    'Type',
    'USVT_Group_No_',
    'USVT_Header',
    'USVT_Footer',
    'USVT_Show_in_Document'
  ].some(key => pickSourceValue(line, [key], null) !== null);
}

function buildReportLookupSources(data) {
  const reportRoot = data?.NavWordReportXmlPart && typeof data.NavWordReportXmlPart === 'object'
    ? data.NavWordReportXmlPart
    : data;
  const headerSource = reportRoot?.Sales_Header && typeof reportRoot.Sales_Header === 'object'
    ? reportRoot.Sales_Header
    : reportRoot;
  const lineSources = uniqueObjectReferences([
    ...normalizeRecordCollection(reportRoot?.salesQuoteLines),
    ...normalizeRecordCollection(reportRoot?.lines),
    ...normalizeRecordCollection(reportRoot?.Integer),
    ...normalizeRecordCollection(reportRoot?.integer),
    ...normalizeRecordCollection(headerSource?.Integer),
    ...normalizeRecordCollection(headerSource?.integer)
  ]);

  return {
    headerSources: uniqueObjectReferences([headerSource, reportRoot, data]),
    lineSources,
    printableLineSources: lineSources.filter(isReportLineSource),
    allSources: uniqueObjectReferences([headerSource, reportRoot, data, ...lineSources])
  };
}

function pickSourceValueFromSources(sources, keys, fallback = '') {
  for (const source of sources) {
    const value = pickSourceValue(source, keys, null);
    if (value !== null) {
      return value;
    }
  }

  return fallback;
}

function collectSequentialSourceValuesFromSources(sources, prefixes, indexes) {
  return indexes
    .map(index => pickSourceValueFromSources(sources, prefixes.map(prefix => `${prefix}${index}`), ''))
    .filter(Boolean);
}

function buildSearchQuoteReportContext(data, resolvedSalespersonName, sourceContext = buildReportLookupSources(data)) {
  const { headerSources, lineSources, printableLineSources, allSources } = sourceContext;
  const customerInfoLines = collectSequentialSourceValuesFromSources(headerSources, ['customerInfo', 'CustomerInfo'], [1, 2, 3, 4, 5, 6, 9, 10]);
  const customerName = customerInfoLines[0]
    || pickSourceValueFromSources(headerSources, ['customerName', 'billToName'], '')
    || '';
  const customerAddressLines = customerInfoLines.length > 1 && customerInfoLines[0] === customerName
    ? customerInfoLines.slice(1)
    : customerInfoLines;

  return {
    companyInfoLines: collectSequentialSourceValuesFromSources(headerSources, ['companyInfoText', 'CompanyInfoText'], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    companyLogo: pickSourceValueFromSources(headerSources, ['companyInfoPicture', 'CompanyInfoPicture'], ''),
    customerName,
    customerInfoLines,
    customerAddressLines,
    salesComments: collectSequentialSourceValuesFromSources(uniqueObjectReferences([...lineSources, ...headerSources]), ['saleComment', 'SaleComment'], [1, 2, 3]),
    billToCustomerNo: pickSourceValueFromSources(headerSources, ['billtoCustomerNo', 'billToCustomerNo', 'BilltoCustomerNo_SalesHeader'], ''),
    sellToCustomerNo: pickSourceValueFromSources(headerSources, ['selltoCustomerNo', 'sellToCustomerNo', 'SelltoCustomerNo_SalesHeader'], ''),
    vatRegistrationNo: pickSourceValueFromSources(headerSources, ['vatRegistrationNo', 'VATRegistrationNo_SalesHeader'], ''),
    shipToName: pickSourceValueFromSources(headerSources, ['shipToName', 'Ship_to_Name'], ''),
    shipToAddress: pickSourceValueFromSources(headerSources, ['shipToAddress', 'Ship_to_Address'], ''),
    shipToContact: pickSourceValueFromSources(headerSources, ['shipToContact', 'Ship_to_Contact'], ''),
    sellToPhoneNo: pickSourceValueFromSources(headerSources, ['sellToPhoneNo', 'Sell_to_Phone_No_'], ''),
    faxNo: pickSourceValueFromSources(headerSources, ['faxNo', 'FaxNo'], ''),
    documentNo: pickSourceValueFromSources(headerSources, ['documentNo', 'quoteNumber', 'salesQuoteNumber', 'No_', 'DocNo_SaleHeader'], ''),
    documentDate: normalizeBcDate(pickSourceValueFromSources(headerSources, ['documentDate', 'DocumentDate_SalesHeader'], '')),
    orderDate: normalizeBcDate(pickSourceValueFromSources(headerSources, ['orderDate', 'OrderDate_SaleHeader', 'Order_Date', 'documentDate', 'DocumentDate_SalesHeader'], '')),
    dueDate: normalizeBcDate(pickSourceValueFromSources(headerSources, ['dueDate', 'DueDate_SalesHeader', 'Due_Date'], '')),
    shipmentDate: normalizeBcDate(pickSourceValueFromSources(headerSources, ['shipmentDate', 'ShipmentDate_SalesHeader'], '')),
    quoteValidUntilDate: normalizeBcDate(pickSourceValueFromSources(headerSources, ['quoteValidUntilDate', 'quoteValidDate', 'QuoteValidDate_SalesHeader', 'Quote_Valid_Until_Date'], '')),
    requestedDeliveryDate: normalizeBcDate(pickSourceValueFromSources(uniqueObjectReferences([...lineSources, ...headerSources]), ['requestedDeliveryDate', 'usvtDeliveryDate', 'USVT_Delivery_Date', 'shipmentDate', 'ShipmentDate_SalesHeader'], '')),
    paymentTermsCode: pickSourceValueFromSources(headerSources, ['paymentTermsCode', 'Payment_Terms_Code'], ''),
    paymentTermsDescription: pickSourceValueFromSources(headerSources, ['paymentTermsDescription', 'descriptionPaymentTerms', 'Description_PaymentTerms'], ''),
    paymentMethodDescription: pickSourceValueFromSources(headerSources, ['paymentMethodDescription', 'descriptionPaymentMethod', 'Description_PaymentMethod'], ''),
    shipMethodDescription: pickSourceValueFromSources(headerSources, ['shipMethodDescription', 'descriptionShipMethod', 'Description_ShipMethod'], ''),
    externalDocumentNo: pickSourceValueFromSources(headerSources, ['externalDocumentNo', 'exDocNo', 'ExDocNo_SalesHeader'], ''),
    vatText: pickSourceValueFromSources(uniqueObjectReferences([...lineSources, ...headerSources]), ['vatText', 'VATText'], ''),
    dimensionName: pickSourceValueFromSources(headerSources, ['dimensionName', 'DimensionName'], ''),
    usvtShipTo: pickSourceValueFromSources(headerSources, ['usvtShipTo', 'USVT_Ship_To'], ''),
    billToContact: pickSourceValueFromSources(headerSources, ['billToContact', 'Bill_to_Contact'], ''),
    reportNumber: pickSourceValueFromSources(headerSources, ['reportNumber', 'ReportNumber'], ''),
    requestSignatureUserSetup: pickSourceValueFromSources(headerSources, ['requestSignatureUserSetup', 'RequestSignature_UserSetup'], ''),
    requestSignature: {
      name: pickSourceValueFromSources(headerSources, ['requestSignatureName', 'RequestSignature_Name', 'requestUserName', 'RequestUser_Name', 'requestSignatureUserSetup', 'RequestSignature_UserSetup'], ''),
      phone: pickSourceValueFromSources(headerSources, ['requestSignaturePhoneNo', 'RequestSignature_PhoneNo'], ''),
      email: pickSourceValueFromSources(headerSources, ['requestSignatureEmail', 'RequestSignature_Email'], ''),
      signature: pickSourceValueFromSources(headerSources, ['requestSignaturePicture', 'RequestSignature_Picture', 'requestSignatureSignature', 'RequestSignature_Signature', 'requestSignatureUserSetup', 'RequestSignature_UserSetup'], '')
    },
    archivedVersionCount: pickSourceValueFromSources(headerSources, ['noArchivedVersions', 'noArchivedVersionsSalesHeader', 'NoArchivedVersions_SalesHeader'], ''),
    salesperson: {
      name: pickSourceValueFromSources(headerSources, ['salespersonName', 'nameSalesperson', 'Name_Salesperson'], resolvedSalespersonName || ''),
      phone: pickSourceValueFromSources(headerSources, ['salespersonPhone', 'phoneNoSalesperson', 'PhoneNo_Salesperson'], ''),
      email: pickSourceValueFromSources(headerSources, ['salespersonEmail', 'emailSalesperson', 'Email_Salesperson'], ''),
      signature: pickSourceValueFromSources(headerSources, ['signatureSalesperson', 'Signature_Salesperson'], '')
    },
    approver: {
      name: pickSourceValueFromSources(headerSources, ['approveUserName', 'ApproveUser_Name'], ''),
      phone: pickSourceValueFromSources(headerSources, ['approveSignaturePhoneNo', 'ApproveSignature_PhoneNo'], ''),
      email: pickSourceValueFromSources(headerSources, ['approveSignatureEmail', 'ApproveSignature_Email'], ''),
      signature: pickSourceValueFromSources(headerSources, ['approveSignatureUserSetup', 'ApproveSignature_UserSetup'], '')
    },
    reportTotals: {
      total: pickSourceValueFromSources(allSources, ['total', 'Total'], ''),
      totalAmt1: pickSourceValueFromSources(allSources, ['totalAmt1', 'TotalAmt1'], ''),
      totalAmt2: pickSourceValueFromSources(allSources, ['totalAmt2', 'TotalAmt2'], ''),
      totalAmt3: pickSourceValueFromSources(allSources, ['totalAmt3', 'TotalAmt3'], ''),
      totalAmt4: pickSourceValueFromSources(allSources, ['totalAmt4', 'TotalAmt4'], ''),
      totalAmt5: pickSourceValueFromSources(allSources, ['totalAmt5', 'TotalAmt5'], ''),
      grandTotalText: pickSourceValueFromSources(allSources, ['varGrandTotalAmtTH', 'var_GrandTotalAmtTH'], '')
    },
    rawLines: printableLineSources.map((line, index) => ({
      bcId: line?.id || line?.bcId || null,
      sequence: Number(line?.sequence ?? line?.lineNo ?? line?.LineNo ?? line?.Line_No_) || index + 1,
      groupNo: normalizeGroupNo(line?.usvtGroupNo ?? line?.groupNo ?? line?.USVT_Group_No_),
      showInDocument: normalizeBcBoolean(line?.usvtShowInDocument ?? line?.showInDocument ?? line?.USVT_Show_in_Document, true),
      isHeader: normalizeBcBoolean(line?.usvtHeader ?? line?.header ?? line?.USVT_Header, false),
      isFooter: normalizeBcBoolean(line?.usvtFooter ?? line?.footer ?? line?.USVT_Footer, false),
      type: typeof (line?.type ?? line?.Type ?? line?.lineType) === 'string'
        ? String(line?.type ?? line?.Type ?? line?.lineType).trim()
        : '',
      description: pickSourceValue(line, ['description', 'Description_SaleLine'], '')
    }))
  };
}

function normalizeSalesQuoteNumberInput(value) {
  return String(value || '').trim().toUpperCase();
}

function setSearchSalesQuoteFeedback(type, title, message) {
  const container = el('searchSalesQuoteResult');
  const titleEl = el('searchSalesQuoteResultTitle');
  const messageEl = el('searchSalesQuoteResultMessage');

  if (!container || !titleEl || !messageEl) {
    return;
  }

  if (!title && !message) {
    container.classList.add('hidden');
    titleEl.textContent = '';
    messageEl.textContent = '';
    return;
  }

  container.classList.remove(
    'hidden',
    'border-slate-200',
    'bg-slate-50',
    'border-emerald-200',
    'bg-emerald-50',
    'border-rose-200',
    'bg-rose-50',
    'border-amber-200',
    'bg-amber-50'
  );
  titleEl.classList.remove('text-slate-900', 'text-emerald-900', 'text-rose-900', 'text-amber-900');
  messageEl.classList.remove('text-slate-600', 'text-emerald-800', 'text-rose-800', 'text-amber-800');

  if (type === 'success') {
    container.classList.add('border-emerald-200', 'bg-emerald-50');
    titleEl.classList.add('text-emerald-900');
    messageEl.classList.add('text-emerald-800');
  } else if (type === 'error') {
    container.classList.add('border-rose-200', 'bg-rose-50');
    titleEl.classList.add('text-rose-900');
    messageEl.classList.add('text-rose-800');
  } else if (type === 'loading') {
    container.classList.add('border-amber-200', 'bg-amber-50');
    titleEl.classList.add('text-amber-900');
    messageEl.classList.add('text-amber-800');
  } else {
    container.classList.add('border-slate-200', 'bg-slate-50');
    titleEl.classList.add('text-slate-900');
    messageEl.classList.add('text-slate-600');
  }

  titleEl.textContent = title || '';
  messageEl.textContent = message || '';
}

function setSearchSalesQuoteLoading(isLoading) {
  const button = el('searchSalesQuoteBtn');
  const input = el('searchSalesQuoteNumber');
  const searchInputValue = normalizeSalesQuoteNumberInput(input?.value);

  state.ui.searchingQuote = isLoading;

  if (button) {
    if (!button.dataset.defaultHtml) {
      button.dataset.defaultHtml = button.innerHTML;
    }
    button.disabled = isLoading;
    button.classList.toggle('opacity-70', isLoading);
    button.classList.toggle('cursor-not-allowed', isLoading);
    button.innerHTML = isLoading
      ? '<span class="animate-pulse">Searching...</span>'
      : button.dataset.defaultHtml;
  }

  if (input) {
    input.disabled = isLoading;
  }

  if (isLoading) {
    const loadingMessage = searchInputValue
      ? `Loading ${searchInputValue} from Business Central...`
      : 'Loading Sales Quote from Business Central...';
    showLoading(loadingMessage, 'Searching Sales Quote');
  } else {
    hideLoading();
  }
}

function setDropdownFieldLoadedState(fieldName, value) {
  const fieldState = state.ui.dropdownFields[fieldName];
  if (!fieldState) {
    return;
  }

  fieldState.touched = false;
  fieldState.valid = Boolean(value);
}

function buildCustomerDisplayModel(customerRecord, fallbackCustomerNo, fallbackCustomerName) {
  return {
    id: customerRecord?.CustomerNo || fallbackCustomerNo || '',
    number: customerRecord?.CustomerNo || fallbackCustomerNo || '',
    name: customerRecord?.CustomerName || fallbackCustomerName || '',
    address: customerRecord?.Address || '',
    phone: customerRecord?.Phone || '',
    email: customerRecord?.Email || ''
  };
}

function mapBcLineToEditorLine(line, index) {
  const existingLineId = line?.id || line?.bcId || null;
  const normalizedQuantity = parseFloat(line?.quantity ?? line?.Quantity ?? line?.qty ?? line?.Qty_SaleLine);
  const normalizedUnitPrice = parseFloat(line?.unitPrice ?? line?.Unit_Price);
  const normalizedDiscountAmount = parseFloat(line?.discountAmount ?? line?.lineDiscountAmount ?? line?.Line_Discount_Amount ?? line?.Discount);
  const normalizedDiscountPercent = parseFloat(line?.discountPercent ?? line?.lineDiscountPercent);
  const rawType = typeof (line?.type ?? line?.Type ?? line?.lineType) === 'string'
    ? String(line?.type ?? line?.Type ?? line?.lineType).trim()
    : '';

  return {
    id: existingLineId || `line-${Date.now()}-${index}`,
    bcId: existingLineId,
    bcEtag: line?.['@odata.etag'] || line?.bcEtag || null,
    documentId: line?.documentId || null,
    documentNo: line?.documentNo || line?.documentNumber || line?.Number || '',
    sequence: Number(line?.sequence ?? line?.lineNo ?? line?.LineNo ?? line?.Line_No_) || index + 1,
    itemId: line?.itemId || null,
    accountId: line?.accountId || null,
    lineType: normalizeLineType(line?.lineType ?? line?.type ?? line?.Type),
    rawType,
    lineObjectNumber: line?.lineObjectNumber || line?.itemNo || line?.ItemNo_SaleLine || line?.no || line?.No_ || line?.number || '',
    description: line?.description || line?.Description_SaleLine || '',
    description2: line?.description2 || '',
    unitOfMeasureId: line?.unitOfMeasureId || null,
    unitOfMeasureCode: line?.unitOfMeasureCode || line?.Unit_of_Measure || '',
    unitPrice: Number.isFinite(normalizedUnitPrice) ? normalizedUnitPrice : 0,
    quantity: Number.isFinite(normalizedQuantity) ? normalizedQuantity : 0,
    discountAmount: Number.isFinite(normalizedDiscountAmount) ? normalizedDiscountAmount : 0,
    discountPercent: Number.isFinite(normalizedDiscountPercent) ? normalizedDiscountPercent : 0,
    discountAppliedBeforeTax: Boolean(line?.discountAppliedBeforeTax),
    amountExcludingTax: parseFloat(line?.amountExcludingTax ?? line?.lineAmount ?? line?.Line_Amount ?? line?.Total) || 0,
    taxCode: line?.taxCode || '',
    taxPercent: parseFloat(line?.taxPercent) || 0,
    totalTaxAmount: parseFloat(line?.totalTaxAmount) || 0,
    amountIncludingTax: parseFloat(line?.amountIncludingTax) || 0,
    netAmount: parseFloat(line?.netAmount) || 0,
    netTaxAmount: parseFloat(line?.netTaxAmount) || 0,
    netAmountIncludingTax: parseFloat(line?.netAmountIncludingTax) || 0,
    itemVariantId: line?.itemVariantId || null,
    locationId: line?.locationId || null,
    locationCode: line?.locationCode || '',
    shortcutDimension2Code: line?.shortcutDimension2Code || '',
    usvtGroupNo: normalizeGroupNo(line?.usvtGroupNo ?? line?.groupNo ?? line?.USVT_Group_No_),
    usvtServiceItemNo: line?.usvtServiceItemNo || line?.serviceItemNo || '',
    usvtServiceItemDescription: line?.usvtServiceItemDescription || line?.serviceItemDescription || '',
    usvtUServiceStatus: line?.usvtUServiceStatus || line?.uServiceStatus || '',
    usvtRefServiceOrderNo: line?.usvtRefServiceOrderNo || line?.refServiceOrderNo || '',
    usvtCreateSv: Boolean(line?.usvtCreateSv || line?.createSv || line?.usvtServiceItemNo || line?.serviceItemNo),
    usvtAddition: Boolean(line?.usvtAddition || line?.addition),
    usvtRefSalesQuoteno: line?.usvtRefSalesQuoteno || line?.usvtRefSalesQuoteNo || line?.refSalesQuoteno || line?.refSalesQuoteNo || '',
    showInDocument: normalizeBcBoolean(line?.usvtShowInDocument ?? line?.showInDocument ?? line?.USVT_Show_in_Document, true),
    printHeader: normalizeBcBoolean(line?.usvtHeader ?? line?.header ?? line?.USVT_Header, false),
    printFooter: normalizeBcBoolean(line?.usvtFooter ?? line?.footer ?? line?.USVT_Footer, false)
  };
}

async function fetchCustomerDetails(customerNo, fallbackCustomerName) {
  if (!customerNo) {
    return {
      CustomerNo: '',
      CustomerName: fallbackCustomerName || ''
    };
  }

  try {
    const response = await fetch(`/api/business-central/customers/${encodeURIComponent(customerNo)}`);
    if (!response.ok) {
      throw new Error(`Customer lookup failed with HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Unable to enrich searched quote customer from local database:', error);
    return {
      CustomerNo: customerNo,
      CustomerName: fallbackCustomerName || ''
    };
  }
}

async function fetchSalespersonDisplayName(salespersonCode) {
  if (!salespersonCode || salespersonCode.trim().length < 2) {
    return '';
  }

  try {
    const response = await fetch(`/api/business-central/salespeople/search?q=${encodeURIComponent(salespersonCode.trim())}&limit=10`);
    if (!response.ok) {
      throw new Error(`Salesperson lookup failed with HTTP ${response.status}`);
    }

    const salespeople = await response.json();
    const match = salespeople.find(salesperson => salesperson.SalespersonCode === salespersonCode.trim());
    return match?.SalespersonName || '';
  } catch (error) {
    console.warn('Unable to enrich searched quote salesperson from local database:', error);
    return '';
  }
}

function closeOpenQuoteModals() {
  closeAddLineModal();

  const editModal = document.getElementById('editLineModal');
  if (editModal && !editModal.classList.contains('hidden')) {
    closeEditLineModal();
  }

  hideConfirmClearQuoteModal();
}

function restoreDefaultBranchFields() {
  const {
    branch = '',
    locationCode = '',
    responsibilityCenter = ''
  } = state.ui.branchDefaults || {};

  if (el('branch')) {
    el('branch').value = branch;
  }
  if (el('locationCode')) {
    el('locationCode').value = locationCode;
  }
  if (el('responsibilityCenter')) {
    el('responsibilityCenter').value = responsibilityCenter;
  }

  state.quote.branch = branch;
  state.quote.locationCode = locationCode;
  state.quote.responsibilityCenter = responsibilityCenter;

  const branchAsterisk = el('branch-asterisk');
  if (branchAsterisk) {
    branchAsterisk.classList.toggle('hidden', Boolean(branch));
  }
}

function resetQuoteEditorToCreateMode({ showFeedback = true } = {}) {
  closeOpenQuoteModals();
  initNewQuote();
  clearQuoteForm();
  clearQuoteLines();
  resetDropdownValidationState();
  restoreDefaultBranchFields();
  renderQuoteLines();
  renderTotals();
  updateQuoteEditorModeUi();
  saveState();

  if (showFeedback) {
    showSuccess('Ready to create a new Sales Quote');
  }
}

function startNewSalesQuoteFlow() {
  resetQuoteEditorToCreateMode();
  switchTab('create');
  saveState();
}

async function buildEditableQuoteFromSearchResponse(payload) {
  const data = payload?.data || payload?.result?.data || payload?.result;
  if (!data || typeof data !== 'object') {
    throw new Error('Business Central did not return Sales Quote data for this number.');
  }

  const sourceContext = buildReportLookupSources(data);
  const { headerSources, printableLineSources } = sourceContext;
  const customerNumber = pickSourceValueFromSources(
    headerSources,
    ['customerNumber', 'billToCustomerNo', 'billtoCustomerNo', 'BilltoCustomerNo_SalesHeader', 'sellToCustomerNo', 'selltoCustomerNo', 'SelltoCustomerNo_SalesHeader'],
    ''
  );
  const salespersonCode = pickSourceValueFromSources(
    headerSources,
    ['salespersonCode', 'salesPersonCode'],
    ''
  );
  const [customerRecord, salespersonName] = await Promise.all([
    fetchCustomerDetails(customerNumber, pickSourceValueFromSources(headerSources, ['customerName', 'billToName'], '')),
    fetchSalespersonDisplayName(salespersonCode)
  ]);

  const branchCode = pickSourceValueFromSources(headerSources, ['branchCode', 'responsibilityCenter', 'shortcutDimension1Code'], '')
    || state.ui.branchDefaults.branch
    || '';
  const responsibilityCenter = pickSourceValueFromSources(headerSources, ['responsibilityCenter', 'branchCode', 'shortcutDimension1Code'], branchCode);
  const locationCode = pickSourceValueFromSources(headerSources, ['locationCode'], '');
  const reportContext = buildSearchQuoteReportContext(data, salespersonName, sourceContext);
  const customerName = reportContext.customerName
    || pickSourceValueFromSources(headerSources, ['customerName', 'billToName'], '')
    || customerRecord.CustomerName
    || '';
  const customerDisplay = {
    ...buildCustomerDisplayModel(customerRecord, customerNumber, customerName),
    phone: customerRecord?.Phone || reportContext.sellToPhoneNo || '',
    address: customerRecord?.Address || reportContext.customerAddressLines?.[0] || '',
    email: customerRecord?.Email || ''
  };

  return {
    id: pickSourceValueFromSources(headerSources, ['id'], null),
    number: pickSourceValueFromSources(headerSources, ['number', 'quoteNumber', 'salesQuoteNumber', 'No_', 'DocNo_SaleHeader'], payload.salesQuoteNumber || null),
    etag: data['@odata.etag'] || null,
    status: data.status || '',
    workStatus: data.workStatus || data.WorkStatus || data.workstatus || '',
    mode: 'edit',
    loadedFromBc: true,
    processedAt: payload.processedAt || null,
    customerId: customerNumber || null,
    customer: customerDisplay,
    customerNo: customerNumber || null,
    customerName,
    sellTo: {
      address: customerRecord.Address || reportContext.customerAddressLines?.[0] || '',
      address2: customerRecord.Address2 || reportContext.customerAddressLines?.[1] || '',
      city: customerRecord.City || '',
      postCode: customerRecord.PostCode || '',
      vatRegNo: customerRecord.VATRegistrationNo || reportContext.vatRegistrationNo || '',
      taxBranchNo: customerRecord.TaxBranchNo || ''
    },
    orderDate: reportContext.orderDate || '',
    requestedDeliveryDate: reportContext.requestedDeliveryDate || '',
    workDescription: data.workDescription || '',
    contact: pickSourceValueFromSources(headerSources, ['contactName', 'shipToContact', 'billToContact', 'Bill_to_Contact'], ''),
    salespersonCode,
    salespersonName: salespersonName || reportContext.salesperson?.name || '',
    assignedUserId: pickSourceValueFromSources(headerSources, ['assignedUserId'], ''),
    serviceOrderType: data.serviceOrderType || '',
    division: data.shortcutDimension2Code || 'MS1029',
    branch: branchCode,
    locationCode,
    responsibilityCenter,
    invoiceDiscountPercent: parseFloat(data.paymentDiscountPercent) || 0,
    invoiceDiscount: parseFloat(data.discountAmount) || 0,
    vatRate: 7,
    discountAmount: parseFloat(data.discountAmount) || 0,
    reportContext,
    lines: printableLineSources.map((line, index) => mapBcLineToEditorLine(line, index))
  };
}

async function applySearchedSalesQuote(payload) {
  const editableQuote = await buildEditableQuoteFromSearchResponse(payload);

  closeOpenQuoteModals();
  clearValidationErrors();
  resetDropdownValidationState();
  state.quote = editableQuote;
  populateQuoteForm(editableQuote);
  renderQuoteLines();
  renderTotals();
  setDropdownFieldLoadedState('customerNo', editableQuote.customerNo);
  setDropdownFieldLoadedState('salespersonCode', editableQuote.salespersonCode);
  setDropdownFieldLoadedState('assignedUserId', editableQuote.assignedUserId);
  updateQuoteEditorModeUi();
  saveState();

  const processedAtText = editableQuote.processedAt
    ? `BC processed this search at ${new Date(editableQuote.processedAt).toLocaleString('en-GB')}.`
    : 'The quote is now loaded into the editor.';
  setSearchSalesQuoteFeedback(
    'success',
    `Loaded ${editableQuote.number || payload.salesQuoteNumber || 'Sales Quote'}`,
    `${processedAtText} You can now review and edit the quote in the form. Update submission is still disabled for now.`
  );

  switchTab('create');
  saveState();
}

// ============================================================
// Data Loading
// ============================================================

/**
 * Load initial data - initialize the app
 * All data comes from local database, no BC direct connection
 */
export async function loadInitialData() {
  try {
    showLoading('Initializing...');

    // Initialize BC client (just logs init message, no actual config needed)
    await bcClient.initialize();

    // Initialize branch fields
    await initializeBranchFields();

    hideLoading();

  } catch (error) {
    hideLoading();
    console.error('Failed to initialize:', error);
    showError('Failed to initialize. Please refresh the page.');
  }
}

// ============================================================
// Customer Search & Selection
// ============================================================

/**
 * Handle customer search input (BC API - Legacy)
 */
export function handleCustomerSearch(query) {
  state.formData.customerSearchQuery = query;

  if (query.length < 2) {
    hideCustomerDropdown();
    return;
  }

  const customers = searchCachedCustomers(query);
  renderCustomerDropdown(customers);
}

/**
 * Handle customer selection (BC API - Legacy)
 */
export function handleCustomerSelection(customerId) {
  const customer = state.cache.customers.find(c => c.id === customerId);
  if (!customer) {
    showError('Customer not found');
    return;
  }

  setQuoteCustomer(customer);
  displaySelectedCustomer(customer);
  hideCustomerDropdown();

  if (el('customerSearch')) {
    el('customerSearch').value = '';
  }

  showSuccess(`Selected: ${customer.name}`);
}

/**
 * Handle Customer No. search (Local Database - New)
 */
export async function handleCustomerNoSearch(query) {
  const dropdown = el('customerNoDropdown');

  if (!query || query.length < 2) {
    dropdown?.classList.add('hidden');
    return;
  }

  // Show loading state
  dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">Searching...</div>';
  dropdown?.classList.remove('hidden');

  try {
    // Call local database API
    const response = await fetch(`/api/business-central/customers/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const customers = await response.json();

    if (customers.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">No customers found</div>';
      return;
    }

    dropdown.innerHTML = customers.map(customer => `
      <div class="customer-dropdown-item p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
           data-customer-no="${customer.CustomerNo}">
        <div class="font-medium text-gray-900">${customer.CustomerName}</div>
        <div class="text-sm text-gray-600">${customer.CustomerNo}</div>
      </div>
    `).join('');

    // Add click handlers
    dropdown.querySelectorAll('.customer-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const customerNo = item.dataset.customerNo;
        const customer = customers.find(c => c.CustomerNo === customerNo);
        selectCustomerFromLocal(customer);
      });
    });

  } catch (err) {
    console.error('Customer search error:', err);
    dropdown.innerHTML = '<div class="p-3 text-sm text-red-500">Error searching customers</div>';
  }
}

/**
 * Select customer from local database search results
 */
export function selectCustomerFromLocal(customer) {
  // Update state using the updated setQuoteCustomer function
  setQuoteCustomer(customer);

  // Update UI fields
  if (el('customerNoSearch')) {
    el('customerNoSearch').value = customer.CustomerNo;
    // Update asterisk after customer selection
    el('customerNoSearch').dispatchEvent(new Event('input'));
  }

  // Mark as valid selection from dropdown (must be AFTER input event to override the input handler)
  state.ui.dropdownFields.customerNo.touched = true;
  state.ui.dropdownFields.customerNo.valid = true;
  if (el('customerName')) {
    el('customerName').value = customer.CustomerName;
  }
  setFieldValue('sellToAddress', customer.Address || '');
  setFieldValue('sellToAddress2', customer.Address2 || '');
  setFieldValue('sellToCity', customer.City || '');
  setFieldValue('sellToPostCode', customer.PostCode || '');
  setFieldValue('sellToVatRegNo', customer.VATRegistrationNo || '');
  setFieldValue('sellToTaxBranchNo', customer.TaxBranchNo || '');

  // Show Sell-to section
  const sellToSection = el('sellToSection');
  if (sellToSection) {
    sellToSection.classList.remove('hidden');
  }

  // Hide dropdown
  const dropdown = el('customerNoDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }

  showSuccess(`Selected: ${customer.CustomerName}`);
}

// ============================================================
// Salesperson Search & Selection
// ============================================================

export async function handleSalespersonCodeSearch(query) {
  const dropdown = el('salespersonCodeDropdown');
  if (!query || query.length < 2) {
    dropdown?.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">Searching...</div>';
  dropdown?.classList.remove('hidden');

  try {
    const response = await fetch(`/api/business-central/salespeople/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const salespeople = await response.json();

    if (salespeople.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">No salespeople found</div>';
      return;
    }

    dropdown.innerHTML = salespeople.map(sp => `
      <div class="search-dropdown-item p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
           data-salesperson-code="${sp.SalespersonCode}">
        <div class="font-medium text-gray-900">${sp.SalespersonName}</div>
        <div class="text-sm text-gray-600">${sp.SalespersonCode}</div>
      </div>
    `).join('');

    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const salesperson = salespeople.find(s => s.SalespersonCode === item.dataset.salespersonCode);
        selectSalesperson(salesperson);
      });
    });
  } catch (err) {
    console.error('Salesperson search error:', err);
    dropdown.innerHTML = '<div class="p-3 text-sm text-red-500">Error searching salespeople</div>';
  }
}

export function selectSalesperson(salesperson) {
  state.quote.salespersonCode = salesperson.SalespersonCode;
  state.quote.salespersonName = salesperson.SalespersonName;

  if (el('salespersonCodeSearch')) el('salespersonCodeSearch').value = salesperson.SalespersonCode;
  if (el('salespersonName')) el('salespersonName').value = salesperson.SalespersonName;

  // Update asterisk after salesperson selection
  el('salespersonCodeSearch')?.dispatchEvent(new Event('input'));

  // Mark as valid selection from dropdown (must be AFTER input event to override the input handler)
  state.ui.dropdownFields.salespersonCode.touched = true;
  state.ui.dropdownFields.salespersonCode.valid = true;

  el('salespersonCodeDropdown')?.classList.add('hidden');
  showSuccess(`Selected: ${salesperson.SalespersonName}`);
  saveState();
}

// ============================================================
// Assigned User Search & Selection
// ============================================================

export async function handleAssignedUserIdSearch(query) {
  const dropdown = el('assignedUserIdDropdown');
  if (!query || query.length < 2) {
    dropdown?.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">Searching...</div>';
  dropdown?.classList.remove('hidden');

  try {
    const response = await fetch(`/api/business-central/assigned-users/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const users = await response.json();

    if (users.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">No users found</div>';
      return;
    }

    dropdown.innerHTML = users.map(u => `
      <div class="search-dropdown-item p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
           data-user-id="${u.UserId}">
        <div class="font-medium text-gray-900">${u.UserId}</div>
        <div class="text-sm text-gray-600">${u.Branch || ''}</div>
      </div>
    `).join('');

    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const user = users.find(u => u.UserId === item.dataset.userId);
        selectAssignedUser(user);
      });
    });
  } catch (err) {
    console.error('Assigned user search error:', err);
    dropdown.innerHTML = '<div class="p-3 text-sm text-red-500">Error searching users</div>';
  }
}

export function selectAssignedUser(user) {
  state.quote.assignedUserId = user.UserId;

  if (el('assignedUserIdSearch')) el('assignedUserIdSearch').value = user.UserId;

  // Update asterisk after user selection
  el('assignedUserIdSearch')?.dispatchEvent(new Event('input'));

  // Mark as valid selection from dropdown (must be AFTER input event to override the input handler)
  state.ui.dropdownFields.assignedUserId.touched = true;
  state.ui.dropdownFields.assignedUserId.valid = true;

  el('assignedUserIdDropdown')?.classList.add('hidden');
  showSuccess(`Selected: ${user.UserId}`);
  saveState();
}

// ============================================================
// Item Search & Selection
// ============================================================

/**
 * Handle item search input
 */
export function handleItemSearch(query) {
  state.formData.itemSearchQuery = query;

  if (query.length < 2) {
    hideItemDropdown();
    return;
  }

  const items = searchCachedItems(query);
  renderItemDropdown(items);
}

/**
 * Handle item selection in modal
 */
export function handleItemSelection(itemId) {
  const item = state.cache.items.find(i => i.id === itemId);
  if (!item) {
    showError('Item not found');
    return;
  }

  // Populate line form with item data
  if (el('lineDescription')) {
    el('lineDescription').value = item.description;
    el('lineDescription').dispatchEvent(new Event('input')); // Update asterisk
  }
  if (el('lineUnitPrice')) {
    el('lineUnitPrice').value = item.unitPrice;
    el('lineUnitPrice').dispatchEvent(new Event('input')); // Update asterisk
  }

  hideItemDropdown();
  updateLineTotalPreview();
}

// ============================================================
// Material Search (for No. field in modal)
// ============================================================

/**
 * Handle material search for "No." field in modal
 * Searches dbo.materials table by MaterialCode OR MaterialName
 */
export async function handleMaterialSearch(query) {
  const dropdown = el('lineMaterialDropdown');

  if (!query || query.length < 2) {
    dropdown?.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">Searching...</div>';
  dropdown?.classList.remove('hidden');

  try {
    const response = await fetch(`/api/materials?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const materials = await response.json();

    if (materials.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">No materials found</div>';
      return;
    }

    dropdown.innerHTML = materials.map(m => `
      <div class="search-dropdown-item p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
           data-material-id="${m.MaterialId}"
           data-material-code="${m.MaterialCode}"
           data-material-name="${m.MaterialName}">
        <div class="font-medium text-gray-900">${m.MaterialCode}</div>
        <div class="text-sm text-gray-600">${m.MaterialName}</div>
      </div>
    `).join('');

    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        selectMaterialFromSearch({
          materialId: item.dataset.materialId,
          materialCode: item.dataset.materialCode,
          materialName: item.dataset.materialName
        });
      });
    });
  } catch (err) {
    console.error('Material search error:', err);
    dropdown.innerHTML = '<div class="p-3 text-sm text-red-500">Error searching materials</div>';
  }
}

/**
 * Select material from search results
 * Auto-fills Description field only (Unit Price remains manual per user requirement)
 */
export function selectMaterialFromSearch(material) {
  state.formData.newLine.lineObjectNumber = material.materialCode;
  state.formData.newLine.materialId = material.materialId;

  if (el('lineObjectNumberSearch')) {
    el('lineObjectNumberSearch').value = material.materialCode;
    el('lineObjectNumberSearch').dispatchEvent(new Event('input')); // Update asterisk and background
  }

  // Mark as valid selection from dropdown (must be AFTER input event to override the input handler)
  state.ui.dropdownFields.materialNo.touched = true;
  state.ui.dropdownFields.materialNo.valid = true;

  // Auto-fill Description only (Unit Price is manual per user requirement)
  if (el('lineDescription')) {
    el('lineDescription').value = material.materialName;
    el('lineDescription').dispatchEvent(new Event('input')); // Update asterisk and background
  }

  el('lineMaterialDropdown')?.classList.add('hidden');
  updateLineTotalPreview();
}

/**
 * Handle material search for "No." field in Edit Line modal
 * Searches dbo.materials table by MaterialCode OR MaterialName
 */
export async function handleEditMaterialSearch(query) {
  const dropdown = document.getElementById('editLineMaterialDropdown');

  if (!query || query.length < 2) {
    dropdown?.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">Searching...</div>';
  dropdown?.classList.remove('hidden');

  try {
    const response = await fetch(`/api/materials?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const materials = await response.json();

    if (materials.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500">No materials found</div>';
      return;
    }

    dropdown.innerHTML = materials.map(m => `
      <div class="search-dropdown-item p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
           data-material-id="${m.MaterialId}"
           data-material-code="${m.MaterialCode}"
           data-material-name="${m.MaterialName}">
        <div class="font-medium text-gray-900">${m.MaterialCode}</div>
        <div class="text-sm text-gray-600">${m.MaterialName}</div>
      </div>
    `).join('');

    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        selectMaterialFromEditSearch({
          materialId: item.dataset.materialId,
          materialCode: item.dataset.materialCode,
          materialName: item.dataset.materialName
        });
      });
    });
  } catch (err) {
    console.error('Material search error:', err);
    dropdown.innerHTML = '<div class="p-3 text-sm text-red-500">Error searching materials</div>';
  }
}

/**
 * Select material from search results in Edit Line modal
 * Auto-fills Description field only (Unit Price remains manual per user requirement)
 */
export function selectMaterialFromEditSearch(material) {
  const noField = document.getElementById('editLineObjectNumberSearch');
  if (noField) {
    noField.value = material.materialCode;
    noField.dispatchEvent(new Event('input')); // Update asterisk and background
  }

  // Mark as valid selection from dropdown (must be AFTER input event to override the input handler)
  state.ui.dropdownFields.editMaterialNo.touched = true;
  state.ui.dropdownFields.editMaterialNo.valid = true;

  // Auto-fill Description only (Unit Price is manual per user requirement)
  const descField = document.getElementById('editLineDescription');
  if (descField) {
    descField.value = material.materialName;
    descField.dispatchEvent(new Event('input')); // Update asterisk and background
  }

  document.getElementById('editLineMaterialDropdown')?.classList.add('hidden');
  updateEditLineTotal();
}

// ============================================================
// Quote Line Management
// ============================================================

/**
 * Add quote line from modal
 */
export function handleAddQuoteLine() {
  // Force blur event on Material No field to trigger dropdown validation
  const materialNoField = el('lineObjectNumberSearch');
  if (materialNoField) {
    materialNoField.blur();
    // Small delay to allow blur event to complete validation
    // Use setTimeout with 0ms to defer execution until after the event loop
  }

  // Gather all form data with field references
  const fieldRefs = {
    lineType: el('lineType'),
    createSv: el('lineCreateSv'),
    groupNo: el('lineUsvtGroupNo'),
    serviceItemNo: el('lineUsvtServiceItemNo'),
    serviceItemDesc: el('lineUsvtServiceItemDescription'),
    no: el('lineObjectNumberSearch'),
    description: el('lineDescription'),
    quantity: el('lineQuantity'),
    unitPrice: el('lineUnitPrice'),
    discountPercent: el('lineDiscountPercent'),
    discountAmount: el('lineDiscountAmount'),
    addition: el('lineUsvtAddition'),
    refSalesQuote: el('lineUsvtRefSalesQuoteno')
  };

  const parsedQuantity = parseFloat(fieldRefs.quantity?.value);

  const lineData = {
    usvtCreateSv: fieldRefs.createSv?.checked || false,
    lineType: normalizeLineType(fieldRefs.lineType?.value),
    usvtServiceItemNo: fieldRefs.serviceItemNo?.value?.trim() || '',
    usvtServiceItemDescription: fieldRefs.serviceItemDesc?.value?.trim() || '',
    usvtGroupNo: normalizeGroupNo(fieldRefs.groupNo?.value),
    lineObjectNumber: fieldRefs.no?.value?.trim() || '',
    description: fieldRefs.description?.value?.trim() || '',
    quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
    unitPrice: parseFloat(fieldRefs.unitPrice?.value) || 0,
    usvtAddition: fieldRefs.addition?.checked || false,
    usvtRefSalesQuoteno: fieldRefs.refSalesQuote?.value?.trim() || '',
    discountPercent: sanitizeDiscountInput(fieldRefs.discountPercent?.value || '0', 1),
    discountAmount: sanitizeDiscountInput(fieldRefs.discountAmount?.value || '0', 2)
  };

  if (hasServiceItemInGroupNo(lineData.usvtGroupNo, null)) {
    lineData.usvtServiceItemNo = '';
    lineData.usvtServiceItemDescription = '';
  }

  // Check Material No dropdown validation first (must be selected from dropdown, not free text)
  const isItem = lineData.lineType === 'Item';
  if (isItem && !state.ui.dropdownFields.materialNo.valid && lineData.lineObjectNumber !== '') {
    showError('Please select a material from the dropdown list');
    fieldRefs.no?.focus();
    return;
  }

  // Use shared validation
  const validation = validateQuoteLineData(lineData);

  if (!validation.isValid) {
    const firstField = validation.firstErrorField;
    const errorMessage = Object.values(validation.errors)[0];

    showError(errorMessage);

    // Map field name to element ID
    const fieldMap = {
      'lineObjectNumber': 'lineObjectNumberSearch',
      'description': 'lineDescription',
      'usvtServiceItemDescription': 'lineUsvtServiceItemDescription',
      'quantity': 'lineQuantity',
      'unitPrice': 'lineUnitPrice'
    };

    el(fieldMap[firstField])?.focus();
    return;
  }

  // Add or insert line
  const insertIndex = state.ui.insertIndex;
  if (insertIndex !== null) {
    insertQuoteLine(lineData, insertIndex);
    showSuccess(`Line inserted at position ${insertIndex + 1}`);
  } else {
    addQuoteLine(lineData);
    showSuccess('Line added successfully');
  }

  renderQuoteLines();
  renderTotals();
  closeAddLineModal();
}

/**
 * Handle quote line removal - shows confirmation modal
 */
export function handleRemoveQuoteLine(index) {
  // Cancel any active edit before showing modal
  if (state.ui.editingLineId) {
    exitLineEditMode(false, state.ui.editingLineId);
  }

  // Store the index and show confirmation modal
  state.ui.pendingRemoveLineIndex = index;
  showConfirmRemoveModal();
}

/**
 * Show the remove confirmation modal
 */
function showConfirmRemoveModal() {
  const modal = el('confirmRemoveModal');
  const modalContent = el('confirmRemoveModalContent');

  if (modal && modalContent) {
    modal.classList.remove('hidden');
    // Trigger animation
    setTimeout(() => {
      modalContent.classList.remove('opacity-0', 'translate-y-[-10px]');
    }, 10);
  }
}

/**
 * Hide the remove confirmation modal
 */
function hideConfirmRemoveModal() {
  const modal = el('confirmRemoveModal');
  const modalContent = el('confirmRemoveModalContent');

  if (modal && modalContent) {
    modalContent.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }

  // Clear the pending index
  state.ui.pendingRemoveLineIndex = null;
}

/**
 * Confirm and execute line removal
 */
function confirmRemoveLine() {
  const index = state.ui.pendingRemoveLineIndex;

  if (index !== null) {
    removeQuoteLine(index);
    renderQuoteLines();
    renderTotals();
    showSuccess('Line removed');
  }

  hideConfirmRemoveModal();
}

/**
 * Cancel line removal
 */
function cancelRemoveLine() {
  hideConfirmRemoveModal();
}

// ============================================================
// New SER Confirmation Modal Handlers
// ============================================================

/**
 * Show confirmation modal for New SER creation
 */
async function showConfirmNewSerModal() {
  // Prevent action if button is disabled
  const newSerButton = el('lineCreateSv');
  if (newSerButton && newSerButton.disabled) {
    showError(newSerButton.title || 'Cannot create Service Item - button is disabled.');
    return;
  }

  const description = el('lineUsvtServiceItemDescription').value.trim();

  // Validate description before showing modal
  if (!description) {
    showError('Service Item Description is required before creating a Service Item.');
    el('lineUsvtServiceItemDescription').focus();
    return;
  }

  // Get modal elements
  let modal = el('confirmNewSerModal');
  let modalContent = el('confirmNewSerModalContent');

  // Fallback: if modal not in DOM, load it dynamically
  if (!modal || !modalContent) {
    console.warn('[CONFIRM-NEW-SER] Modal not found in DOM, loading dynamically...');
    try {
      const { loadModal } = await import('./components/modal-loader.js');
      await loadModal('confirmNewSerModal');
      modal = el('confirmNewSerModal');
      modalContent = el('confirmNewSerModalContent');
      console.log('[CONFIRM-NEW-SER] Modal loaded dynamically');
    } catch (err) {
      console.error('[CONFIRM-NEW-SER] Failed to load modal:', err);
      showError('Failed to load confirmation modal. Please refresh the page and try again.');
      return;
    }
  }

  // Display the description in the modal
  const descriptionEl = el('confirmNewSerDescription');
  if (descriptionEl) {
    descriptionEl.textContent = `"${description}"`;
  }

  // Show modal with animation
  if (modal && modalContent) {
    // Move modal to end of container to ensure proper stacking context
    // This ensures the confirmation modal appears on top of any other open modals
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
      modalContainer.appendChild(modal);
    }

    // Do not rely only on Tailwind-generated z-index classes here.
    // The modal HTML is loaded dynamically, and an outdated CSS build can
    // cause z-[150] to be missing, which places this dialog behind base modals.
    modal.style.zIndex = '150';
    state.ui.pendingSerCreation = true;
    state.ui.pendingSerCreationEdit = false;
    modal.classList.remove('hidden');
    setTimeout(() => {
      modalContent.style.opacity = '1';
      modalContent.style.transform = 'translateY(0)';
    }, 10);
  }
}

/**
 * Hide confirmation modal for New SER creation
 */
function hideConfirmNewSerModal() {
  const modal = el('confirmNewSerModal');
  const modalContent = el('confirmNewSerModalContent');

  if (modal && modalContent) {
    modalContent.style.opacity = '0';
    modalContent.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      modal.classList.add('hidden');
      state.ui.pendingSerCreation = false;
      state.ui.pendingSerCreationEdit = false;
    }, 300);
  }
}

/**
 * Cancel New SER creation
 */
function cancelNewSerCreation() {
  hideConfirmNewSerModal();
}

/**
 * Confirm and proceed with New SER creation
 * Handles both Add Line and Edit Line contexts
 */
function confirmNewSerCreation() {
  const shouldUseEditFlow = state.ui.pendingSerCreationEdit;
  hideConfirmNewSerModal();
  // Proceed with the actual creation after modal closes
  setTimeout(() => {
    // Check which context we're in (Add or Edit)
    if (shouldUseEditFlow) {
      createServiceItemAndLockFieldsForEdit();
    } else {
      createServiceItemAndLockFields();
    }
  }, 350); // Wait for modal animation to complete
}

/**
 * Create Service Item and lock fields in Add Line modal
 * Module-level function to be accessible from confirmNewSerCreation
 */
async function createServiceItemAndLockFields() {
  // If already created, do nothing
  if (state.ui.serCreated) {
    showError('Service Item already created');
    return;
  }

  // Get required field values
  const serviceItemDesc = document.getElementById('lineUsvtServiceItemDescription')?.value?.trim();
  const customerNo = state.quote.customerNo || '';
  const groupNo = document.getElementById('lineUsvtGroupNo')?.value?.trim() || '1';

  // Validation: Serv. Item Desc is required
  if (!serviceItemDesc) {
    showError('Please enter Service Item Description before creating New SER');
    document.getElementById('lineUsvtServiceItemDescription')?.focus();
    return;
  }

  // Show creating state
  const newSerButton = document.getElementById('lineCreateSv');
  if (newSerButton) {
    newSerButton.disabled = true;
    newSerButton.innerHTML = 'Creating...';
    newSerButton.style.opacity = '0.7';
  }

  try {
    // Call CreateServiceItem API
    const serviceItemNo = await createServiceItem(serviceItemDesc, customerNo, groupNo);

    // Set SER creation flag
    state.ui.serCreated = true;

    // Populate Serv. Item No. field with API response
    const serviceItemNoField = document.getElementById('lineUsvtServiceItemNo');
    if (serviceItemNoField) {
      serviceItemNoField.value = serviceItemNo;
    }

    // Lock fields (Service Item No, Desc)
    const serviceItemNoFieldEl = document.getElementById('lineUsvtServiceItemNo');
    const serviceItemDescFieldEl = document.getElementById('lineUsvtServiceItemDescription');
    if (serviceItemNoFieldEl && serviceItemDescFieldEl) {
      serviceItemNoFieldEl.disabled = true;
      serviceItemNoFieldEl.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
      serviceItemDescFieldEl.disabled = true;
      serviceItemDescFieldEl.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
    }

    // Lock Type dropdown
    const typeSelect = document.getElementById('lineType');
    if (typeSelect) {
      typeSelect.disabled = true;
      typeSelect.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
    }

    // Update button to "Created" state (disabled)
    if (newSerButton) {
      newSerButton.disabled = true;
      newSerButton.innerHTML = '✓ Created';
      newSerButton.style.opacity = '1';
    }

    // Show success message
    showSuccess(`Service Item ${serviceItemNo} created successfully`);

  } catch (error) {
    // API call failed - re-enable button
    console.error('Failed to create Service Item:', error);
    showError(error.message || 'Failed to create Service Item. Please try again.');
    if (newSerButton) {
      newSerButton.disabled = false;
      newSerButton.innerHTML = 'New SER';
      newSerButton.style.opacity = '1';
    }
  }
}

// ============================================================
// Quote Actions
// ============================================================

/**
 * Clear quote form - shows confirmation modal
 */
export function handleClearQuote() {
  // Close edit modal if open
  const editModal = document.getElementById('editLineModal');
  if (editModal && !editModal.classList.contains('hidden')) {
    closeEditLineModal();
  }

  // Close confirmation modal if open
  const confirmModal = el('confirmNewSerModal');
  if (confirmModal && !confirmModal.classList.contains('hidden')) {
    const confirmContent = el('confirmNewSerModalContent');
    confirmContent.classList.remove('opacity-100', 'translate-y-0');
    confirmContent.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => {
      confirmModal.classList.add('hidden');
      state.ui.pendingSerCreation = false;
      state.ui.pendingSerCreationEdit = false;
    }, 300);
  }

  // Show confirmation modal instead of native confirm
  showConfirmClearQuoteModal();
}

/**
 * Confirm clear quote action
 */
export function confirmClearQuote() {
  hideConfirmClearQuoteModal();
  resetQuoteEditorToCreateMode({ showFeedback: false });
  showSuccess('Quote cleared');
}

/**
 * Cancel clear quote action
 */
export function cancelClearQuote() {
  hideConfirmClearQuoteModal();
}

/**
 * Save draft quote
 */
export function handleSaveDraft() {
  const formData = getQuoteFormData();

  // Validate
  const validation = validateAndUpdate(formData);
  if (!validation.isValid) {
    displayValidationErrors(validation.errors);
    showError('Please fix validation errors before saving');
    return;
  }

  // Save to session storage
  try {
    sessionStorage.setItem('salesquotes-draft', JSON.stringify(formData));
    showSuccess('Draft saved successfully');
  } catch (error) {
    console.error('Failed to save draft:', error);
    showError('Failed to save draft');
  }
}

// Helpers for normalizing Gateway/Business Central error payloads.
function isExplicitApiFailure(value) {
  return value === false || value === 'false';
}

function parseStructuredApiErrorPayload(value) {
  if (!value || typeof value !== 'string') {
    return value && typeof value === 'object' ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const tryParse = candidate => {
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  };

  const wholePayload = tryParse(trimmed);
  if (wholePayload) {
    return wholePayload;
  }

  const firstObjectIndex = trimmed.indexOf('{');
  const lastObjectIndex = trimmed.lastIndexOf('}');
  if (firstObjectIndex !== -1 && lastObjectIndex > firstObjectIndex) {
    const objectPayload = tryParse(trimmed.slice(firstObjectIndex, lastObjectIndex + 1));
    if (objectPayload) {
      return objectPayload;
    }
  }

  const firstArrayIndex = trimmed.indexOf('[');
  const lastArrayIndex = trimmed.lastIndexOf(']');
  if (firstArrayIndex !== -1 && lastArrayIndex > firstArrayIndex) {
    return tryParse(trimmed.slice(firstArrayIndex, lastArrayIndex + 1));
  }

  return null;
}

function findApiErrorMessage(value, seen = new Set()) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value !== 'object') {
    return '';
  }

  if (seen.has(value)) {
    return '';
  }

  seen.add(value);

  const priorityKeys = [
    'message',
    'Message',
    'error',
    'Error',
    'errorMessage',
    'error_message',
    'detail',
    'details',
    'title',
    'description',
    'exceptionMessage'
  ];

  for (const key of priorityKeys) {
    if (key in value) {
      const message = findApiErrorMessage(value[key], seen);
      if (message) {
        return message;
      }
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = findApiErrorMessage(item, seen);
      if (message) {
        return message;
      }
    }
    return '';
  }

  for (const nestedValue of Object.values(value)) {
    const message = findApiErrorMessage(nestedValue, seen);
    if (message) {
      return message;
    }
  }

  return '';
}

function extractQuoteApiFailureMessage(responseData) {
  const fallbackMessage = 'Failed to send quote to Business Central. Please review the data and try again.';
  const candidates = [
    responseData?.message,
    responseData?.error,
    responseData?.result?.message,
    responseData?.result?.error
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const structuredPayload = parseStructuredApiErrorPayload(candidate);
    const structuredMessage = findApiErrorMessage(structuredPayload);
    if (structuredMessage) {
      return structuredMessage;
    }

    const directMessage = findApiErrorMessage(candidate);
    if (directMessage) {
      return directMessage;
    }
  }

  return findApiErrorMessage(responseData) || fallbackMessage;
}

function normalizeGatewayHttpErrorMessage(error, fallbackMessage) {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const apiErrorMatch = rawMessage.match(/^API Error\s+\d+:\s*([\s\S]*)$/i);
  const payloadMessage = apiErrorMatch?.[1] || rawMessage;
  const structuredPayload = parseStructuredApiErrorPayload(payloadMessage);
  return findApiErrorMessage(structuredPayload)
    || payloadMessage.trim()
    || fallbackMessage;
}

async function fetchSalesQuoteByNumber(salesQuoteNumber) {
  const API_URL = `${GATEWAY_API.GET_SALES_QUOTES_FROM_NUMBER}?salesQuoteNumber=${encodeURIComponent(salesQuoteNumber)}`;

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    const gatewayReportedFailure = [
      responseData?.success,
      responseData?.Success,
      responseData?.result?.success,
      responseData?.result?.Success
    ].some(isExplicitApiFailure);

    if (gatewayReportedFailure || !(responseData?.data || responseData?.result?.data || responseData?.result)) {
      throw new Error(extractQuoteApiFailureMessage(responseData));
    }

    return responseData;
  } catch (error) {
    console.error('GetSalesQuotesFromNumber API call failed:', error);
    throw error;
  }
}

export async function handleSearchSalesQuote() {
  if (state.ui.searchingQuote) {
    return;
  }

  const searchInput = el('searchSalesQuoteNumber');
  const salesQuoteNumber = normalizeSalesQuoteNumberInput(searchInput?.value);

  if (!salesQuoteNumber) {
    setSearchSalesQuoteFeedback('error', 'Sales Quote number required', 'Please enter a Sales Quote number before searching.');
    showError('Please enter a Sales Quote number');
    return;
  }

  if (searchInput) {
    searchInput.value = salesQuoteNumber;
  }

  setSearchSalesQuoteLoading(true);
  setSearchSalesQuoteFeedback('loading', `Searching ${salesQuoteNumber}`, 'Checking Business Central for the latest quote data...');
  clearValidationErrors();

  try {
    const responseData = await fetchSalesQuoteByNumber(salesQuoteNumber);
    await applySearchedSalesQuote(responseData);
    showSuccess(`Loaded ${salesQuoteNumber} from Business Central`);
  } catch (error) {
    const errorMessage = normalizeGatewayHttpErrorMessage(
      error,
      'Unable to load Sales Quote from Business Central.'
    );
    setSearchSalesQuoteFeedback('error', `Unable to load ${salesQuoteNumber}`, errorMessage);
    showError(errorMessage);
  } finally {
    setSearchSalesQuoteLoading(false);
  }
}

/**
 * Send quote to the backend gateway proxy
 * @param {Object} quoteData - Sanitized quote form data
 * @returns {Promise<Object>} API response
 */
async function sendQuoteToAzureFunction(quoteData) {
  const API_URL = GATEWAY_API.CREATE_SALES_QUOTE_WITHOUT_NUMBER;

  // Get invoice discount from DOM
  const invoiceDiscountElement = document.getElementById('invoiceDiscount');
  const discountAmount = parseFloat(invoiceDiscountElement?.value) || 0;

  // Transform line items to API format
  const lineItems = state.quote.lines.map(line => {
    const parsedQuantity = parseFloat(line.quantity);

    return {
      lineObjectNumber: line.lineObjectNumber || '',
      description: line.description || '',
      quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
      unitPrice: line.unitPrice || 0,
      lineType: normalizeLineType(line.lineType),
      discountPercent: line.discountPercent || 0,
      usvtGroupNo: normalizeGroupNo(line.usvtGroupNo),
      usvtServiceItemNo: line.usvtServiceItemNo || '',
      usvtServiceItemDescription: line.usvtServiceItemDescription || '',
      usvtCreateSv: line.usvtCreateSv || line.createSv || false,  // Support both new and legacy field names
      usvtAddition: line.usvtAddition || false,
      usvtRefSalesQuoteno: line.usvtRefSalesQuoteno || '',
      discountAmount: line.discountAmount || 0
    };
  });

  // Prepare request body
  const requestBody = {
    customerNo: state.quote.customerNo || '',
    workDescription: quoteData.workDescription || '',
    responsibilityCenter: quoteData.responsibilityCenter || '',
    assignedUserId: quoteData.assignedUserId || '',
    salespersonCode: quoteData.salespersonCode || '',
    serviceOrderType: quoteData.serviceOrderType || '',
    contactName: quoteData.contact || '',
    division: quoteData.division || 'MS1029',
    branchCode: state.quote.branch || '',
    discountAmount: discountAmount,
    requestedDeliveryDate: quoteData.requestedDeliveryDate || '',
    lineItems: lineItems
  };

  console.log('Sending quote to Azure Function:', requestBody);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Azure Function API response:', responseData);

    const gatewayReportedFailure = [
      responseData?.success,
      responseData?.Success,
      responseData?.result?.success,
      responseData?.result?.Success
    ].some(isExplicitApiFailure);

    if (gatewayReportedFailure) {
      throw new Error(extractQuoteApiFailureMessage(responseData));
    }

    return responseData;

  } catch (error) {
    console.error('Azure Function API call failed:', error);
    throw error;
  }
}

async function updateQuoteInAzureFunction(quoteData) {
  const API_URL = GATEWAY_API.UPDATE_SALES_QUOTE;
  const invoiceDiscountElement = document.getElementById('invoiceDiscount');
  const discountAmount = parseFloat(invoiceDiscountElement?.value) || 0;
  const salesQuoteId = state.quote.id || quoteData.quoteId || '';
  const salesQuoteNumber = state.quote.number || quoteData.quoteNumber || '';
  const quoteEtag = state.quote.etag || quoteData.quoteEtag || '';

  if (!salesQuoteId && !salesQuoteNumber) {
    throw new Error('Sales Quote identifier is missing. Please search for the quote again before updating.');
  }

  const lineItems = state.quote.lines.map(line => {
    const parsedQuantity = parseFloat(line.quantity);

    return {
      id: line.bcId || null,
      lineId: line.bcId || null,
      etag: line.bcEtag || null,
      sequence: line.sequence || 0,
      lineObjectNumber: line.lineObjectNumber || '',
      description: line.description || '',
      quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
      unitPrice: line.unitPrice || 0,
      lineType: normalizeLineType(line.lineType),
      discountPercent: line.discountPercent || 0,
      usvtGroupNo: normalizeGroupNo(line.usvtGroupNo),
      usvtServiceItemNo: line.usvtServiceItemNo || '',
      usvtServiceItemDescription: line.usvtServiceItemDescription || '',
      usvtCreateSv: line.usvtCreateSv || line.createSv || false,
      usvtAddition: line.usvtAddition || false,
      usvtRefSalesQuoteno: line.usvtRefSalesQuoteno || '',
      discountAmount: line.discountAmount || 0
    };
  });

  const requestBody = {
    id: salesQuoteId,
    salesQuoteId: salesQuoteId,
    number: salesQuoteNumber,
    salesQuoteNumber: salesQuoteNumber,
    etag: quoteEtag,
    odataEtag: quoteEtag,
    status: state.quote.status || quoteData.quoteStatus || '',
    customerNo: state.quote.customerNo || '',
    contactName: quoteData.contact || '',
    salespersonCode: quoteData.salespersonCode || '',
    assignedUserId: quoteData.assignedUserId || '',
    serviceOrderType: quoteData.serviceOrderType || '',
    division: quoteData.division || 'MS1029',
    shortcutDimension2Code: quoteData.division || 'MS1029',
    branchCode: quoteData.branch || state.quote.branch || '',
    shortcutDimension1Code: quoteData.branch || state.quote.branch || '',
    locationCode: quoteData.locationCode || '',
    responsibilityCenter: quoteData.responsibilityCenter || '',
    orderDate: quoteData.orderDate || '',
    requestedDeliveryDate: quoteData.requestedDeliveryDate || '',
    workDescription: quoteData.workDescription || '',
    discountAmount,
    lineItems,
    salesQuoteLines: lineItems
  };

  console.log('Updating quote in Azure Function:', requestBody);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    const gatewayReportedFailure = [
      responseData?.success,
      responseData?.Success,
      responseData?.result?.success,
      responseData?.result?.Success
    ].some(isExplicitApiFailure);

    if (gatewayReportedFailure) {
      throw new Error(extractQuoteApiFailureMessage(responseData));
    }

    return responseData;
  } catch (error) {
    console.error('UpdateSalesQuote API call failed:', error);
    throw error;
  }
}

/**
 * Create Service Item via the backend gateway proxy
 * @param {string} description - Service Item Description
 * @param {string} customerNo - Customer Number
 * @param {string} groupNo - Group Number
 * @returns {Promise<string>} Service Item Number from API response
 * @throws {Error} If API call fails or validation fails
 */
async function createServiceItem(description, customerNo, groupNo) {
  const API_URL = GATEWAY_API.CREATE_SERVICE_ITEM;

  // Validate required fields
  if (!description || description.trim() === '') {
    throw new Error('Service Item Description is required to create a Service Item');
  }

  // Prepare request body - MUST be an array
  const requestBody = [{
    description: description.trim(),
    item_No: 'SERV-ITEM', // Hardcoded as per requirement
    Customer_Number: customerNo || '',
    Group_No: groupNo || ''
  }];

  console.log('Creating Service Item with payload:', JSON.stringify(requestBody, null, 2));

  try {
    // Show loading state on the button
    const newSerButton = el('lineCreateSv');
    if (newSerButton) {
      newSerButton.disabled = true;
      newSerButton.innerHTML = '<span class="animate-pulse">Creating...</span>';
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('CreateServiceItem API response:', responseData);
    console.log('Response structure analysis:', {
      hasResult: !!responseData?.result,
      hasResults: !!responseData?.result?.Results,
      resultsLength: responseData?.result?.Results?.length,
      firstResult: responseData?.result?.Results?.[0],
      serviceItemNo: responseData?.result?.Results?.[0]?.ServiceItemNo
    });

    // Extract ServiceItemNo from response
    // Response structure: { result: { Results: [ { ServiceItemNo, GroupNo, Success, Error } ] } }
    const serviceItemNo = responseData?.result?.Results?.[0]?.ServiceItemNo;

    if (!serviceItemNo) {
      throw new Error('Service Item Number not found in API response');
    }

    // Check if the API call was successful
    if (!responseData?.result?.Results?.[0]?.Success) {
      const error = responseData?.result?.Results?.[0]?.Error || 'Unknown error';
      throw new Error(`Failed to create Service Item: ${error}`);
    }

    return serviceItemNo;

  } catch (error) {
    console.error('CreateServiceItem API call failed:', error);
    throw error;
  } finally {
    // Re-enable button after API call completes
    const newSerButton = el('lineCreateSv');
    if (newSerButton) {
      newSerButton.disabled = false;
      // Button state will be updated by createServiceItemAndLockFields() function
    }
  }
}

/**
 * Create Service Order from Sales Quote via the backend gateway proxy
 * @param {string} salesQuoteId - The Sales Quote number from BC
 * @param {string} branchCode - The branch code
 * @returns {Promise<Object>} Response with service order number
 * @throws {Error} If API call fails
 */
async function createServiceOrderFromSQ(salesQuoteId, branchCode) {
  const API_URL = GATEWAY_API.CREATE_SERVICE_ORDER_FROM_SQ;

  // Extract unique Group No values - only include groups that have at least one Service Item No
  const groupNosWithServiceItem = new Set();

  for (const line of state.quote.lines) {
    const groupNo = normalizeGroupNo(line.usvtGroupNo);
    const serviceItemNo = line.usvtServiceItemNo;

    // Include this group if it has a Service Item No
    if (groupNo && groupNo.trim() !== '' && serviceItemNo && serviceItemNo.trim() !== '') {
      groupNosWithServiceItem.add(groupNo);
    }
  }

  const uniqueGroupNos = Array.from(groupNosWithServiceItem);

  console.log('Unique Group Nos with Service Item:', uniqueGroupNos);

  if (uniqueGroupNos.length === 0) {
    console.warn('No Group Nos with Service Item found in quote lines, skipping Service Order creation');
    return null;
  }

  // Build payload array - one entry per unique Group No
  const requestBody = uniqueGroupNos.map(groupNo => ({
    salesQuoteId: salesQuoteId,
    branchCode: branchCode,
    GroupNo: parseInt(groupNo, 10)
  }));

  console.log('Creating Service Order from SQ with payload:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('CreateServiceOrderFromSQ API response:', responseData);

    return responseData;

  } catch (error) {
    console.error('CreateServiceOrderFromSQ API call failed:', error);
    throw error;
  }
}

/**
 * Extract Service Order Numbers from varying API response shapes.
 * The upstream function may return a single value, arrays, nested result sets,
 * or comma/newline-separated strings depending on how many groups were processed.
 * @param {unknown} payload - Raw API response payload
 * @returns {string[]} Normalized Service Order Numbers
 */
function extractServiceOrderNos(payload) {
  const serviceOrderNos = [];
  const seen = new Set();
  const serviceOrderKeyPattern = /^serviceorder(?:no|nos|number|numbers)$/i;

  function addValue(value) {
    if (typeof value !== 'string') {
      return;
    }

    value
      .split(/[\r\n,;]+/)
      .map(part => part.trim())
      .filter(part => part !== '')
      .forEach(part => {
        if (!seen.has(part)) {
          seen.add(part);
          serviceOrderNos.push(part);
        }
      });
  }

  function visit(node, inServiceOrderContext = false) {
    if (!node) {
      return;
    }

    if (typeof node === 'string') {
      if (inServiceOrderContext) {
        addValue(node);
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(item => {
        if (inServiceOrderContext && typeof item === 'string') {
          addValue(item);
          return;
        }
        visit(item, inServiceOrderContext);
      });
      return;
    }

    if (typeof node !== 'object') {
      return;
    }

    Object.entries(node).forEach(([key, value]) => {
      const nextInServiceOrderContext = inServiceOrderContext || serviceOrderKeyPattern.test(key);
      visit(value, nextInServiceOrderContext);
    });
  }

  if (typeof payload === 'string') {
    addValue(payload);
    return serviceOrderNos;
  }

  if (Array.isArray(payload) && payload.every(item => typeof item === 'string')) {
    payload.forEach(addValue);
    return serviceOrderNos;
  }

  visit(payload);
  return serviceOrderNos;
}

/**
 * Send quote to Business Central
 */
export async function handleSendQuote() {
  if (state.quote.mode === 'edit' && state.quote.number) {
    showToast('Update Sales Quote is not enabled yet', 'error');
    return;
  }

  // Get form data
  const formData = getQuoteFormData();

  // Validate
  clearValidationErrors();
  const validation = validateAndUpdate(formData);
  if (!validation.isValid) {
    displayValidationErrors(validation.errors);
    showError('Please fix validation errors before sending');
    return;
  }

  // Sanitize data
  const sanitizedData = sanitizeQuoteData(formData);

  try {
    showSaving();

    // Call Azure Function API
    const response = await sendQuoteToAzureFunction(sanitizedData);

    // Extract Quote Number from response
    const quoteNumber = response?.result?.number || null;

    // Extract branch code for Service Order creation
    const branchCode = state.quote.branch || '';

    // Create Service Order from Sales Quote (if we have a quote number and branch)
    let serviceOrderResponse = null;
    let serviceOrderNos = []; // Array to hold multiple Service Order numbers

    if (quoteNumber && branchCode) {
      try {
        // Update loading message
        const messageEl = el('loadingMessage');
        const titleEl = el('loadingTitle');
        if (messageEl) messageEl.textContent = 'Creating Service Order...';
        if (titleEl) titleEl.textContent = 'Creating Service Order';

        serviceOrderResponse = await createServiceOrderFromSQ(quoteNumber, branchCode);
        serviceOrderNos = extractServiceOrderNos(serviceOrderResponse);

        console.log('Service Orders created:', serviceOrderNos);
      } catch (soError) {
        console.error('Failed to create Service Order:', soError);
        // Continue anyway - quote was created successfully
        // We'll show the modal but note that Service Order creation failed
      }
    }

    let recordSaveError = null;
    if (quoteNumber) {
      try {
        await recordQuoteSubmission({
          salesQuoteNumber: quoteNumber,
          workDescription: sanitizedData.workDescription || ''
        });
      } catch (recordError) {
        recordSaveError = recordError;
        console.error('Failed to save Sales Quote submission record:', recordError);
      }
    }

    hideSaving();

    resetQuoteEditorToCreateMode({ showFeedback: false });

    // Show success modal with Quote Number and Service Order Nos
    if (quoteNumber) {
      await showQuoteCreatedSuccess(quoteNumber, serviceOrderNos);
    } else {
      // Fallback to generic success if no Quote Number returned
      console.warn('No Quote Number in response:', response);
      showSuccess('Quote sent to Business Central successfully!');
    }

    if (recordSaveError) {
      showToast('Quote was sent successfully, but the record could not be saved to My Records.', 'error');
    }

  } catch (error) {
    hideSaving();
    console.error('Failed to send quote:', error);
    await showQuoteSendFailure(error);
  }
}

// ============================================================
// Branch Fields Initialization
// ============================================================

/**
 * Initialize branch fields based on logged-in user's branch
 * Auto-populates BRANCH and Location Code fields
 * Shows No Branch modal if user has no branch assigned
 */
export async function initializeBranchFields() {
  let userEmail = '';

  try {
    // Get user info from auth
    const userInfo = await getUserInfo();
    userEmail = userInfo?.clientPrincipal?.userDetails?.trim?.()
      || userInfo?.clientPrincipal?.email?.trim?.()
      || userInfo?.email?.trim?.()
      || '';

    console.log('[BRANCH-INIT] userInfo:', userInfo);

    if (!userInfo || !userInfo.clientPrincipal) {
      console.warn('[BRANCH-INIT] No user info available for branch initialization');
      const { showNoBranchModal } = await import('./ui.js');
      await showNoBranchModal(userEmail);
      return;
    }

    const clientPrincipal = userInfo.clientPrincipal;
    console.log('[BRANCH-INIT] clientPrincipal:', clientPrincipal);

    const branchId = clientPrincipal.branchId;
    console.log('[BRANCH-INIT] branchId:', branchId, '(type:', typeof branchId, ')');

    if (!branchId && branchId !== 0) {  // Check for null/undefined, but allow 0
      console.error('[BRANCH-INIT] No branchId found in user info - showing No Branch modal');
      console.log('[BRANCH-INIT] Full clientPrincipal data for debugging:', JSON.stringify(clientPrincipal));
      const { showNoBranchModal } = await import('./ui.js');
      await showNoBranchModal(userEmail);
      return;
    }

    // Import utility functions
    const { getBranchCode, generateLocationCode } = await import('./ui.js');

    // Generate branch code and location code
    const branchCode = getBranchCode(branchId);

    console.log('[BRANCH-INIT] branchCode:', branchCode, 'for branchId:', branchId);

    if (!branchCode) {
      console.error(`[BRANCH-INIT] Invalid branchId: ${branchId} - no matching branch code found`);
      const { showNoBranchModal } = await import('./ui.js');
      await showNoBranchModal(userEmail);
      return;
    }

    const locationCode = generateLocationCode(branchCode);
    console.log('[BRANCH-INIT] locationCode:', locationCode);

    // Set field values
    if (el('branch')) {
      el('branch').value = branchCode;
    }

    if (el('locationCode')) {
      el('locationCode').value = locationCode;
    }

    // Set Responsibility Center (equals BRANCH)
    if (el('responsibilityCenter')) {
      el('responsibilityCenter').value = branchCode;
    }

    // Store in state
    state.ui.branchDefaults.branch = branchCode;
    state.ui.branchDefaults.locationCode = locationCode;
    state.ui.branchDefaults.responsibilityCenter = branchCode;
    state.quote.branch = branchCode;
    state.quote.locationCode = locationCode;
    state.quote.responsibilityCenter = branchCode;

    // Update asterisk for BRANCH field (hide since it's now populated)
    const branchAsterisk = el('branch-asterisk');
    if (branchAsterisk && branchCode) {
      branchAsterisk.classList.add('hidden');
    }

    updateQuoteEditorModeUi();
    console.log(`[BRANCH-INIT] SUCCESS: Branch fields initialized: ${branchCode} -> ${locationCode}`);
  } catch (error) {
    console.error('[BRANCH-INIT] Failed to initialize branch fields:', error);
    const { showNoBranchModal } = await import('./ui.js');
    await showNoBranchModal(userEmail);
  }
}

// ============================================================
// Service Item No per Group No Validation
// ============================================================

/**
 * Check if any line in the same Group No already has a Service Item No
 * @param {string|number} groupNo - The Group No to check
 * @param {string|null} excludeLineId - Line ID to exclude (for edit mode)
 * @returns {boolean} true if Service Item No exists in the group
 */
function hasServiceItemInGroupNo(groupNo, excludeLineId = null) {
  if (!groupNo || groupNo.toString().trim() === '') {
    return false;
  }

  const groupNoStr = groupNo.toString().trim();

  // Check all existing lines
  return state.quote.lines.some(line => {
    // Skip the line being edited
    if (excludeLineId && line.id === excludeLineId) {
      return false;
    }
    // Check if same Group No and has Service Item No
    return line.usvtGroupNo?.toString() === groupNoStr &&
           line.usvtServiceItemNo &&
           line.usvtServiceItemNo.trim() !== '';
  });
}

/**
 * Update Service Item fields in Add Line modal.
 * Lock fields when Type is Comment, a SER was created, or another line in the same Group No already has a Service Item No.
 */
function updateAddServiceItemFieldState() {
  const serviceItemNoField = el('lineUsvtServiceItemNo');
  const serviceItemDescField = el('lineUsvtServiceItemDescription');
  const typeSelect = el('lineType');
  const groupNoField = el('lineUsvtGroupNo');

  if (!serviceItemNoField || !serviceItemDescField || !typeSelect || !groupNoField) {
    return;
  }

  const groupNo = normalizeGroupNo(groupNoField.value);
  const isComment = typeSelect.value === 'Comment';
  const isSerCreated = state.ui.serCreated;
  const hasExistingSerInGroup = hasServiceItemInGroupNo(groupNo, null);
  const lockReason = hasExistingSerInGroup ? getGroupServiceItemLockMessage(groupNo) : '';
  const shouldLock = isSerCreated || isComment || hasExistingSerInGroup;
  const shouldClear = !isSerCreated && (isComment || hasExistingSerInGroup);

  setServiceItemFieldLockState(serviceItemNoField, shouldLock, {
    clearValue: shouldClear,
    title: lockReason
  });
  setServiceItemFieldLockState(serviceItemDescField, shouldLock, {
    clearValue: shouldClear,
    title: lockReason
  });
}

/**
 * Update New SER button state in Add Line modal based on Group No
 * Checks if any existing line in the same Group No has a Service Item No
 */
export function updateNewSerButtonStateForAddModal() {
  const groupNoField = el('lineUsvtGroupNo');
  const newSerButton = el('lineCreateSv');
  const typeSelect = el('lineType');

  if (!groupNoField || !newSerButton || !typeSelect) {
    return;
  }

  const groupNo = groupNoField.value;
  const isComment = typeSelect.value === 'Comment';
  const hasExistingSerInGroup = hasServiceItemInGroupNo(groupNo, null);

  if (isComment) {
    newSerButton.disabled = true;
    newSerButton.removeAttribute('title');
    newSerButton.style.cursor = '';
  } else if (state.ui.serCreated) {
    newSerButton.disabled = true;
    newSerButton.removeAttribute('title');
    newSerButton.style.cursor = '';
  } else if (hasExistingSerInGroup) {
    newSerButton.disabled = true;
    newSerButton.title = getGroupServiceItemLockMessage(groupNo);
    newSerButton.style.cursor = 'not-allowed';
  } else {
    newSerButton.disabled = false;
    newSerButton.removeAttribute('title');
    newSerButton.style.cursor = '';
  }

  updateAddServiceItemFieldState();
}

/**
 * Update New SER button state in Edit Line modal based on Group No
 * Checks if any existing line in the same Group No has a Service Item No
 * @param {string|null} excludeLineId - The line ID being edited
 */
function updateNewSerButtonStateForEditModal(excludeLineId) {
  const groupNoField = document.getElementById('editLineUsvtGroupNo');
  const newSerButton = document.getElementById('editLineCreateSv');
  const typeSelect = document.getElementById('editLineType');

  if (!groupNoField || !newSerButton || !typeSelect) {
    return;
  }

  const groupNo = groupNoField.value;
  const isComment = typeSelect.value === 'Comment';
  const line = state.quote.lines.find(l => l.id === excludeLineId);
  const hasExistingServiceItemOnLine = !!(line?.usvtServiceItemNo && line.usvtServiceItemNo.trim() !== '');
  const hasExistingSerInGroup = hasServiceItemInGroupNo(groupNo, excludeLineId);

  if (isComment) {
    newSerButton.disabled = true;
    newSerButton.removeAttribute('title');
    newSerButton.style.cursor = '';
  } else if (state.ui.serCreatedEdit) {
    newSerButton.disabled = true;
    newSerButton.removeAttribute('title');
    newSerButton.style.cursor = '';
  } else if (hasExistingServiceItemOnLine) {
    newSerButton.disabled = true;
    newSerButton.removeAttribute('title');
    newSerButton.style.cursor = '';
  } else if (hasExistingSerInGroup) {
    newSerButton.disabled = true;
    newSerButton.title = getGroupServiceItemLockMessage(groupNo);
    newSerButton.style.cursor = 'not-allowed';
  } else {
    newSerButton.disabled = false;
    newSerButton.removeAttribute('title');
    newSerButton.style.cursor = '';
  }

  updateEditServiceItemFieldState(excludeLineId);
}

// ============================================================
// Line Modal Handlers
// ============================================================

/**
 * Setup modal handlers for Type -> New SER locking logic
 * When Type is "Comment", New SER button is disabled and OFF
 * When Type is "Item", New SER button is enabled
 * When Addition is OFF, Ref Sales Quote No is disabled and cleared
 */
export function setupLineModalHandlers() {
  const typeSelect = el('lineType');
  const newSerButton = el('lineCreateSv');
  const additionCheckbox = el('lineUsvtAddition');
  const refSalesQuoteField = el('lineUsvtRefSalesQuoteno');

  if (!typeSelect || !newSerButton || !additionCheckbox || !refSalesQuoteField) {
    console.warn('Line modal elements not found for handler setup');
    return;
  }

  // Initial state based on default value
  updateFieldStates();

  // Handle Type changes
  typeSelect.addEventListener('change', updateFieldStates);

  // Handle Addition changes
  additionCheckbox.addEventListener('change', updateAdditionFieldState);

  // Handle New SER button clicks - show confirmation first
  newSerButton.addEventListener('click', showConfirmNewSerModal);

  // Handle Group No changes - update New SER button state
  const groupNoField = el('lineUsvtGroupNo');
  if (groupNoField) {
    groupNoField.addEventListener('input', updateNewSerButtonStateForAddModal);
    groupNoField.addEventListener('change', updateNewSerButtonStateForAddModal);
  }

  // Initial Addition state
  updateAdditionFieldState();

  // Initial Service Item field state
  updateServiceItemFieldState();

  function updateFieldStates() {
    const typeValue = typeSelect.value;
    const isComment = typeValue === 'Comment';

    // Lock Type dropdown if SER was created
    if (state.ui.serCreated) {
      typeSelect.disabled = true;
      typeSelect.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
    } else {
      typeSelect.disabled = false;
      typeSelect.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
    }

    // Update New SER button state
    if (isComment) {
      newSerButton.innerHTML = 'New SER';
    } else {
      newSerButton.innerHTML = 'New SER';
    }

    // Update New SER button state based on Group No after the button label is reset
    updateNewSerButtonStateForAddModal();

    // Fields to disable when Type is "Comment"
    const itemFields = [
      'lineUsvtServiceItemNo',        // Service Item No
      'lineUsvtServiceItemDescription', // Service Item Description
      'lineObjectNumberSearch',        // No (materials search)
      'lineQuantity',                  // Qty
      'lineUnitPrice',                 // Unit Price
      'lineDiscountPercent',           // Discount%
      'lineDiscountAmount',            // Discount Amt
      'lineUsvtAddition',              // Addition
      'lineUsvtRefSalesQuoteno'        // Ref Sales Quote No
    ];

    // Toggle disabled state for item-related fields
    itemFields.forEach(fieldId => {
      const field = el(fieldId);
      if (field) {
        if (isComment) {
          // Disable field for Comment type
          field.disabled = true;
          field.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
          // Clear values when switching to Comment
          if (field.type === 'checkbox') {
            field.checked = false;
          } else if (fieldId === 'lineQuantity') {
            field.value = '0';
          } else if (fieldId === 'lineUnitPrice' || fieldId === 'lineDiscountPercent' || fieldId === 'lineDiscountAmount') {
            field.value = '0';
          } else {
            field.value = '';
          }
        } else {
          // Enable field for Item type
          field.disabled = false;
          field.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
        }
      }
    });

    // Update line total preview when type changes
    if (el('lineTotalPreview')) {
      el('lineTotalPreview').textContent = '0.00';
    }

    // Sync Service Item fields with New SER button state
    updateServiceItemFieldState();
  }

  /**
   * Update Ref Sales Quote No field based on Addition checkbox state
   * When Addition is OFF (unchecked), disable and clear Ref Sales Quote No
   * When Addition is ON (checked), enable Ref Sales Quote No
   */
  function updateAdditionFieldState() {
    const isAdditionEnabled = additionCheckbox.checked;

    if (!isAdditionEnabled) {
      // Disable Ref Sales Quote No when Addition is OFF
      refSalesQuoteField.disabled = true;
      refSalesQuoteField.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
      refSalesQuoteField.value = ''; // Clear value
    } else {
      // Enable Ref Sales Quote No when Addition is ON
      refSalesQuoteField.disabled = false;
      refSalesQuoteField.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
    }
  }

  /**
   * Update Service Item fields - lock fields if SER was created OR Type is Comment
   * When SER is created successfully, lock both Service Item fields
   * When Type is Comment, disable and clear both Service Item fields
   */
  function updateServiceItemFieldState() {
    updateAddServiceItemFieldState();
  }
}

// ============================================================
// Event Handlers Setup
// ============================================================

/**
 * Debounce utility - delays function execution
 * NOTE: Currently not used for search dropdowns to prevent flickering
 * Can be re-enabled if server performance becomes an issue
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Setup event listeners
 */
export function setupEventListeners() {
  const searchSalesQuoteInput = el('searchSalesQuoteNumber');
  searchSalesQuoteInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchSalesQuote();
    }
  });
  searchSalesQuoteInput?.addEventListener('input', () => {
    if (!state.ui.searchingQuote) {
      setSearchSalesQuoteFeedback('', '', '');
    }
  });

  // Customer search (BC API - Legacy) - Direct input (no debounce)
  const customerSearch = el('customerSearch');
  customerSearch?.addEventListener('input', (e) => {
    handleCustomerSearch(e.target.value);
  });

  customerSearch?.addEventListener('blur', () => {
    // Delay hiding dropdown to allow click events
    setTimeout(() => hideCustomerDropdown(), 200);
  });

  // Customer No. search (Local Database - New) - Direct input (no debounce)
  const customerNoSearch = el('customerNoSearch');
  customerNoSearch?.addEventListener('input', (e) => {
    if (customerNoSearch.readOnly || customerNoSearch.disabled) {
      return;
    }

    // Mark field as touched and reset valid flag when user types
    state.ui.dropdownFields.customerNo.touched = true;
    state.ui.dropdownFields.customerNo.valid = false;
    handleCustomerNoSearch(e.target.value);
  });

  customerNoSearch?.addEventListener('blur', () => {
    if (customerNoSearch.readOnly || customerNoSearch.disabled) {
      return;
    }

    // Delay hiding dropdown to allow click events
    setTimeout(() => {
      const dropdown = el('customerNoDropdown');
      if (dropdown) dropdown.classList.add('hidden');

      // Only validate if field was touched (user interacted with it)
      // This prevents clearing valid values when loading from saved state
      if (state.ui.dropdownFields.customerNo.touched &&
          !state.ui.dropdownFields.customerNo.valid &&
          customerNoSearch.value.trim() !== '') {
        customerNoSearch.value = '';
        // Clear related fields
        if (el('customerName')) el('customerName').value = '';
        setFieldValue('sellToAddress', '');
        setFieldValue('sellToAddress2', '');
        setFieldValue('sellToCity', '');
        setFieldValue('sellToPostCode', '');
        setFieldValue('sellToVatRegNo', '');
        setFieldValue('sellToTaxBranchNo', '');
        if (el('sellToSection')) el('sellToSection').classList.add('hidden');
        // Clear state
        state.quote.customerId = null;
        state.quote.customerNo = null;
        state.quote.customerName = null;
        state.quote.sellTo = {
          address: null,
          address2: null,
          city: null,
          postCode: null,
          vatRegNo: null,
          taxBranchNo: null
        };
        state.formData.selectedCustomer = null;
        saveState();
        // Show error message
        showError('Please select a customer from the dropdown');
      }
    }, 200);
  });

  // Salesperson Code search - Direct input (no debounce)
  const salespersonCodeSearch = el('salespersonCodeSearch');
  salespersonCodeSearch?.addEventListener('input', (e) => {
    // Mark field as touched and reset valid flag when user types
    state.ui.dropdownFields.salespersonCode.touched = true;
    state.ui.dropdownFields.salespersonCode.valid = false;
    handleSalespersonCodeSearch(e.target.value);
  });
  salespersonCodeSearch?.addEventListener('blur', () => {
    setTimeout(() => {
      const dropdown = el('salespersonCodeDropdown');
      if (dropdown) dropdown.classList.add('hidden');

      // Only validate if field was touched
      if (state.ui.dropdownFields.salespersonCode.touched &&
          !state.ui.dropdownFields.salespersonCode.valid &&
          salespersonCodeSearch.value.trim() !== '') {
        salespersonCodeSearch.value = '';
        // Clear related fields
        if (el('salespersonName')) el('salespersonName').value = '';
        // Clear state
        state.quote.salespersonCode = '';
        state.quote.salespersonName = '';
        saveState();
        // Show error message
        showError('Please select a salesperson from the dropdown');
      }
    }, 200);
  });

  // Assigned User ID search - Direct input (no debounce)
  const assignedUserIdSearch = el('assignedUserIdSearch');
  assignedUserIdSearch?.addEventListener('input', (e) => {
    // Mark field as touched and reset valid flag when user types
    state.ui.dropdownFields.assignedUserId.touched = true;
    state.ui.dropdownFields.assignedUserId.valid = false;
    handleAssignedUserIdSearch(e.target.value);
  });
  assignedUserIdSearch?.addEventListener('blur', () => {
    setTimeout(() => {
      const dropdown = el('assignedUserIdDropdown');
      if (dropdown) dropdown.classList.add('hidden');

      // Only validate if field was touched
      if (state.ui.dropdownFields.assignedUserId.touched &&
          !state.ui.dropdownFields.assignedUserId.valid &&
          assignedUserIdSearch.value.trim() !== '') {
        assignedUserIdSearch.value = '';
        // Clear state
        state.quote.assignedUserId = '';
        saveState();
        // Show error message
        showError('Please select a user from the dropdown');
      }
    }, 200);
  });

  // Material search in modal (No. field) - Direct input (no debounce)
  const materialSearch = el('lineObjectNumberSearch');
  materialSearch?.addEventListener('input', (e) => {
    // Mark field as touched and reset valid flag when user types
    state.ui.dropdownFields.materialNo.touched = true;
    state.ui.dropdownFields.materialNo.valid = false;
    handleMaterialSearch(e.target.value);
  });
  materialSearch?.addEventListener('blur', () => {
    setTimeout(() => {
      const dropdown = el('lineMaterialDropdown');
      if (dropdown) dropdown.classList.add('hidden');

      // Only validate if field was touched
      if (state.ui.dropdownFields.materialNo.touched &&
          !state.ui.dropdownFields.materialNo.valid &&
          materialSearch.value.trim() !== '') {
        materialSearch.value = '';
        // Clear related fields
        if (el('lineDescription')) el('lineDescription').value = '';
        if (el('lineUnitPrice')) el('lineUnitPrice').value = '0';
        // Clear state
        state.formData.newLine.lineObjectNumber = '';
        state.formData.newLine.materialId = null;
        // Show error message
        showToast('Please select a material from the dropdown', 'error');
      }
    }, 200);
  });

  // Discount sync in modal (bi-directional)
  el('lineDiscountPercent')?.addEventListener('input', (e) => handleModalDiscountSync('discountPercent', e.target.value));
  el('lineDiscountAmount')?.addEventListener('input', (e) => handleModalDiscountSync('discountAmount', e.target.value));

  // Line form changes (update total preview)
  ['lineQuantity', 'lineUnitPrice', 'lineDiscountPercent', 'lineDiscountAmount'].forEach(id => {
    el(id)?.addEventListener('input', updateLineTotalPreview);
  });

  // Invoice discount sync in totals card (bi-directional)
  el('invoiceDiscountPercent')?.addEventListener('input', (e) => handleInvoiceDiscountSync('invoiceDiscountPercent', e.target.value));
  el('invoiceDiscount')?.addEventListener('input', (e) => handleInvoiceDiscountSync('invoiceDiscount', e.target.value));

  // VAT rate changes (update totals)
  el('vatRate')?.addEventListener('input', renderTotals);

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    // Hide BC API customer dropdown
    if (!e.target.closest('#customerSearch') && !e.target.closest('#customerDropdown')) {
      hideCustomerDropdown();
    }
    // Hide local database customer dropdown
    if (!e.target.closest('#customerNoSearch') && !e.target.closest('#customerNoDropdown')) {
      const dropdown = el('customerNoDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }
    // Hide salesperson dropdown
    if (!e.target.closest('#salespersonCodeSearch') && !e.target.closest('#salespersonCodeDropdown')) {
      const dropdown = el('salespersonCodeDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }
    // Hide assigned user dropdown
    if (!e.target.closest('#assignedUserIdSearch') && !e.target.closest('#assignedUserIdDropdown')) {
      const dropdown = el('assignedUserIdDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }
    // Hide material dropdown
    if (!e.target.closest('#lineObjectNumberSearch') && !e.target.closest('#lineMaterialDropdown')) {
      const dropdown = el('lineMaterialDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }

    // Handle inline New SER button clicks
    if (e.target.matches('[data-field="usvtCreateSv"]') || e.target.closest('[data-field="usvtCreateSv"]')) {
      const button = e.target.matches('[data-field="usvtCreateSv"]') ? e.target : e.target.closest('[data-field="usvtCreateSv"]');
      const lineId = button.dataset.lineId;

      if (lineId) {
        const line = state.quote.lines.find(l => l.id === lineId);
        if (line) {
          // Toggle state
          line.usvtCreateSv = !line.usvtCreateSv;

          // Re-render row to show updated button state
          renderQuoteLines();
        }
      }
    }
  });

  // Close modal when clicking outside
  el('addLineModal')?.addEventListener('click', (e) => {
    if (e.target === el('addLineModal')) {
      closeAddLineModal();
    }
  });

  // DATE PICKER INITIALIZATION
  // ===========================
  // Initialize Flatpickr date fields BEFORE asterisk handlers
  initDateFields();

  // REQUIRED FIELD ASTERISK HANDLING
  // =================================
  // Main form required fields (must be initialized AFTER Flatpickr)
  // Note: 'branch' is excluded because it's auto-populated from user auth data
  const mainRequiredFields = ['customerNoSearch', 'orderDate', 'requestedDeliveryDate', 'salespersonCodeSearch', 'assignedUserIdSearch', 'serviceOrderType', 'division'];
  setupRequiredAsteriskHandlers(mainRequiredFields);

  // OPTIONAL FIELD VISUAL HINT
  // ============================
  // Work Description field - subtle hint to encourage filling
  const workDescriptionField = el('quoteWorkDescription');
  if (workDescriptionField) {
    // Function to update hint based on content
    const updateOptionalFieldHint = () => {
      if (workDescriptionField.value.trim()) {
        workDescriptionField.classList.add('has-content');
      } else {
        workDescriptionField.classList.remove('has-content');
      }
    };

    // Initial check
    updateOptionalFieldHint();

    // Add event listeners
    workDescriptionField.addEventListener('input', updateOptionalFieldHint);
    workDescriptionField.addEventListener('change', updateOptionalFieldHint);
  }

  // EDIT LINE MODAL SETUP
  // =====================
  // Setup event listeners for the edit line modal
  setupEditModalEventListeners();

  updateQuoteEditorModeUi();

  console.log('Event listeners setup complete');
}

// ============================================================
// Discount Sync Handlers (Modal & Inline)
// ============================================================

/**
 * Handle discount sync in modal (bi-directional)
 */
function handleModalDiscountSync(changedField, value) {
  const quantity = parseFloat(el('lineQuantity')?.value || 0);
  const unitPrice = parseFloat(el('lineUnitPrice')?.value || 0);
  const lineSubtotal = quantity * unitPrice;

  if (changedField === 'discountPercent') {
    const percent = sanitizeDiscountInput(value, 1); // 1 decimal place
    const percentInput = el('lineDiscountPercent');
    const amtInput = el('lineDiscountAmount');

    // Save cursor position BEFORE updating value
    const cursorPos = percentInput.selectionStart;

    percentInput.value = percent.toFixed(1);
    amtInput.value = ((lineSubtotal * percent) / 100).toFixed(2);

    // Restore cursor position (will work with type="text")
    percentInput.setSelectionRange(cursorPos, cursorPos);
  } else if (changedField === 'discountAmount') {
    const amount = sanitizeDiscountInput(value, 2); // 2 decimal places
    const amtInput = el('lineDiscountAmount');
    const percentInput = el('lineDiscountPercent');

    // Save cursor position BEFORE updating value
    const cursorPos = amtInput.selectionStart;

    amtInput.value = amount.toFixed(2);
    percentInput.value = (lineSubtotal > 0 ? (amount / lineSubtotal) * 100 : 0).toFixed(1);

    // Restore cursor position (will work with type="text")
    amtInput.setSelectionRange(cursorPos, cursorPos);
  }
  updateLineTotalPreview();
}

/**
 * Handle invoice discount sync in totals card (bi-directional)
 * Syncs between invoiceDiscount (amount) and invoiceDiscountPercent (%)
 */
function handleInvoiceDiscountSync(changedField, value) {
  // Get subtotal from all quote lines
  const subtotal = state.quote.lines.reduce((sum, line) => {
    const quantity = parseFloat(line.quantity) || 0;
    const unitPrice = parseFloat(line.unitPrice) || 0;
    const discountAmount = parseFloat(line.discountAmount) || 0;
    return sum + (quantity * unitPrice - discountAmount);
  }, 0);

  if (changedField === 'invoiceDiscountPercent') {
    // Percent changed - calculate amount
    const percent = sanitizeDiscountInput(value, 1); // 1 decimal place
    const percentInput = el('invoiceDiscountPercent');
    const amtInput = el('invoiceDiscount');

    if (!percentInput || !amtInput) return;

    // Save cursor position BEFORE updating value
    const cursorPos = percentInput.selectionStart;

    percentInput.value = percent.toFixed(1);
    amtInput.value = ((subtotal * percent) / 100).toFixed(2);

    // Restore cursor position
    percentInput.setSelectionRange(cursorPos, cursorPos);
  } else if (changedField === 'invoiceDiscount') {
    // Amount changed - calculate percent
    const amount = sanitizeDiscountInput(value, 2); // 2 decimal places
    const amtInput = el('invoiceDiscount');
    const percentInput = el('invoiceDiscountPercent');

    if (!percentInput || !amtInput) return;

    // Save cursor position BEFORE updating value
    const cursorPos = amtInput.selectionStart;

    amtInput.value = amount.toFixed(2);
    percentInput.value = (subtotal > 0 ? (amount / subtotal) * 100 : 0).toFixed(1);

    // Restore cursor position
    amtInput.setSelectionRange(cursorPos, cursorPos);
  }

  // Update totals display
  renderTotals();
}

// ============================================================
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  // Customer selection (BC API - Legacy)
  window.selectCustomer = handleCustomerSelection;

  // Customer selection (Local Database - New)
  window.selectCustomerFromLocal = selectCustomerFromLocal;

  // Salesperson selection
  window.selectSalesperson = selectSalesperson;

  // Assigned User selection
  window.selectAssignedUser = selectAssignedUser;

  // Item selection
  window.selectItem = handleItemSelection;

  // Quote line actions
  window.addQuoteLine = handleAddQuoteLine;
  window.removeQuoteLine = removeQuoteLineIndex => {
    handleRemoveQuoteLine(removeQuoteLineIndex);
  };

  // Quote actions
  window.clearQuote = handleClearQuote;
  window.saveDraft = handleSaveDraft;
  window.sendQuote = handleSendQuote;
  window.searchSalesQuote = handleSearchSalesQuote;
  window.startNewSalesQuote = startNewSalesQuoteFlow;

  // Remove confirmation modal
  window.confirmRemoveLine = confirmRemoveLine;
  window.cancelRemoveLine = cancelRemoveLine;

  // New SER confirmation modal
  window.confirmNewSerCreation = confirmNewSerCreation;
  window.cancelNewSerCreation = cancelNewSerCreation;

  // Modal functions
  window.setupLineModalHandlers = setupLineModalHandlers;
  window.updateNewSerButtonStateForAddModal = updateNewSerButtonStateForAddModal;

  // Modal functions (from ui.js)
  window.openInsertLineModal = window.openInsertLineModal;

  // Tab switching (from ui.js)
  window.switchTab = window.switchTab;
}

// Helper function for rendering customer dropdown (imported from ui.js)
function renderCustomerDropdown(customers) {
  const dropdown = el('customerDropdown');
  if (!dropdown) return;

  if (customers.length === 0) {
    dropdown.innerHTML = '<div class="search-dropdown-item text-gray-500">No customers found</div>';
  } else {
    dropdown.innerHTML = customers.map(customer => `
      <div class="search-dropdown-item" data-customer-id="${customer.id}">
        <div class="font-medium">${customer.name}</div>
        <div class="text-sm text-gray-600">${customer.number}</div>
      </div>
    `).join('');

    // Add click handlers
    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const customerId = item.getAttribute('data-customer-id');
        handleCustomerSelection(customerId);
      });
    });
  }

  dropdown.classList.remove('hidden');
}

// ============================================================
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  window.clearQuote = handleClearQuote;
  window.confirmClearQuote = confirmClearQuote;
  window.cancelClearQuote = cancelClearQuote;
  window.searchSalesQuote = handleSearchSalesQuote;
  window.startNewSalesQuote = startNewSalesQuoteFlow;
}

// Helper function for rendering item dropdown (imported from ui.js)
function renderItemDropdown(items) {
  const dropdown = el('itemDropdown');
  if (!dropdown) return;

  if (items.length === 0) {
    dropdown.innerHTML = '<div class="search-dropdown-item text-gray-500">No items found</div>';
  } else {
    dropdown.innerHTML = items.map(item => `
      <div class="search-dropdown-item" data-item-id="${item.id}">
        <div class="font-medium">${item.description}</div>
        <div class="text-sm text-gray-600">${item.number} - ${item.unitPrice.toFixed(2)}</div>
      </div>
    `).join('');

    // Add click handlers
    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const itemId = item.getAttribute('data-item-id');
        handleItemSelection(itemId);
      });
    });
  }

  dropdown.classList.remove('hidden');
}

// ============================================================
// Edit Line Modal Functions
// ============================================================

/**
 * Open edit line modal with line data pre-populated
 * @param {string} lineId - The ID of the line to edit
 */
function openEditLineModal(lineId) {
  const line = state.quote.lines.find(l => l.id === lineId);
  if (!line) {
    console.error(`Line with ID ${lineId} not found`);
    return;
  }

  const normalizedLineType = normalizeLineType(line.lineType);

  // Store the line ID being edited
  state.ui.editingLineId = lineId;

  // Reset SER creation flag for Edit modal
  state.ui.serCreatedEdit = false;

  // Reset dropdown validation state for Edit Material No field
  // If the line already has a material number, mark as valid but not touched
  // This prevents clearing valid pre-loaded values unless user interacts
  state.ui.dropdownFields.editMaterialNo.valid = !!(line.lineObjectNumber && line.lineObjectNumber.trim() !== '');
  state.ui.dropdownFields.editMaterialNo.touched = false;

  // Populate modal fields with line data
  document.getElementById('editLineType').value = normalizedLineType;
  document.getElementById('editLineUsvtGroupNo').value = line.usvtGroupNo || '';
  document.getElementById('editLineUsvtServiceItemNo').value = line.usvtServiceItemNo || '';
  document.getElementById('editLineUsvtServiceItemDescription').value = line.usvtServiceItemDescription || '';
  document.getElementById('editLineObjectNumberSearch').value = line.lineObjectNumber || '';
  document.getElementById('editLineDescription').value = line.description;
  document.getElementById('editLineQuantity').value = line.quantity;
  document.getElementById('editLineUnitPrice').value = line.unitPrice || 0;
  document.getElementById('editLineDiscountPercent').value = line.discountPercent || 0;
  document.getElementById('editLineDiscountAmount').value = line.discountAmount || 0;
  document.getElementById('editLineUsvtAddition').checked = line.usvtAddition || false;
  document.getElementById('editLineUsvtRefSalesQuoteno').value = line.usvtRefSalesQuoteno || '';

  // Check if line has existing Service Item No - lock Type, Serv Item No, Serv Item Desc
  const hasExistingSer = line.usvtServiceItemNo && line.usvtServiceItemNo.trim() !== '';
  state.ui.editLineLocked = hasExistingSer;

  // Initialize New SER button state based on existing line data
  const newSerButton = document.getElementById('editLineCreateSv');
  if (newSerButton) {
    const isComment = normalizedLineType === 'Comment';

    if (hasExistingSer || isComment) {
      newSerButton.disabled = true;
      if (hasExistingSer) {
        newSerButton.innerHTML = '✓ Created';
      } else {
        newSerButton.innerHTML = 'New SER';
      }
    } else {
      newSerButton.disabled = false;
      newSerButton.innerHTML = 'New SER';
    }
    newSerButton.style.opacity = '1';
  }

  // Update New SER button state based on Group No (checks for existing Service Items in the same group)
  updateNewSerButtonStateForEditModal(lineId);

  // Lock fields if Service Item No exists
  if (hasExistingSer) {
    const typeField = document.getElementById('editLineType');
    const servItemNoField = document.getElementById('editLineUsvtServiceItemNo');
    const servItemDescField = document.getElementById('editLineUsvtServiceItemDescription');

    // Disable Type dropdown
    typeField.disabled = true;
    typeField.classList.add('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');

    // Disable Service Item No
    servItemNoField.disabled = true;
    servItemNoField.classList.add('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');

    // Disable Service Item Description
    servItemDescField.disabled = true;
    servItemDescField.classList.add('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');
  }

  // Update field states based on Type (respects locked state)
  updateEditModalFieldStates(normalizedLineType);

  // Setup required field asterisk handlers for Edit modal
  setupEditModalAsteriskHandlers();

  // Update line total preview
  updateEditLineTotal();

  // Update Ref Sales Quote No field state based on Addition checkbox
  updateEditAdditionFieldState();

  // Show modal
  const modal = document.getElementById('editLineModal');
  const content = document.getElementById('editLineModalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    content.classList.remove('opacity-0', 'translate-y-[-10px]');
    content.classList.add('opacity-100', 'translate-y-0');
  }, 10);
}

/**
 * Close edit line modal without saving
 */
function closeEditLineModal() {
  const modal = document.getElementById('editLineModal');
  const content = document.getElementById('editLineModalContent');

  // Reset locked state and unlock fields
  state.ui.editLineLocked = false;

  // Reset all fields that might be disabled
  const fieldsToReset = [
    { id: 'editLineType', classes: ['opacity-50', 'bg-slate-50', 'text-slate-600', 'cursor-not-allowed'] },
    { id: 'editLineUsvtServiceItemNo', classes: ['opacity-50', 'bg-slate-50', 'text-slate-600', 'cursor-not-allowed'] },
    { id: 'editLineUsvtServiceItemDescription', classes: ['opacity-50', 'bg-slate-50', 'text-slate-600', 'cursor-not-allowed'] },
    { id: 'editLineObjectNumberSearch', classes: ['opacity-50', 'bg-slate-50', 'text-slate-600', 'cursor-not-allowed'] },
    { id: 'editLineQuantity', classes: ['opacity-50', 'bg-slate-50', 'text-slate-600', 'cursor-not-allowed'] },
    { id: 'editLineUnitPrice', classes: ['opacity-50', 'bg-slate-50', 'text-slate-600', 'cursor-not-allowed'] },
    { id: 'editLineDiscountPercent', classes: ['opacity-50', 'bg-slate-50', 'text-slate-600', 'cursor-not-allowed'] },
    { id: 'editLineDiscountAmount', classes: ['opacity-50', 'bg-slate-50', 'text-slate-600', 'cursor-not-allowed'] }
  ];

  fieldsToReset.forEach(field => {
    const el = document.getElementById(field.id);
    if (el) {
      el.disabled = false;
      // Reset readOnly attribute for the No field
      if (field.id === 'editLineObjectNumberSearch') {
        el.readOnly = false;
      }
      field.classes.forEach(cls => el.classList.remove(cls));
      el.removeAttribute('title');
    }
  });

  // Reset Addition checkbox
  const additionCheckbox = document.getElementById('editLineUsvtAddition');
  if (additionCheckbox) {
    additionCheckbox.disabled = false;
    additionCheckbox.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  // Reset Ref Sales Quote No field
  const refSalesQuoteField = document.getElementById('editLineUsvtRefSalesQuoteno');
  if (refSalesQuoteField) {
    refSalesQuoteField.disabled = false;
    refSalesQuoteField.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
  }

  content.classList.remove('opacity-100', 'translate-y-0');
  content.classList.add('opacity-0', 'translate-y-[-10px]');
  setTimeout(() => {
    modal.classList.add('hidden');
    state.ui.editingLineId = null;
    // Reset SER creation flag for Edit modal
    state.ui.serCreatedEdit = false;
    // Also reset pending flag if confirmation modal was open
    state.ui.pendingSerCreationEdit = false;
  }, 300);
}

/**
 * Save changes from edit line modal
 */
function saveEditLine() {
  const lineId = state.ui.editingLineId;
  if (!lineId) return;

  // Force blur event on Material No field to trigger dropdown validation
  const editMaterialNoField = document.getElementById('editLineObjectNumberSearch');
  if (editMaterialNoField) {
    editMaterialNoField.blur();
  }

  const parsedQuantity = parseFloat(document.getElementById('editLineQuantity').value);

  // Get values from modal
  const lineData = {
    lineType: normalizeLineType(document.getElementById('editLineType').value),
    usvtGroupNo: normalizeGroupNo(document.getElementById('editLineUsvtGroupNo').value),
    usvtServiceItemNo: document.getElementById('editLineUsvtServiceItemNo').value,
    usvtServiceItemDescription: document.getElementById('editLineUsvtServiceItemDescription').value,
    lineObjectNumber: document.getElementById('editLineObjectNumberSearch').value,
    description: document.getElementById('editLineDescription').value.trim(),
    quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
    unitPrice: parseFloat(document.getElementById('editLineUnitPrice').value) || 0,
    discountPercent: parseFloat(document.getElementById('editLineDiscountPercent').value) || 0,
    discountAmount: parseFloat(document.getElementById('editLineDiscountAmount').value) || 0,
    usvtAddition: document.getElementById('editLineUsvtAddition').checked,
    usvtRefSalesQuoteno: document.getElementById('editLineUsvtRefSalesQuoteno').value
  };

  const existingLine = state.quote.lines.find(l => l.id === lineId);
  const existingLineHasServiceItem = !!(existingLine?.usvtServiceItemNo && existingLine.usvtServiceItemNo.trim() !== '');
  if (!existingLineHasServiceItem && hasServiceItemInGroupNo(lineData.usvtGroupNo, lineId)) {
    lineData.usvtServiceItemNo = '';
    lineData.usvtServiceItemDescription = '';
  }

  // Validation
  // Material No. and quantity are only required for Item type
  if (lineData.lineType === 'Item') {
    // Check dropdown validation first (must be selected from dropdown, not free text)
    if (!state.ui.dropdownFields.editMaterialNo.valid && lineData.lineObjectNumber !== '') {
      showToast('Please select a material from the dropdown list', 'error');
      if (editMaterialNoField) editMaterialNoField.focus();
      return;
    }
    if (!lineData.lineObjectNumber) {
      showToast('Material No. is required', 'error');
      return;
    }
    if (lineData.quantity <= 0) {
      showToast('Quantity must be greater than 0', 'error');
      return;
    }
  }
  // Description is required for both types
  if (!lineData.description) {
    showToast('Description is required', 'error');
    return;
  }

  // Update line in state
  const lineIndex = state.quote.lines.findIndex(l => l.id === lineId);
  if (lineIndex !== -1) {
    state.quote.lines[lineIndex] = { ...state.quote.lines[lineIndex], ...lineData };
  }

  // Recalculate totals
  calculateTotals();

  // Re-render table
  renderQuoteLines();

  // Sync fullscreen table
  updateFullscreenTable();

  // Close modal
  closeEditLineModal();

  // Show success toast
  showToast('Quote line has been updated successfully', 'success');
}

/**
 * Update line total preview in edit modal
 */
function updateEditLineTotal() {
  const qty = parseFloat(document.getElementById('editLineQuantity').value) || 0;
  const price = parseFloat(document.getElementById('editLineUnitPrice').value) || 0;
  const discAmt = parseFloat(document.getElementById('editLineDiscountAmount').value) || 0;

  const lineTotal = (qty * price) - discAmt;
  document.getElementById('editLineTotalPreview').textContent = formatCurrency(lineTotal);
}

/**
 * Update field states based on Type selection in edit modal
 * @param {string} type - The line type ('Item' or 'Comment')
 */
function updateEditModalFieldStates(type) {
  const normalizedType = normalizeLineType(type);
  const servItemNo = document.getElementById('editLineUsvtServiceItemNo');
  const servItemDesc = document.getElementById('editLineUsvtServiceItemDescription');
  const newSerButton = document.getElementById('editLineCreateSv');
  const quantityField = document.getElementById('editLineQuantity');
  const noField = document.getElementById('editLineObjectNumberSearch');
  const unitPriceField = document.getElementById('editLineUnitPrice');
  const discountPercentField = document.getElementById('editLineDiscountPercent');
  const discountAmountField = document.getElementById('editLineDiscountAmount');
  const additionCheckbox = document.getElementById('editLineUsvtAddition');
  const refSalesQuoteField = document.getElementById('editLineUsvtRefSalesQuoteno');

  // If fields are locked due to existing Service Item, skip state updates
  if (state.ui.editLineLocked) {
    return; // Keep fields in their locked state
  }

  if (normalizedType === 'Comment') {
    // Disable Service Item fields and clear values
    servItemNo.disabled = true;
    servItemDesc.disabled = true;
    servItemNo.value = '';
    servItemDesc.value = '';

    // Disable, add readonly, and clear No field
    noField.disabled = true;
    noField.readOnly = true;
    noField.classList.add('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');
    noField.value = '';

    // Disable and set Quantity to 0
    quantityField.disabled = true;
    quantityField.classList.add('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');
    quantityField.value = '0';

    // Disable and set Unit Price to 0
    unitPriceField.disabled = true;
    unitPriceField.classList.add('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');
    unitPriceField.value = '0';

    // Disable and set Disc % to 0
    discountPercentField.disabled = true;
    discountPercentField.classList.add('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');
    discountPercentField.value = '0';

    // Disable and set Discount Amt to 0
    discountAmountField.disabled = true;
    discountAmountField.classList.add('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');
    discountAmountField.value = '0';

    // Uncheck and disable Addition
    additionCheckbox.disabled = true;
    additionCheckbox.classList.add('opacity-50', 'cursor-not-allowed');
    additionCheckbox.checked = false;

    // Disable and clear Ref Sales Quote No
    refSalesQuoteField.disabled = true;
    refSalesQuoteField.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
    refSalesQuoteField.value = '';

    // Disable New SER button for Comment type
    if (newSerButton) {
      newSerButton.disabled = true;
      newSerButton.innerHTML = 'New SER';
    }

    // Update line total preview to reflect 0 quantity
    updateEditLineTotal();
  } else {
    // Enable Service Item fields
    servItemNo.disabled = false;
    servItemDesc.disabled = false;

    // Enable No field
    noField.disabled = false;
    noField.readOnly = false;
    noField.classList.remove('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');

    // Enable Quantity
    quantityField.disabled = false;
    quantityField.classList.remove('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');

    // Enable Unit Price
    unitPriceField.disabled = false;
    unitPriceField.classList.remove('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');

    // Enable Disc %
    discountPercentField.disabled = false;
    discountPercentField.classList.remove('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');

    // Enable Discount Amt
    discountAmountField.disabled = false;
    discountAmountField.classList.remove('bg-slate-50', 'text-slate-600', 'cursor-not-allowed');

    // Enable Addition
    additionCheckbox.disabled = false;
    additionCheckbox.classList.remove('opacity-50', 'cursor-not-allowed');

    // Update Ref Sales Quote No field state based on Addition checkbox
    updateEditAdditionFieldState();

    // Update New SER button state based on Group No when switching to Item type
    updateNewSerButtonStateForEditModal(state.ui.editingLineId);
  }

  // Update Service Item field state based on SER creation flag
  updateEditServiceItemFieldState();
}

/**
 * Handle bi-directional discount sync in edit modal
 * @param {string} field - The field that changed ('percent' or 'amount')
 * @param {string} value - The new value
 */
function handleEditModalDiscountChange(field, value) {
  const qty = parseFloat(document.getElementById('editLineQuantity').value) || 0;
  const price = parseFloat(document.getElementById('editLineUnitPrice').value) || 0;
  const subtotal = qty * price;

  if (field === 'percent') {
    const percent = parseFloat(value) || 0;
    const amount = (subtotal * percent) / 100;
    document.getElementById('editLineDiscountAmount').value = amount.toFixed(2);
  } else {
    const amount = parseFloat(value) || 0;
    const percent = subtotal > 0 ? (amount / subtotal) * 100 : 0;
    document.getElementById('editLineDiscountPercent').value = percent.toFixed(1);
  }

  updateEditLineTotal();
}

/**
 * Update Ref Sales Quote No field based on Addition checkbox state in edit modal
 * When Addition is OFF (unchecked), disable and clear Ref Sales Quote No
 * When Addition is ON (checked), enable Ref Sales Quote No
 */
function updateEditAdditionFieldState() {
  const additionCheckbox = document.getElementById('editLineUsvtAddition');
  const refSalesQuoteField = document.getElementById('editLineUsvtRefSalesQuoteno');

  if (!additionCheckbox || !refSalesQuoteField) return;

  const isAdditionEnabled = additionCheckbox.checked;

  if (!isAdditionEnabled) {
    // Disable Ref Sales Quote No when Addition is OFF
    refSalesQuoteField.disabled = true;
    refSalesQuoteField.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
    refSalesQuoteField.value = ''; // Clear value
  } else {
    // Enable Ref Sales Quote No when Addition is ON
    refSalesQuoteField.disabled = false;
    refSalesQuoteField.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
  }
}

// ============================================================
// Edit Modal - New SER Button Handlers
// ============================================================

/**
 * Show confirmation modal for New SER creation (Edit modal context)
 */
async function showConfirmNewSerModalForEdit() {
  // Prevent creation if fields are locked due to existing Service Item
  if (state.ui.editLineLocked) {
    showError('Cannot create new Service Item - this line already has a Service Item.');
    return;
  }

  const description = document.getElementById('editLineUsvtServiceItemDescription').value.trim();

  // Validate description before showing modal
  if (!description) {
    showError('Service Item Description is required before creating a Service Item.');
    document.getElementById('editLineUsvtServiceItemDescription').focus();
    return;
  }

  // Get modal elements
  let modal = document.getElementById('confirmNewSerModal');
  let modalContent = document.getElementById('confirmNewSerModalContent');

  // Fallback: if modal not in DOM, load it dynamically
  if (!modal || !modalContent) {
    console.warn('[CONFIRM-NEW-SER-EDIT] Modal not found in DOM, loading dynamically...');
    try {
      const { loadModal } = await import('./components/modal-loader.js');
      await loadModal('confirmNewSerModal');
      modal = document.getElementById('confirmNewSerModal');
      modalContent = document.getElementById('confirmNewSerModalContent');
      console.log('[CONFIRM-NEW-SER-EDIT] Modal loaded dynamically');
    } catch (err) {
      console.error('[CONFIRM-NEW-SER-EDIT] Failed to load modal:', err);
      showError('Failed to load confirmation modal. Please refresh the page and try again.');
      return;
    }
  }

  // Display the description in the modal
  const descriptionEl = document.getElementById('confirmNewSerDescription');
  if (descriptionEl) {
    descriptionEl.textContent = `"${description}"`;
  }

  // Show modal with animation
  if (modal && modalContent) {
    // Move modal to end of container to ensure proper stacking context
    // This ensures the confirmation modal appears on top of any other open modals
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
      modalContainer.appendChild(modal);
    }

    // Match the add-line confirmation behavior so this dialog always sits
    // above the base add/edit modals even when CSS output is stale.
    modal.style.zIndex = '150';
    state.ui.pendingSerCreation = false;
    state.ui.pendingSerCreationEdit = true;
    modal.classList.remove('hidden');
    setTimeout(() => {
      modalContent.style.opacity = '1';
      modalContent.style.transform = 'translateY(0)';
    }, 10);
  }
}

/**
 * Confirm and proceed with New SER creation (Edit modal context)
 */
function confirmNewSerCreationForEdit() {
  hideConfirmNewSerModal();
  // Proceed with the actual creation after modal closes
  setTimeout(() => {
    createServiceItemAndLockFieldsForEdit();
  }, 350); // Wait for modal animation to complete
}

/**
 * Create Service Item and lock fields in Edit modal
 */
async function createServiceItemAndLockFieldsForEdit() {
  // If already created, do nothing
  if (state.ui.serCreatedEdit) {
    showError('Service Item already created');
    return;
  }

  // Prevent creation if fields are locked due to existing Service Item
  if (state.ui.editLineLocked) {
    showError('Cannot create new Service Item - this line already has a Service Item.');
    return;
  }

  // Get required field values
  const serviceItemDesc = document.getElementById('editLineUsvtServiceItemDescription')?.value?.trim();
  const customerNo = state.quote.customerNo || '';
  const groupNo = document.getElementById('editLineUsvtGroupNo')?.value?.trim() || '1';

  // Validation: Serv. Item Desc is required
  if (!serviceItemDesc) {
    showError('Please enter Service Item Description before creating New SER');
    document.getElementById('editLineUsvtServiceItemDescription')?.focus();
    return;
  }

  // Show creating state
  const newSerButton = document.getElementById('editLineCreateSv');
  if (newSerButton) {
    newSerButton.disabled = true;
    newSerButton.innerHTML = 'Creating...';
    newSerButton.style.opacity = '0.7';
  }

  try {
    // Call CreateServiceItem API
    const serviceItemNo = await createServiceItem(serviceItemDesc, customerNo, groupNo);

    // Set SER creation flag
    state.ui.serCreatedEdit = true;

    // Populate Serv. Item No. field with API response
    const serviceItemNoField = document.getElementById('editLineUsvtServiceItemNo');
    if (serviceItemNoField) {
      serviceItemNoField.value = serviceItemNo;
    }

    // Lock fields (Service Item No, Desc)
    updateEditServiceItemFieldState();

    // Lock Type dropdown
    const typeSelect = document.getElementById('editLineType');
    if (typeSelect) {
      typeSelect.disabled = true;
      typeSelect.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-50');
    }

    // Update button to "Created" state (disabled)
    if (newSerButton) {
      newSerButton.disabled = true;
      newSerButton.innerHTML = '✓ Created';
      newSerButton.style.opacity = '1';
    }

    // Show success message
    showSuccess(`Service Item ${serviceItemNo} created successfully`);

  } catch (error) {
    // API call failed - re-enable button
    console.error('Failed to create Service Item:', error);
    showError(error.message || 'Failed to create Service Item. Please try again.');
    if (newSerButton) {
      newSerButton.disabled = false;
      newSerButton.innerHTML = 'New SER';
      newSerButton.style.opacity = '1';
    }
  }
}

/**
 * Update Service Item fields in Edit modal - lock fields if SER was created OR Type is Comment
 */
function updateEditServiceItemFieldState(excludeLineId = state.ui.editingLineId) {
  const serviceItemNoField = document.getElementById('editLineUsvtServiceItemNo');
  const serviceItemDescField = document.getElementById('editLineUsvtServiceItemDescription');
  const typeSelect = document.getElementById('editLineType');
  const groupNoField = document.getElementById('editLineUsvtGroupNo');

  if (!serviceItemNoField || !serviceItemDescField || !typeSelect || !groupNoField) {
    return;
  }

  const line = state.quote.lines.find(l => l.id === excludeLineId);
  const groupNo = normalizeGroupNo(groupNoField.value);
  const isComment = typeSelect.value === 'Comment';
  const isSerCreated = state.ui.serCreatedEdit;
  const hasExistingServiceItemOnLine = !!(line?.usvtServiceItemNo && line.usvtServiceItemNo.trim() !== '');
  const hasExistingSerInGroup = hasServiceItemInGroupNo(groupNo, excludeLineId);
  const lockedByGroup = !hasExistingServiceItemOnLine && hasExistingSerInGroup;
  const lockReason = lockedByGroup ? getGroupServiceItemLockMessage(groupNo) : '';
  const shouldLock = hasExistingServiceItemOnLine || isSerCreated || isComment || lockedByGroup;
  const shouldClear = !hasExistingServiceItemOnLine && !isSerCreated && (isComment || lockedByGroup);

  setServiceItemFieldLockState(serviceItemNoField, shouldLock, {
    clearValue: shouldClear,
    title: lockReason
  });
  setServiceItemFieldLockState(serviceItemDescField, shouldLock, {
    clearValue: shouldClear,
    title: lockReason
  });
}

/**
 * Setup event listeners for edit modal
 */
function setupEditModalEventListeners() {
  // Quantity and Unit Price changes - update total
  document.getElementById('editLineQuantity').addEventListener('input', updateEditLineTotal);
  document.getElementById('editLineUnitPrice').addEventListener('input', updateEditLineTotal);

  // Discount fields - bi-directional sync
  document.getElementById('editLineDiscountPercent').addEventListener('input', (e) => {
    handleEditModalDiscountChange('percent', e.target.value);
  });
  document.getElementById('editLineDiscountAmount').addEventListener('input', (e) => {
    handleEditModalDiscountChange('amount', e.target.value);
  });

  // Type change - update field states
  document.getElementById('editLineType').addEventListener('change', (e) => {
    updateEditModalFieldStates(e.target.value);
  });

  // Addition change - update Ref Sales Quote No field state
  document.getElementById('editLineUsvtAddition').addEventListener('change', updateEditAdditionFieldState);

  // Group No change - update New SER button state
  const groupNoField = document.getElementById('editLineUsvtGroupNo');
  if (groupNoField) {
    groupNoField.addEventListener('input', () => {
      const editingLineId = state.ui.editingLineId;
      updateNewSerButtonStateForEditModal(editingLineId);
    });
    groupNoField.addEventListener('change', () => {
      const editingLineId = state.ui.editingLineId;
      updateNewSerButtonStateForEditModal(editingLineId);
    });
  }

  // Material search in edit modal (No. field) - Dropdown validation
  const editMaterialSearch = document.getElementById('editLineObjectNumberSearch');
  if (editMaterialSearch) {
    editMaterialSearch.addEventListener('input', (e) => {
      // Mark field as touched and reset valid flag when user types
      state.ui.dropdownFields.editMaterialNo.touched = true;
      state.ui.dropdownFields.editMaterialNo.valid = false;
      handleEditMaterialSearch(e.target.value);
    });
    editMaterialSearch.addEventListener('blur', () => {
      setTimeout(() => {
        const dropdown = document.getElementById('editLineMaterialDropdown');
        if (dropdown) dropdown.classList.add('hidden');

        // Only validate if field was touched
        if (state.ui.dropdownFields.editMaterialNo.touched &&
            !state.ui.dropdownFields.editMaterialNo.valid &&
            editMaterialSearch.value.trim() !== '') {
          editMaterialSearch.value = '';
          // Clear related fields
          document.getElementById('editLineDescription').value = '';
          document.getElementById('editLineUnitPrice').value = '0';
          // Show error message
          showToast('Please select a material from the dropdown', 'error');
        }
      }, 200);
    });
  }

  // New SER button - show confirmation modal first
  const newSerButton = document.getElementById('editLineCreateSv');
  if (newSerButton) {
    newSerButton.addEventListener('click', showConfirmNewSerModalForEdit);
  }

  // Close modal on backdrop click
  document.getElementById('editLineModal').addEventListener('click', (e) => {
    if (e.target.id === 'editLineModal') {
      closeEditLineModal();
    }
  });

  // Close modal on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('editLineModal').classList.contains('hidden')) {
      closeEditLineModal();
    }
  });
}

// ============================================================
// Export functions to window for onclick handlers
// ============================================================

if (typeof window !== 'undefined') {
  window.clearQuote = handleClearQuote;
  window.confirmClearQuote = confirmClearQuote;
  window.cancelClearQuote = cancelClearQuote;
  window.openEditLineModal = openEditLineModal;
  window.closeEditLineModal = closeEditLineModal;
  window.saveEditLine = saveEditLine;
  window.searchSalesQuote = handleSearchSalesQuote;
  window.startNewSalesQuote = startNewSalesQuoteFlow;
  // New SER confirmation modal handlers
  window.confirmNewSerCreation = confirmNewSerCreation;
  window.cancelNewSerCreation = cancelNewSerCreation;
}
