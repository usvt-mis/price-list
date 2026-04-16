import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const QUOTE_NUMBER = 'SQRY2604-0099';

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

test('approved searched quote still allows header and footer toggles for print layout', async ({ page }) => {
  await mockCommonRoutes(page);

  await page.route('**/api/business-central/gateway/sales-quotes/from-number?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'quote-approved-1',
          number: QUOTE_NUMBER,
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
                Description_SaleLine: 'Visible line',
                Qty_SaleLine: 1,
                Unit_Price: 1000,
                Line_Amount: 1000,
                USVT_Group_No_: '1',
                USVT_Show_in_Document: true,
                USVT_Header: true,
                USVT_Footer: true
              },
              {
                Type: 'Item',
                ItemNo_SaleLine: 'ITEM-002',
                Description_SaleLine: 'Hidden line for print',
                Qty_SaleLine: 1,
                Unit_Price: 2000,
                Line_Amount: 2000,
                USVT_Group_No_: '1',
                USVT_Show_in_Document: false,
                USVT_Header: false,
                USVT_Footer: false
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
          approvalStatus: 'Approved',
          customerName: 'ACME Industries',
          salespersonName: 'Sales Demo',
          salespersonEmail: 'sales@example.com',
          approvalOwnerEmail: 'sales@example.com',
          workDescription: 'Approved quote for print layout test',
          totalAmount: 3210,
          submittedForApprovalAt: '2026-04-09T09:00:00.000Z',
          salesDirectorActionAt: '2026-04-09T10:00:00.000Z',
          updatedAt: '2026-04-09T10:00:00.000Z'
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
  await expect(page.locator('#quoteEditorModeMeta')).toContainText('Approval status');
  await expect(page.locator('#quoteEditorModeMeta')).toContainText('Approved');
  await expect(page.locator('#quoteEditorModeMeta')).toContainText('BC Sync');
  await expect(page.locator('#quoteEditorModeMeta')).toContainText('Synced');

  const rows = page.locator('#linesTableBody tr');
  await expect(rows).toHaveCount(2);

  const firstRow = rows.nth(0);
  const secondRow = rows.nth(1);

  const firstHeaderToggle = firstRow.locator('input[aria-label="printHeader"]');
  const firstFooterToggle = firstRow.locator('input[aria-label="printFooter"]');
  const secondShowToggle = secondRow.locator('input[aria-label="showInDocument"]');
  const secondHeaderToggle = secondRow.locator('input[aria-label="printHeader"]');
  const secondFooterToggle = secondRow.locator('input[aria-label="printFooter"]');

  await expect(secondShowToggle).toBeDisabled();
  await expect(secondHeaderToggle).toBeEnabled();
  await expect(secondFooterToggle).toBeEnabled();
  await expect(firstHeaderToggle).toBeChecked();
  await expect(firstFooterToggle).toBeChecked();
  await expect(secondHeaderToggle).not.toBeChecked();
  await expect(secondFooterToggle).not.toBeChecked();

  await secondHeaderToggle.evaluate((input: HTMLInputElement) => input.click());
  await expect(secondHeaderToggle).toBeChecked();
  await expect(firstHeaderToggle).not.toBeChecked();
  await expect(secondShowToggle).toBeChecked();
  await expect(page.locator('#quoteEditorModeMeta')).toContainText('Synced');
  await expect(page.locator('#quoteEditorModeMeta')).not.toContainText('Unsynced changes');

  await secondFooterToggle.evaluate((input: HTMLInputElement) => input.click());
  await expect(secondFooterToggle).toBeChecked();
  await expect(firstFooterToggle).not.toBeChecked();

  const editorState = await page.evaluate(async () => {
    const { state } = await import('/js/salesquotes/state.js');
    return {
      lineOne: {
        showInDocument: state.quote.lines[0]?.showInDocument,
        printHeader: state.quote.lines[0]?.printHeader,
        printFooter: state.quote.lines[0]?.printFooter
      },
      lineTwo: {
        showInDocument: state.quote.lines[1]?.showInDocument,
        printHeader: state.quote.lines[1]?.printHeader,
        printFooter: state.quote.lines[1]?.printFooter
      },
      hasUnsyncedChanges: state.ui.quoteSync.hasUnsyncedChanges
    };
  });

  expect(editorState.lineOne.printHeader).toBe(false);
  expect(editorState.lineOne.printFooter).toBe(false);
  expect(editorState.lineTwo.showInDocument).toBe(true);
  expect(editorState.lineTwo.printHeader).toBe(true);
  expect(editorState.lineTwo.printFooter).toBe(true);
  expect(editorState.hasUnsyncedChanges).toBe(false);
});
