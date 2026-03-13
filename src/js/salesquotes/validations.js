/**
 * Sales Quotes Form Validations
 * Validation rules and error messages for Sales Quotes forms
 */

import { updateValidation } from './state.js';

// ============================================================
// Validation Error Messages
// ============================================================

const ERROR_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_NUMBER: 'Please enter a valid number',
  INVALID_DATE: 'Please enter a valid date',
  INVALID_QUANTITY: 'Quantity must be greater than 0',
  INVALID_PRICE: 'Unit price must be greater than 0',
  INVALID_DISCOUNT: 'Discount cannot be greater than line total',
  INVALID_POSTAL_CODE: 'Postal code must be 5 digits',
  AT_LEAST_ONE_LINE: 'Please add at least one line item',
  CUSTOMER_REQUIRED: 'Please select a customer'
};

// ============================================================
// Validation Rules
// ============================================================

/**
 * Check if field is required and not empty
 */
function isRequired(value) {
  return value !== null && value !== undefined && value.toString().trim() !== '';
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Thai or international format)
 */
function isValidPhone(phone) {
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate number is positive
 */
function isPositiveNumber(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function isValidDate(dateString) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * Validate date range
 */
function isValidDateRange(startDate, endDate) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) return false;
  return new Date(endDate) > new Date(startDate);
}

/**
 * Validate postal code (5 digits for Thailand)
 */
function isValidPostalCode(postalCode) {
  const postalRegex = /^\d{5}$/;
  return postalRegex.test(postalCode);
}

// ============================================================
// Field Validators
// ============================================================

/**
 * Validate customer field
 */
export function validateCustomer(value) {
  if (!isRequired(value)) {
    return ERROR_MESSAGES.CUSTOMER_REQUIRED;
  }
  return null;
}

/**
 * Validate line item quantity
 */
export function validateQuantity(value, lineType = 'Item') {
  if (!isRequired(value)) {
    return ERROR_MESSAGES.REQUIRED;
  }

  const num = parseFloat(value);
  if (isNaN(num)) {
    return ERROR_MESSAGES.INVALID_NUMBER;
  }

  if (lineType === 'Comment') {
    return num >= 0 ? null : ERROR_MESSAGES.INVALID_NUMBER;
  }

  if (!isPositiveNumber(value)) {
    return ERROR_MESSAGES.INVALID_QUANTITY;
  }
  return null;
}

/**
 * Validate line item unit price
 * Note: Unit price can be 0 or greater (removed > 0 restriction)
 */
export function validateUnitPrice(value) {
  if (!isRequired(value)) {
    return ERROR_MESSAGES.REQUIRED;
  }
  // Check if it's a valid number (>= 0 instead of > 0)
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) {
    return ERROR_MESSAGES.INVALID_NUMBER;
  }
  return null;
}

/**
 * Validate line item discount
 */
export function validateDiscount(discount, quantity, unitPrice) {
  if (!isRequired(discount)) {
    return null; // Discount is optional
  }

  const discountValue = parseFloat(discount);
  const quantityValue = parseFloat(quantity) || 0;
  const unitPriceValue = parseFloat(unitPrice) || 0;
  const lineTotal = quantityValue * unitPriceValue;

  if (isNaN(discountValue) || discountValue < 0) {
    return ERROR_MESSAGES.INVALID_NUMBER;
  }

  if (discountValue > lineTotal) {
    return ERROR_MESSAGES.INVALID_DISCOUNT;
  }

  return null;
}

/**
 * Validate quote line
 */
export function validateQuoteLine(line) {
  const errors = {};

  const descriptionError = !isRequired(line.description) ? ERROR_MESSAGES.REQUIRED : null;
  if (descriptionError) errors.description = descriptionError;

  const quantityError = validateQuantity(line.quantity, line.lineType);
  if (quantityError) errors.quantity = quantityError;

  // Unit Price is now optional - no validation required
  // const unitPriceError = validateUnitPrice(line.unitPrice);
  // if (unitPriceError) errors.unitPrice = unitPriceError;

  const discountError = validateDiscount(line.discountAmount, line.quantity, line.unitPrice);
  if (discountError) errors.discountAmount = discountError;

  return errors;
}

// ============================================================
// Form Validators
// ============================================================

/**
 * Validate quote header form
 */
export function validateQuoteHeader(formData) {
  const errors = {};

  // Customer validation
  const customerError = validateCustomer(formData.customerId);
  if (customerError) errors.customerId = customerError;

  return errors;
}

/**
 * Validate entire quote
 */
export function validateQuote(quote) {
  const errors = {};

  // Validate header
  const headerErrors = validateQuoteHeader(quote);
  Object.assign(errors, headerErrors);

  // Validate lines (no minimum requirement - backend accepts empty line items)
  quote.lines.forEach((line, index) => {
    const lineErrors = validateQuoteLine(line);
    if (Object.keys(lineErrors).length > 0) {
      errors[`line_${index}`] = lineErrors;
    }
  });

  return errors;
}

// ============================================================
// Validation Helper Functions
// ============================================================

/**
 * Check if validation has errors
 */
export function hasValidationErrors(errors) {
  return Object.keys(errors).length > 0;
}

/**
 * Get first error message
 */
export function getFirstErrorMessage(errors) {
  const keys = Object.keys(errors);
  if (keys.length === 0) return null;

  const firstKey = keys[0];
  const firstError = errors[firstKey];

  // If error is an object (nested errors), get first nested error
  if (typeof firstError === 'object' && !Array.isArray(firstError)) {
    return getFirstErrorMessage(firstError);
  }

  return firstError;
}

/**
 * Display validation errors
 */
export function displayValidationErrors(errors) {
  if (hasValidationErrors(errors)) {
    const firstError = getFirstErrorMessage(errors);
    console.error('Validation errors:', errors);
    return firstError;
  }
  return null;
}

/**
 * Update and display validation
 */
export function validateAndUpdate(quote) {
  const errors = validateQuote(quote);
  updateValidation(errors);
  return {
    isValid: !hasValidationErrors(errors),
    errors
  };
}

// ============================================================
// Real-time Validation
// ============================================================

/**
 * Validate customer selection in real-time
 */
export function validateCustomerSelection(customer) {
  if (!customer || !customer.id) {
    return ERROR_MESSAGES.CUSTOMER_REQUIRED;
  }
  return null;
}

/**
 * Validate line item in real-time
 */
export function validateLineItemRealtime(field, value, line) {
  switch (field) {
    case 'description':
      return isRequired(value) ? null : ERROR_MESSAGES.REQUIRED;
    case 'quantity':
      return validateQuantity(value, line?.lineType);
    case 'unitPrice':
      return validateUnitPrice(value);
    case 'discount':
      return validateDiscount(value, line.quantity, line.unitPrice);
    default:
      return null;
  }
}

// ============================================================
// Sanitization
// ============================================================

/**
 * Sanitize number input
 */
export function sanitizeNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Sanitize text input
 */
export function sanitizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return value.toString().trim();
}

/**
 * Sanitize quote data before submission
 */
export function sanitizeQuoteData(quote) {
  return {
    ...quote,
    orderDate: sanitizeText(quote.orderDate),
    requestedDeliveryDate: sanitizeText(quote.requestedDeliveryDate),
    workDescription: sanitizeText(quote.workDescription),
    lines: quote.lines.map(line => ({
      ...line,
      description: sanitizeText(line.description),
      quantity: sanitizeNumber(line.quantity),
      unitPrice: sanitizeNumber(line.unitPrice),
      discountAmount: sanitizeNumber(line.discountAmount)
    }))
  };
}

// ============================================================
// Quote Line Validation (Comprehensive)
// ============================================================

/**
 * Validate quote line data (comprehensive version for Add/Edit)
 * @param {Object} line - Line data to validate
 * @returns {Object} {isValid, errors, firstErrorField}
 */
export function validateQuoteLineData(line) {
  const errors = {};
  let firstErrorField = null;
  const isItem = line.lineType === 'Item';

  // 1. Description (required)
  if (!line.description || line.description.trim() === '') {
    errors.description = 'Description is required';
    if (!firstErrorField) firstErrorField = 'description';
  }

  // 2. No. / Material No (required when Type is Item)
  if (isItem && (!line.lineObjectNumber || line.lineObjectNumber.trim() === '')) {
    errors.lineObjectNumber = 'No. (Material No.) is required';
    if (!firstErrorField) firstErrorField = 'lineObjectNumber';
  }

  // 3. Service Item Description (required if New SER is enabled)
  if (line.usvtCreateSv && (!line.usvtServiceItemDescription || line.usvtServiceItemDescription.trim() === '')) {
    errors.usvtServiceItemDescription = 'Service Item Description is required when New SER is enabled';
    if (!firstErrorField) firstErrorField = 'usvtServiceItemDescription';
  }

  // 4. Quantity
  const quantityError = validateQuantity(line.quantity, line.lineType);
  if (quantityError) {
    errors.quantity = quantityError;
    if (!firstErrorField) firstErrorField = 'quantity';
  }

  // 5. Unit Price (cannot be negative)
  if (line.unitPrice < 0) {
    errors.unitPrice = 'Unit price cannot be negative';
    if (!firstErrorField) firstErrorField = 'unitPrice';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    firstErrorField
  };
}

/**
 * Sanitize discount input value
 * @param {string} value - Raw input value
 * @param {number} decimals - Decimal places (1 for %, 2 for amount)
 * @returns {number} Sanitized number
 */
export function sanitizeDiscountInput(value, decimals) {
  const cleaned = value.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) return 0;
  return Number(parsed.toFixed(decimals));
}
