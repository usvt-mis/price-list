import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const QUOTE_NUMBER = 'SQRY2604-0045';

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

  await page.route('**/api/business-central/gateway/sales-quotes/smart-dropdown?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ suggestions: [] })
    });
  });

  await page.route('**/api/business-central/payment-terms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          Code: '30D',
          DisplayName: '30 Days',
          DueDateCalculation: '30D',
          DiscountPercent: 0
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
        PaymentTermsCode: '',
        Address: '99 Test Road',
        Address2: '',
        City: 'Rayong',
        PostCode: '21000',
        VatRegistrationNo: '1234567890123',
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

  await page.route(`**/api/salesquotes/approvals/${QUOTE_NUMBER}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ approval: null })
    });
  });
}

test('searched quote shows paymentTermsCode directly from BC payload without customer fallback', async ({ page }) => {
  await mockCommonRoutes(page);

  await page.route('**/api/business-central/gateway/sales-quotes/from-number?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'quote-payment-terms-1',
          number: QUOTE_NUMBER,
          paymentTermsCode: '45D',
          sellToCustomerName: 'ACME Industries',
          sellToCustomerNo: 'C0001',
          salespersonCode: 'SP001',
          assignedUserId: 'sales@example.com',
          branch: 'URY',
          branchCode: 'URY',
          locationCode: 'URY',
          responsibilityCenter: 'URY',
          NavWordReportXmlPart: {
            Sales_Header: {
              DocNo_SaleHeader: QUOTE_NUMBER,
              Name: 'ACME Industries',
              BilltoCustomerNo_SalesHeader: 'C0001',
              OrderDate_SaleHeader: '2026-04-09',
              RequestedDeliveryDate_SalesHeader: '2026-04-20',
              responsibilityCenter: 'URY',
              salespersonCode: 'SP001',
              assignedUserId: 'sales@example.com'
            },
            Integer: [
              {
                Type: 'Item',
                ItemNo_SaleLine: 'ITEM-001',
                Description_SaleLine: 'Visible line',
                Qty_SaleLine: 1,
                Unit_Price: 1000,
                Line_Amount: 1000,
                USVT_Group_No_: '1',
                USVT_Show_in_Document: true
              }
            ]
          }
        }
      })
    });
  });

  await page.goto(`${BASE_URL}/salesquotes.html`);
  await page.waitForFunction(() => Boolean((window as Window & { SalesQuotesApp?: unknown }).SalesQuotesApp));

  await page.click('#tabSearch');
  await page.fill('#searchSalesQuoteNumber', QUOTE_NUMBER);
  await page.click('#searchSalesQuoteBtn');

  await expect(page.locator('#quoteEditorModeTitle')).toContainText(`Editing Sales Quote ${QUOTE_NUMBER}`);
  await expect(page.locator('#paymentTermsCode')).toHaveValue('45D');
});
