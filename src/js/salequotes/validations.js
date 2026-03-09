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
  CUSTOMER_REQUIRED: 'Please select a customer',
  INVALID_DATE_RANGE: 'Validity date must be after quote date'
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
 * Validate quote date
 */
export function validateQuoteDate(value) {
  if (!isRequired(value)) {
    return ERROR_MESSAGES.REQUIRED;
  }
  if (!isValidDate(value)) {
    return ERROR_MESSAGES.INVALID_DATE;
  }
  return null;
}

/**
 * Validate validity date
 */
export function validateValidityDate(value, quoteDate) {
  if (!isRequired(value)) {
    return ERROR_MESSAGES.REQUIRED;
  }
  if (!isValidDate(value)) {
    return ERROR_MESSAGES.INVALID_DATE;
  }
  if (quoteDate && !isValidDateRange(quoteDate, value)) {
    return ERROR_MESSAGES.INVALID_DATE_RANGE;
  }
  return null;
}

/**
 * Validate line item quantity
 */
export function validateQuantity(value) {
  if (!isRequired(value)) {
    return ERROR_MESSAGES.REQUIRED;
  }
  if (!isPositiveNumber(value)) {
    return ERROR_MESSAGES.INVALID_QUANTITY;
  }
  return null;
}

/**
 * Validate line item unit price
 */
export function validateUnitPrice(value) {
  if (!isRequired(value)) {
    return ERROR_MESSAGES.REQUIRED;
  }
  if (!isPositiveNumber(value)) {
    return ERROR_MESSAGES.INVALID_PRICE;
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

  const quantityError = validateQuantity(line.quantity);
  if (quantityError) errors.quantity = quantityError;

  const unitPriceError = validateUnitPrice(line.unitPrice);
  if (unitPriceError) errors.unitPrice = unitPriceError;

  const discountError = validateDiscount(line.discount, line.quantity, line.unitPrice);
  if (discountError) errors.discount = discountError;

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

  // Date validation
  const dateError = validateQuoteDate(formData.date);
  if (dateError) errors.date = dateError;

  // Validity date validation
  const validityError = validateValidityDate(formData.validityDate, formData.date);
  if (validityError) errors.validityDate = validityError;

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

  // Validate lines
  if (!quote.lines || quote.lines.length === 0) {
    errors.lines = ERROR_MESSAGES.AT_LEAST_ONE_LINE;
  } else {
    quote.lines.forEach((line, index) => {
      const lineErrors = validateQuoteLine(line);
      if (Object.keys(lineErrors).length > 0) {
        errors[`line_${index}`] = lineErrors;
      }
    });
  }

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
      return validateQuantity(value);
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
    date: sanitizeText(quote.date),
    validityDate: sanitizeText(quote.validityDate),
    orderDate: sanitizeText(quote.orderDate),
    requestedDeliveryDate: sanitizeText(quote.requestedDeliveryDate),
    notes: sanitizeText(quote.notes),
    lines: quote.lines.map(line => ({
      ...line,
      description: sanitizeText(line.description),
      quantity: sanitizeNumber(line.quantity),
      unitPrice: sanitizeNumber(line.unitPrice),
      discount: sanitizeNumber(line.discount)
    }))
  };
}
