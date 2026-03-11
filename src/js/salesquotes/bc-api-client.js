/**
 * Business Central API Client
 * Simplified version - only mock data for local development
 * Production uses local database endpoints and gateway
 */

import { MOCK_DATA, isMockEnabled, getMockCompanyId } from './config.js';

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
    // No token or config needed - always use local DB or gateway
  }

  // ============================================================
  // Mock Request Handler
  // ============================================================

  /**
   * Handle mock API requests (local development only)
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
  // Customer API Methods (Local Database in Production)
  // ============================================================

  /**
   * Get all customers
   * In production: use local database endpoint
   * In local dev: use mock data
   */
  async getCustomers() {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: getCustomers');
      return { value: MOCK_DATA.customers };
    }

    // Production: use local database
    const response = await fetch('/api/business-central/customers');
    if (!response.ok) {
      throw new BCError('Failed to fetch customers', 'FETCH_ERROR');
    }
    return await response.json();
  }

  /**
   * Search customers by query
   * Uses local database
   */
  async searchCustomers(query) {
    if (!query || query.trim().length < 2) {
      return { value: [] };
    }

    // Production: use local database search endpoint
    const response = await fetch(`/api/business-central/customers/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new BCError('Failed to search customers', 'FETCH_ERROR');
    }
    const customers = await response.json();
    return { value: customers };
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId) {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: getCustomer', customerId);
      return MOCK_DATA.customers.find(c => c.id === customerId) || null;
    }

    // Production: use local database
    const response = await fetch(`/api/business-central/customers/${encodeURIComponent(customerId)}`);
    if (!response.ok) {
      throw new BCError('Failed to fetch customer', 'FETCH_ERROR');
    }
    return await response.json();
  }

  // ============================================================
  // Item API Methods (Local Database in Production)
  // ============================================================

  /**
   * Get all items
   */
  async getItems() {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: getItems');
      return { value: MOCK_DATA.items };
    }

    // Production: use local database
    const response = await fetch('/api/business-central/items');
    if (!response.ok) {
      throw new BCError('Failed to fetch items', 'FETCH_ERROR');
    }
    return await response.json();
  }

  /**
   * Search items by query
   */
  async searchItems(query) {
    if (!query || query.trim().length < 2) {
      return { value: [] };
    }

    // Production: use local database search endpoint
    const response = await fetch(`/api/business-central/items/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new BCError('Failed to search items', 'FETCH_ERROR');
    }
    const items = await response.json();
    return { value: items };
  }

  /**
   * Get item by ID
   */
  async getItem(itemId) {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: getItem', itemId);
      return MOCK_DATA.items.find(i => i.id === itemId) || null;
    }

    // Production: use local database
    const response = await fetch(`/api/business-central/items/${encodeURIComponent(itemId)}`);
    if (!response.ok) {
      throw new BCError('Failed to fetch item', 'FETCH_ERROR');
    }
    return await response.json();
  }

  // ============================================================
  // Sales Quote API Methods (Via Gateway)
  // ============================================================

  /**
   * Create a new sales quote via gateway
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

    // Production: send to gateway endpoint
    const response = await fetch('/api/business-central/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new BCError(
        errorData.error?.message || 'Failed to create quote',
        'CREATE_FAILED',
        errorData
      );
    }

    return await response.json();
  }

  /**
   * Get sales quote by ID (via gateway)
   */
  async getQuote(quoteId) {
    if (isMockEnabled()) {
      console.log('[BC API] Mock: getQuote', quoteId);
      return MOCK_DATA.quotes.find(q => q.id === quoteId) || null;
    }

    // Production: use gateway
    const response = await fetch(`/api/business-central/quotes/${encodeURIComponent(quoteId)}`);
    if (!response.ok) {
      throw new BCError('Failed to fetch quote', 'FETCH_ERROR');
    }
    return await response.json();
  }

  /**
   * Update sales quote (via gateway)
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

    // Production: use gateway
    const response = await fetch(`/api/business-central/quotes/${encodeURIComponent(quoteId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteData)
    });

    if (!response.ok) {
      throw new BCError('Failed to update quote', 'UPDATE_ERROR');
    }

    return await response.json();
  }

  /**
   * Add line to sales quote (via gateway)
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

    // Production: use gateway
    const response = await fetch(`/api/business-central/quotes/${encodeURIComponent(quoteId)}/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lineData)
    });

    if (!response.ok) {
      throw new BCError('Failed to add quote line', 'CREATE_ERROR');
    }

    return await response.json();
  }

  // ============================================================
  // Configuration & Initialization
  // ============================================================

  /**
   * Initialize BC client (no-op - no configuration needed)
   */
  async initialize() {
    console.log('[BC API] Client initialized (local DB mode)');
    return Promise.resolve();
  }

  /**
   * Get company ID (mock only - not used in production)
   */
  getCompanyId() {
    return getMockCompanyId();
  }

  /**
   * Clear cache (no-op - no caching in this mode)
   */
  clearCache() {
    console.log('[BC API] Cache cleared (no-op)');
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
