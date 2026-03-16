/**
 * Business Central Configuration
 * BC-specific constants and configuration for Sales Quotes module
 */

import { isLocalDev } from '../core/config.js';

// ============================================================
// BC API Configuration
// ============================================================

export const GATEWAY_API = {
  CREATE_SALES_QUOTE_WITHOUT_NUMBER: '/api/business-central/gateway/create-sales-quote-without-number',
  CREATE_SERVICE_ITEM: '/api/business-central/gateway/create-service-item',
  CREATE_SERVICE_ORDER_FROM_SQ: '/api/business-central/gateway/create-service-order-from-sq',
  GET_SALES_QUOTES_FROM_NUMBER: '/api/business-central/gateway/sales-quotes/from-number',
  UPDATE_SALES_QUOTE: '/api/business-central/gateway/update-sales-quote'
};

export const BC_API_CONFIG = {
  // Config endpoint (backend)
  CONFIG: '/api/business-central/config',

  // Base API URL (returned by token endpoint)
  getApiBaseUrl: () => {
    // Will be populated from /api/business-central/config
    return sessionStorage.getItem('bc_apiBaseUrl') || 'https://api.businesscentral.dynamics.com/v2.0/';
  },

  // API version
  getApiVersion: () => {
    return sessionStorage.getItem('bc_apiVersion') || 'v2.20';
  },

  // Environment
  getEnvironment: () => {
    return sessionStorage.getItem('bc_environment') || 'Production';
  },

  // Company ID
  getCompanyId: () => {
    return sessionStorage.getItem('bc_companyId') || '';
  },

  // Store BC configuration from backend
  storeConfig: (config) => {
    if (config.apiBaseUrl) sessionStorage.setItem('bc_apiBaseUrl', config.apiBaseUrl);
    if (config.apiVersion) sessionStorage.setItem('bc_apiVersion', config.apiVersion);
    if (config.environment) sessionStorage.setItem('bc_environment', config.environment);
    if (config.companyId) sessionStorage.setItem('bc_companyId', config.companyId);
  },

  // Clear stored configuration
  clearConfig: () => {
    sessionStorage.removeItem('bc_apiBaseUrl');
    sessionStorage.removeItem('bc_apiVersion');
    sessionStorage.removeItem('bc_environment');
    sessionStorage.removeItem('bc_companyId');
    sessionStorage.removeItem('bc_accessToken');
    sessionStorage.removeItem('bc_tokenExpiresAt');
  }
};

// ============================================================
// BC API Endpoints
// ============================================================

export const BC_API = {
  // Company endpoint
  COMPANY: (companyId) => `/api/v2.0/${BC_API_CONFIG.getEnvironment()}/companies(${companyId})`,

  // Customers
  CUSTOMERS: (companyId) => `/api/v2.0/${BC_API_CONFIG.getEnvironment()}/companies(${companyId})/customers`,
  CUSTOMER_BY_ID: (companyId, customerId) => `/api/v2.0/${BC_API_CONFIG.getEnvironment()}/companies(${companyId})/customers(${customerId})`,
  SEARCH_CUSTOMERS: (companyId, query) => `/api/v2.0/${BC_API_CONFIG.getEnvironment()}/companies(${companyId})/customers?$filter=contains(number,'${query}') or contains(name,'${query}')`,

  // Items
  ITEMS: (companyId) => `/api/v2.0/${BC_API_CONFIG.getEnvironment()}/companies(${companyId})/items`,
  ITEM_BY_ID: (companyId, itemId) => `/api/v2.0/${BC_API_CONFIG.getEnvironment()}/companies(${companyId})/items(${itemId})`,
  SEARCH_ITEMS: (companyId, query) => `/api/v2.0/${BC_API_CONFIG.getEnvironment()}/companies(${companyId})/items?$filter=contains(number,'${query}') or contains(description,'${query}')`,

  // Sales Quotes
  SALES_QUOTES: (companyId) => `/api/v2.0/${BC_API_CONFIG.getEnvironment()}/companies(${companyId})/salesQuotes`,
  SALES_QUOTE_BY_ID: (companyId, quoteId) => `/api/v2.0/${BC_API_CONFIG.getEnvironment()}/companies(${companyId})/salesQuotes(${quoteId})`,
  SALES_QUOTE_LINES: (companyId, quoteId) => `/api/v2.0/${BC_API_CONFIG.getEnvironment()}/companies(${companyId})/salesQuotes(${quoteId})/salesQuoteLines`
};

// ============================================================
// Mock Data Configuration (Local Development)
// ============================================================

export const MOCK_DATA = {
  enabled: isLocalDev,

  // Mock customers
  customers: [
    { id: 'cust-001', number: 'C10000', name: 'Acme Corporation', address: '123 Main St, Bangkok', phone: '02-123-4567', email: 'contact@acme.com' },
    { id: 'cust-002', number: 'C10001', name: 'Global Tech Solutions', address: '456 Tech Park, Bangkok', phone: '02-234-5678', email: 'sales@globaltech.com' },
    { id: 'cust-003', number: 'C10002', name: 'Siam Industries', address: '789 Industrial Estate, Samut Prakan', phone: '02-345-6789', email: 'info@siamind.com' },
    { id: 'cust-004', number: 'C10003', name: 'Thai Manufacturing Co.', address: '321 Factory Rd, Chonburi', phone: '038-123-456', email: 'admin@thaimanuf.co.th' }
  ],

  // Mock items
  items: [
    { id: 'item-001', number: '1900-S', description: 'Service Item - Labor', unitPrice: 1500, itemType: 'Service' },
    { id: 'item-002', number: '1900-M', description: 'Service Item - Materials', unitPrice: 500, itemType: 'Service' },
    { id: 'item-003', number: '1900-T', description: 'Service Item - Travel', unitPrice: 800, itemType: 'Service' },
    { id: 'item-004', number: 'MAT-001', description: 'Raw Material - Steel Plate', unitPrice: 250, itemType: 'Inventory' },
    { id: 'item-005', number: 'MAT-002', description: 'Raw Material - Aluminum Sheet', unitPrice: 350, itemType: 'Inventory' },
    { id: 'item-006', number: 'SRV-001', description: 'Consulting Service', unitPrice: 2000, itemType: 'Service' }
  ],

  // Mock sales quotes
  quotes: [
    {
      id: 'quote-001',
      number: 'SQ-10123',
      customerId: 'cust-001',
      customerName: 'Acme Corporation',
      date: '2026-03-09',
      validity: '2026-04-08',
      lines: [
        { sequence: 1, itemId: 'item-001', description: 'Service Item - Labor', quantity: 10, unitPrice: 1500, discount: 0 },
        { sequence: 2, itemId: 'item-002', description: 'Service Item - Materials', quantity: 5, unitPrice: 500, discount: 0 }
      ]
    }
  ]
};

// ============================================================
// BC UI Configuration
// ============================================================

export const BC_UI_CONFIG = {
  // Microsoft Blue theme colors
  colors: {
    primary: '#0078d4',      // Microsoft Blue
    primaryHover: '#106ebe',
    primaryLight: '#c7e0f4',
    secondary: '#6c757d',
    success: '#107c10',      // Microsoft Green
    warning: '#ffb900',
    danger: '#d13438',       // Microsoft Red
    border: '#d1d1d1',
    background: '#f3f2f1',
    text: '#323130',
    textLight: '#605e5c'
  },

  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px'
  },

  // Border radius
  borderRadius: {
    sm: '2px',
    md: '4px',
    lg: '6px'
  },

  // Typography
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px'
  },

  // Shadows
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    md: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
    lg: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)'
  }
};

// ============================================================
// BC Error Messages
// ============================================================

export const BC_ERROR_MESSAGES = {
  AUTH_FAILED: 'Authentication with Business Central failed. Please try again.',
  NETWORK_ERROR: 'Unable to connect to Business Central. Please check your internet connection.',
  NOT_FOUND: 'The requested resource was not found in Business Central.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  TOKEN_EXPIRED: 'Your session has expired. Please refresh the page.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action in Business Central.',
  NOT_CONFIGURED: 'Business Central integration is not configured. Using local database instead.'
};

// ============================================================
// BC Status Constants
// ============================================================

export const BC_QUOTE_STATUS = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  RELEASED: 'Released',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected'
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get BC-specific headers for API requests
 */
export function getBcApiHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Add auth token from session storage
  const token = sessionStorage.getItem('bc_accessToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Check if mock mode is enabled
 * Mock mode is enabled for local development (localhost)
 */
export function isMockEnabled() {
  return MOCK_DATA.enabled;
}

/**
 * Get mock company ID for local development
 */
export function getMockCompanyId() {
  return '00000000-0000-0000-0000-000000000000';
}
