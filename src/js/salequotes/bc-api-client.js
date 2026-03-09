/**
 * Business Central API Client
 * Handles all communication with Dynamics 365 Business Central REST API
 * Includes OAuth token management, caching, and mock data for local development
 */

import { BC_API_CONFIG, BC_API, MOCK_DATA, isMockEnabled, getMockCompanyId, BC_ERROR_MESSAGES } from './config.js';
import { fetchJson } from '../core/utils.js';

// ============================================================
// BC Error Class
// ============================================================

export class BCError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'BCError';
    this.code = code;
    this.details = details;
  }
}

// ============================================================
// Business Central Client Class
// ============================================================

export class BusinessCentralClient {
  constructor() {
    this.token = null;
    this.tokenExpiresAt = null;
    this.config = null;
  }

  // ============================================================
  // Token Management
  // ============================================================

  /**
   * Acquire OAuth token for BC API
   */
  async acquireToken(forceRefresh = false) {
    // Check mock mode first
    if (isMockEnabled()) {
      console.log('[BC API] Mock mode enabled, skipping token acquisition');
      return null;
    }

    // Check session storage for cached token
    const cachedToken = sessionStorage.getItem('bc_accessToken');
    const cachedExpiresAt = sessionStorage.getItem('bc_tokenExpiresAt');

    if (!forceRefresh && cachedToken && cachedExpiresAt) {
      const expiresAt = new Date(cachedExpiresAt);
      const now = new Date();

      // Add 5-minute buffer
      const bufferTime = new Date(expiresAt.getTime() - 5 * 60 * 1000);

      if (now < bufferTime) {
        console.log('[BC API] Using cached token');
        return cachedToken;
      }
    }

    // Request new token from backend
    try {
      console.log('[BC API] Requesting new token from backend');
      const response = await fetchJson(BC_API_CONFIG.TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh })
      });

      // Store token and config
      this.token = response.accessToken;
      this.tokenExpiresAt = response.expiresAt;
      this.config = {
        apiBaseUrl: response.apiBaseUrl,
        apiVersion: response.apiVersion,
        environment: response.environment,
        companyId: response.companyId
      };

      // Cache in session storage
      sessionStorage.setItem('bc_accessToken', this.token);
      sessionStorage.setItem('bc_tokenExpiresAt', this.tokenExpiresAt);
      BC_API_CONFIG.storeConfig(this.config);

      console.log('[BC API] Token acquired successfully');
      return this.token;

    } catch (error) {
      console.error('[BC API] Token acquisition failed:', error);
      throw new BCError(
        BC_ERROR_MESSAGES.AUTH_FAILED,
        'AUTH_FAILED',
        error.message
      );
    }
  }

  /**
   * Get company ID (uses config or mock ID)
   */
  getCompanyId() {
    if (isMockEnabled()) {
      return getMockCompanyId();
    }
    return BC_API_CONFIG.getCompanyId();
  }

  // ============================================================
  // API Request Helper
  // ============================================================

  /**
   * Make authenticated request to BC API
   */
  async apiRequest(endpoint, options = {}) {
    // Mock mode handler
    if (isMockEnabled()) {
      return this.mockRequest(endpoint, options);
    }

    // Ensure we have a valid token
    const token = await this.acquireToken();
    if (!token) {
      throw new BCError(
        BC_ERROR_MESSAGES.AUTH_FAILED,
        'NO_TOKEN'
      );
    }

    // Build full URL
    const apiBaseUrl = BC_API_CONFIG.getApiBaseUrl();
    const url = `${apiBaseUrl}${endpoint}`;

    // Add auth header
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    try {
      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new BCError(
          errorData.error?.message || BC_ERROR_MESSAGES.UNKNOWN_ERROR,
          response.status,
          errorData
        );
      }

      return await response.json();

    } catch (error) {
      if (error instanceof BCError) {
        throw error;
      }

      // Network error
      throw new BCError(
        BC_ERROR_MESSAGES.NETWORK_ERROR,
        'NETWORK_ERROR',
        error.message
      );
    }
  }

  // ============================================================
  // Customer API Methods
  // ============================================================

  /**
   * Get all customers
   */
  async getCustomers() {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: getCustomers');
      return { value: MOCK_DATA.customers };
    }

    const companyId = this.getCompanyId();
    const endpoint = BC_API.CUSTOMERS(companyId);
    return this.apiRequest(endpoint);
  }

  /**
   * Search customers by query
   */
  async searchCustomers(query) {
    if (!query || query.trim().length < 2) {
      return { value: [] };
    }

    if (isMockEnabled()) {
      console.log('[BC API] Mock: searchCustomers', query);
      const filtered = MOCK_DATA.customers.filter(c =>
        c.number.toLowerCase().includes(query.toLowerCase()) ||
        c.name.toLowerCase().includes(query.toLowerCase())
      );
      return { value: filtered };
    }

    const companyId = this.getCompanyId();
    const endpoint = BC_API.SEARCH_CUSTOMERS(companyId, encodeURIComponent(query));
    return this.apiRequest(endpoint);
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId) {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: getCustomer', customerId);
      return MOCK_DATA.customers.find(c => c.id === customerId) || null;
    }

    const companyId = this.getCompanyId();
    const endpoint = BC_API.CUSTOMER_BY_ID(companyId, customerId);
    return this.apiRequest(endpoint);
  }

  // ============================================================
  // Item API Methods
  // ============================================================

  /**
   * Get all items
   */
  async getItems() {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: getItems');
      return { value: MOCK_DATA.items };
    }

    const companyId = this.getCompanyId();
    const endpoint = BC_API.ITEMS(companyId);
    return this.apiRequest(endpoint);
  }

  /**
   * Search items by query
   */
  async searchItems(query) {
    if (!query || query.trim().length < 2) {
      return { value: [] };
    }

    if (isMockEnabled()) {
      console.log('[BC API] Mock: searchItems', query);
      const filtered = MOCK_DATA.items.filter(i =>
        i.number.toLowerCase().includes(query.toLowerCase()) ||
        i.description.toLowerCase().includes(query.toLowerCase())
      );
      return { value: filtered };
    }

    const companyId = this.getCompanyId();
    const endpoint = BC_API.SEARCH_ITEMS(companyId, encodeURIComponent(query));
    return this.apiRequest(endpoint);
  }

  /**
   * Get item by ID
   */
  async getItem(itemId) {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: getItem', itemId);
      return MOCK_DATA.items.find(i => i.id === itemId) || null;
    }

    const companyId = this.getCompanyId();
    const endpoint = BC_API.ITEM_BY_ID(companyId, itemId);
    return this.apiRequest(endpoint);
  }

  // ============================================================
  // Sales Quote API Methods
  // ============================================================

  /**
   * Create a new sales quote
   */
  async createQuote(quoteData) {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: createQuote', quoteData);
      // Generate mock quote
      const mockQuote = {
        id: `quote-${Date.now()}`,
        number: `SQ-${Math.floor(10000 + Math.random() * 90000)}`,
        ...quoteData,
        createdDate: new Date().toISOString()
      };
      return mockQuote;
    }

    const companyId = this.getCompanyId();
    const endpoint = BC_API.SALES_QUOTES(companyId);

    return this.apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(quoteData)
    });
  }

  /**
   * Get sales quote by ID
   */
  async getQuote(quoteId) {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: getQuote', quoteId);
      return MOCK_DATA.quotes.find(q => q.id === quoteId) || null;
    }

    const companyId = this.getCompanyId();
    const endpoint = BC_API.SALES_QUOTE_BY_ID(companyId, quoteId);
    return this.apiRequest(endpoint);
  }

  /**
   * Update sales quote
   */
  async updateQuote(quoteId, quoteData) {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: updateQuote', quoteId, quoteData);
      const quote = MOCK_DATA.quotes.find(q => q.id === quoteId);
      if (quote) {
        Object.assign(quote, quoteData);
        return quote;
      }
      return null;
    }

    const companyId = this.getCompanyId();
    const endpoint = BC_API.SALES_QUOTE_BY_ID(companyId, quoteId);

    return this.apiRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(quoteData)
    });
  }

  /**
   * Add line to sales quote
   */
  async addQuoteLine(quoteId, lineData) {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: addQuoteLine', quoteId, lineData);
      const quote = MOCK_DATA.quotes.find(q => q.id === quoteId);
      if (quote) {
        const newLine = {
          sequence: quote.lines.length + 1,
          ...lineData
        };
        quote.lines.push(newLine);
        return newLine;
      }
      return null;
    }

    const companyId = this.getCompanyId();
    const endpoint = BC_API.SALES_QUOTE_LINES(companyId, quoteId);

    return this.apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(lineData)
    });
  }

  // ============================================================
  // Mock Request Handler
  // ============================================================

  /**
   * Handle mock API requests
   */
  async mockRequest(endpoint, options) {
    console.log('[BC API] Mock request:', endpoint, options);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Parse endpoint to determine mock response
    if (endpoint.includes('/customers')) {
      return { value: MOCK_DATA.customers };
    }

    if (endpoint.includes('/items')) {
      return { value: MOCK_DATA.items };
    }

    if (endpoint.includes('/salesQuotes') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      return {
        id: `quote-${Date.now()}`,
        number: `SQ-${Math.floor(10000 + Math.random() * 90000)}`,
        ...body
      };
    }

    throw new BCError(
      'Mock endpoint not implemented',
      'NOT_IMPLEMENTED',
      { endpoint }
    );
  }

  // ============================================================
  // Configuration
  // ============================================================

  /**
   * Initialize BC client configuration
   */
  async initialize() {
    try {
      // Get BC config from backend
      const response = await fetchJson(BC_API_CONFIG.CONFIG);
      this.config = response;
      BC_API_CONFIG.storeConfig(response);
      console.log('[BC API] Configuration loaded:', response);
      return response;
    } catch (error) {
      console.error('[BC API] Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * Clear cached tokens and config
   */
  clearCache() {
    this.token = null;
    this.tokenExpiresAt = null;
    this.config = null;
    BC_API_CONFIG.clearConfig();
    console.log('[BC API] Cache cleared');
  }
}

// ============================================================
// Global BC Client Instance
// ============================================================

export const bcClient = new BusinessCentralClient();

// Auto-initialize on load
if (typeof window !== 'undefined') {
  bcClient.initialize().catch(error => {
    console.error('[BC API] Initialization failed:', error);
  });
}
