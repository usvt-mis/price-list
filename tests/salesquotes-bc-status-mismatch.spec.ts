import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const QUOTE_NUMBER = 'SQRY2604-0101';

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
}

test('warns when BC status is not Open and does not match approval system status', async ({ page }) => {
  await mockCommonRoutes(page);

  await page.route('**/api/business-central/gateway/sales-quotes/from-number?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'quote-mismatch-1',
          number: QUOTE_NUMBER,
          status: 'Released',
          sellToCustomerName: 'ACME Industries',
          sellToCustomerNo: 'C0001',
          salespersonCode: 'SP001',
          assignedUserId: 'sales@example.com',
          branch: 'URY',
          branchCode: 'URY',
          locationCode: 'URY',
          responsibilityCenter: 'URY',
          orderDate: '2026-04-09',
          requestedDeliveryDate: '2026-04-20',
          amountExcludingTax: 3000,
          totalTaxAmount: 210,
          totalAmount: 3210,
          NavWordReportXmlPart: {
            Sales_Header: {
              DocNo_SaleHeader: QUOTE_NUMBER,
              Name: 'ACME Industries',
              BilltoCustomerNo_SalesHeader: 'C0001',
              OrderDate_SaleHeader: '2026-04-09',
              RequestedDeliveryDate_SalesHeader: '2026-04-20',
              responsibilityCenter: 'URY',
              salespersonCode: 'SP001',
              assignedUserId: 'sales@example.com',
              Payment_Terms_Code: '30D',
              TotalAmt1: 3000,
              TotalAmt4: 210,
              TotalAmt5: 3210
            },
            Integer: [
              {
                Type: 'Item',
                ItemNo_SaleLine: 'ITEM-001',
                Description_SaleLine: 'Mismatch status line',
                Qty_SaleLine: 1,
                Unit_Price: 3000,
                Line_Amount: 3000,
                USVT_Group_No_: '1',
                USVT_Show_in_Document: true
              }
            ]
          }
        }
      })
    });
  });

  await page.route(`**/api/salesquotes/approvals/${QUOTE_NUMBER}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        approval: {
          salesQuoteNumber: QUOTE_NUMBER,
          approvalStatus: 'SubmittedToBC',
          customerName: 'ACME Industries',
          salespersonName: 'Sales Demo',
          salespersonEmail: 'sales@example.com',
          approvalOwnerEmail: 'sales@example.com',
          workDescription: 'Quote awaiting approval request',
          totalAmount: 3210,
          submittedForApprovalAt: '2026-04-09T09:00:00.000Z',
          updatedAt: '2026-04-09T09:00:00.000Z'
        }
      })
    });
  });

  await page.goto(`${BASE_URL}/salesquotes.html`);
  await page.waitForFunction(() => Boolean((window as Window & { SalesQuotesApp?: unknown }).SalesQuotesApp));

  await page.click('#tabSearch');
  await page.fill('#searchSalesQuoteNumber', QUOTE_NUMBER);
  await page.click('#searchSalesQuoteBtn');

  const mismatchToast = page.locator('#toastContainer .toast').filter({
    hasText: 'Business Central shows "Released", but this system shows "Submitted to BC".'
  });
  await expect(mismatchToast).toContainText('Please verify before proceeding.');

  await expect(page.locator('#quoteEditorModeTitle')).toContainText(`Editing Sales Quote ${QUOTE_NUMBER}`);
  await expect(page.locator('#quoteEditorModeMeta')).toContainText('Status');
  await expect(page.locator('#quoteEditorModeMeta')).toContainText('Released');
  await expect(page.locator('#quoteEditorModeMeta')).toContainText('Approval status');
  await expect(page.locator('#quoteEditorModeMeta')).toContainText('Submitted to BC');

  const bannerAlert = page.locator('#bcStatusAlertDisplay');
  await expect(bannerAlert).toBeVisible();
  await expect(bannerAlert).toContainText('Business Central status mismatch');
  await expect(bannerAlert).toContainText('Business Central shows "Released", but this system shows "Submitted to BC".');
  await expect(bannerAlert).toContainText('Expected BC status: Open.');
  await expect(bannerAlert).toContainText('Please verify the latest status before continuing.');
});
