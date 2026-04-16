import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const CREATE_QUOTE_NUMBER = 'SQRY2604-0201';
const EDIT_QUOTE_NUMBER = 'SQRY2604-0202';

const PAYMENT_TERMS = [
  {
    Code: '30D',
    DisplayName: '30 Days',
    DueDateCalculation: '30D',
    DiscountPercent: 0
  },
  {
    Code: '45D',
    DisplayName: '45 Days',
    DueDateCalculation: '45D',
    DiscountPercent: 0
  },
  {
    Code: '60D',
    DisplayName: '60 Days',
    DueDateCalculation: '60D',
    DiscountPercent: 0
  }
];

async function mockCommonRoutes(page) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clientPrincipal: {
          userDetails: 'sales@example.com',
          userRoles: ['Sales'],
          branchId: 1
        },
        effectiveRole: 'Sales'
      })
    });
  });

  await page.route('**/api/branches', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          BranchId: 1,
          BranchCode: 'URY',
          BranchName: 'Ayutthaya',
          CostPerHour: 100,
          OnsiteCostPerHour: 150,
          OverheadPercent: 10,
          PolicyProfit: 20
        }
      ])
    });
  });

  await page.route('**/api/salesquotes/preferences/quote-line-columns', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ value: [] })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });

  await page.route('**/api/business-central/payment-terms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PAYMENT_TERMS)
    });
  });

  await page.route('**/api/business-central/gateway/sales-quotes/smart-dropdown?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ suggestions: [] })
    });
  });

  await page.route('**/api/business-central/customers/search?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          CustomerNo: 'C0001',
          CustomerName: 'ACME Industries',
          PaymentTermsCode: '30D',
          Address: '99 Test Road',
          Address2: '',
          City: 'Rayong',
          PostCode: '21000',
          VATRegistrationNo: '1234567890123',
          TaxBranchNo: '00000'
        }
      ])
    });
  });

  await page.route('**/api/business-central/customers/C0001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        CustomerNo: 'C0001',
        CustomerName: 'ACME Industries',
        PaymentTermsCode: '30D',
        Address: '99 Test Road',
        Address2: '',
        City: 'Rayong',
        PostCode: '21000',
        VATRegistrationNo: '1234567890123',
        TaxBranchNo: '00000'
      })
    });
  });

  await page.route('**/api/business-central/salespeople/search?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          SalespersonCode: 'SP001',
          SalespersonName: 'Sales Demo'
        }
      ])
    });
  });

  await page.route('**/api/salesquotes/records', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });

  await page.route('**/api/salesquotes/audit-events', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });

  await page.route('**/api/business-central/gateway/create-service-order-from-sq', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        result: {
          serviceOrderNo: 'SVRY2604-0001'
        }
      })
    });
  });
}

async function openSalesQuotes(page) {
  await page.goto(`${BASE_URL}/salesquotes.html`);
  await page.waitForFunction(() => Boolean((window as Window & { SalesQuotesApp?: unknown }).SalesQuotesApp));
}

test('payment terms dropdown auto-fills from customer and create payload uses edited value', async ({ page }) => {
  await mockCommonRoutes(page);

  let createPayload: Record<string, unknown> | null = null;
  await page.route('**/api/business-central/gateway/create-sales-quote-without-number', async (route) => {
    createPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        result: {
          number: CREATE_QUOTE_NUMBER
        }
      })
    });
  });

  await openSalesQuotes(page);

  await expect(page.locator('#paymentTermsCode option[value="30D"]')).toHaveText('30D');
  await expect(page.locator('#paymentTermsCode option[value="45D"]')).toHaveText('45D');

  await page.fill('#customerNoSearch', 'C0');
  await page.locator('#customerNoDropdown .customer-dropdown-item').first().click();
  await expect(page.locator('#paymentTermsCode')).toHaveValue('30D');

  await page.selectOption('#paymentTermsCode', '45D');
  await expect(page.locator('#paymentTermsCode')).toHaveValue('45D');

  await page.click('#sendQuoteBtn');

  await expect.poll(() => createPayload?.paymentTermsCode).toBe('45D');
  expect(createPayload?.paymentTermCode).toBe('45D');
});

test('searched quote update payload uses edited payment terms value', async ({ page }) => {
  await mockCommonRoutes(page);

  await page.route('**/api/salesquotes/approvals/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ approval: null })
    });
  });

  await page.route('**/api/business-central/gateway/sales-quotes/from-number?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'quote-payment-terms-edit',
          number: EDIT_QUOTE_NUMBER,
          paymentTermsCode: '30D',
          sellToCustomerName: 'ACME Industries',
          sellToCustomerNo: 'C0001',
          salespersonCode: 'SP001',
          assignedUserId: 'sales@example.com',
          branch: 'URY',
          branchCode: 'URY',
          locationCode: 'RY01',
          responsibilityCenter: 'URY',
          orderDate: '2026-04-09',
          requestedDeliveryDate: '2026-04-20',
          NavWordReportXmlPart: {
            Sales_Header: {
              DocNo_SaleHeader: EDIT_QUOTE_NUMBER,
              Name: 'ACME Industries',
              BilltoCustomerNo_SalesHeader: 'C0001',
              OrderDate_SaleHeader: '2026-04-09',
              RequestedDeliveryDate_SalesHeader: '2026-04-20'
            },
            Integer: []
          }
        }
      })
    });
  });

  let updatePayload: Record<string, unknown> | null = null;
  await page.route('**/api/business-central/gateway/update-sales-quote', async (route) => {
    updatePayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });

  await openSalesQuotes(page);
  await page.click('#tabSearch');
  await page.fill('#searchSalesQuoteNumber', EDIT_QUOTE_NUMBER);
  await page.click('#searchSalesQuoteBtn');

  await expect(page.locator('#quoteEditorModeTitle')).toContainText(`Editing Sales Quote ${EDIT_QUOTE_NUMBER}`);
  await expect(page.locator('#paymentTermsCode')).toHaveValue('30D');

  await page.selectOption('#paymentTermsCode', '60D');
  await page.click('#sendQuoteBtn');

  await expect.poll(() => updatePayload?.paymentTermsCode).toBe('60D');
  expect(updatePayload?.paymentTermCode).toBe('60D');
});
