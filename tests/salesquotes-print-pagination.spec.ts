import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const QUOTE_NUMBER = 'SQRY2603-0103';

function buildPaginationQuoteLines() {
  const descriptions = [
    'Service Charge for',
    'Overhaul Canned Pump 6 Unit TA 2026',
    ...Array(5).fill('Overhaul Teikoku Canned Pump Tag. P-7504-1 (14.5kW.)'),
    'Scope of work :',
    ...Array.from({ length: 12 }, (_, index) => String(index + 1)),
    'Overhaul Teikoku Canned Pump Tag. P-7504-1 (14.5kW.)',
    ...Array.from({ length: 14 }, (_, index) => String(index + 1)),
    'Note :',
    'Commercial Terms :',
    ...Array.from({ length: 9 }, (_, index) => String(index + 1))
  ];

  return descriptions.map((description, index) => ({
    Type: 'Item',
    ItemNo_SaleLine: index === 0 ? 'SERVICE' : '',
    Description_SaleLine: description,
    Qty_SaleLine: index === 0 || index === 20 ? 1 : 0,
    Unit_of_Measure: index === 0 || index === 20 ? 'Ea.' : '',
    Unit_Price: index === 0 ? 27500 : index === 20 ? 52000 : 0,
    Line_Amount: index === 0 ? 27500 : index === 20 ? 52000 : 0,
    USVT_Group_No_: '1',
    USVT_Show_in_Document: true,
    USVT_Header: false,
    USVT_Footer: false
  }));
}

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
          BranchName: 'Rayong',
          CostPerHour: 100,
          OnsiteCostPerHour: 150,
          OverheadPercent: 10,
          PolicyProfit: 20
        }
      ])
    });
  });

  await page.route('**/api/business-central/payment-terms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ Code: '30D', DisplayName: '30 Days' }])
    });
  });

  await page.route('**/api/salesquotes/preferences/quote-line-columns', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(route.request().method() === 'GET' ? { value: [] } : { success: true })
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

test('searched quote print pagination keeps short rows on earlier pages', async ({ page }) => {
  await mockCommonRoutes(page);

  const consoleLines: string[] = [];
  page.on('console', (message) => {
    consoleLines.push(message.text());
  });

  await page.route('**/api/business-central/gateway/sales-quotes/from-number?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'quote-pagination-1',
          number: QUOTE_NUMBER,
          sellToCustomerName: 'ACME Industries',
          sellToCustomerNo: 'C0001',
          salespersonCode: 'SP001',
          assignedUserId: 'sales@example.com',
          branch: 'URY',
          branchCode: 'URY',
          locationCode: 'RY01',
          responsibilityCenter: 'URY',
          orderDate: '2026-03-10',
          requestedDeliveryDate: '2026-03-20',
          amountExcludingTax: 79500,
          totalTaxAmount: 5565,
          totalAmount: 85065,
          NavWordReportXmlPart: {
            Sales_Header: {
              DocNo_SaleHeader: QUOTE_NUMBER,
              Name: 'ACME Industries',
              BilltoCustomerNo_SalesHeader: 'C0001',
              OrderDate_SaleHeader: '2026-03-10',
              RequestedDeliveryDate_SalesHeader: '2026-03-20',
              responsibilityCenter: 'URY',
              salespersonCode: 'SP001',
              assignedUserId: 'sales@example.com',
              Payment_Terms_Code: '30D',
              TotalAmt1: 79500,
              TotalAmt4: 5565,
              TotalAmt5: 85065
            },
            Integer: buildPaginationQuoteLines()
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
          approvalStatus: 'PendingApproval'
        }
      })
    });
  });

  await page.route('**/api/salesquotes/salesperson-signatures/SP001', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Not found' })
    });
  });

  await page.route('**/api/salesdirector-signature', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ signatureData: null })
    });
  });

  await page.route('**/api/salesquotes/print-layout-settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ value: {} })
    });
  });

  await page.goto(`${BASE_URL}/salesquotes.html`);
  await page.waitForFunction(() => Boolean((window as Window & { SalesQuotesApp?: unknown }).SalesQuotesApp));

  await page.click('#tabSearch');
  await page.fill('#searchSalesQuoteNumber', QUOTE_NUMBER);
  await page.click('#searchSalesQuoteBtn');

  await expect(page.locator('#quoteEditorModeTitle')).toContainText(`Editing Sales Quote ${QUOTE_NUMBER}`);

  const editorState = await page.evaluate(async () => {
    const { state } = await import('/js/salesquotes/state.js');
    return {
      number: state.quote.number,
      lineCount: state.quote.lines.length,
      printableCount: state.quote.lines.filter(line => line.showInDocument !== false).length
    };
  });

  expect(editorState).toEqual({
    number: QUOTE_NUMBER,
    lineCount: 46,
    printableCount: 46
  });

  const popupPromise = page.waitForEvent('popup');
  await page.click('#printQuoteBtn');
  const popup = await popupPromise;
  await popup.evaluate(() => {
    window.print = () => {
      (window as Window & { __printCalled?: boolean }).__printCalled = true;
    };
  });
  await popup.waitForSelector('.page');
  await popup.waitForTimeout(500);

  const metrics = await popup.evaluate(() => {
    const mmPerPx = 25.4 / 96;
    const pxToMm = (px: number) => px * mmPerPx;
    const pages = [...document.querySelectorAll('.page')];

    return {
      pageCount: pages.length,
      totalRows: pages.reduce((sum, page) => sum + page.querySelectorAll('.line-table tbody tr').length, 0),
      pages: pages.map((printPage) => {
        const pageRect = printPage.getBoundingClientRect();
        const rows = [...printPage.querySelectorAll('.line-table tbody tr')];
        const lastRowRect = rows.at(-1)?.getBoundingClientRect();
        const footerRect = printPage.querySelector('.footer-stack')?.getBoundingClientRect();
        const footerDividerRect = printPage.querySelector('.footer-divider')?.getBoundingClientRect();

        return {
          rowCount: rows.length,
          gapLastRowToFooterDividerMm: Number(pxToMm((footerDividerRect && lastRowRect) ? footerDividerRect.top - lastRowRect.bottom : 0).toFixed(2)),
          footerBottomMm: Number(pxToMm(footerRect ? footerRect.bottom - pageRect.top : 0).toFixed(2)),
          pageHeightMm: Number(pxToMm(pageRect.height).toFixed(2))
        };
      })
    };
  });

  expect(metrics.totalRows).toBe(46);
  expect(metrics.pageCount).toBe(3);
  expect(metrics.pages.map(printPage => printPage.rowCount)).toEqual([16, 19, 11]);
  expect(metrics.pages.every(printPage => printPage.gapLastRowToFooterDividerMm >= 0)).toBe(true);
  expect(metrics.pages.every(printPage => printPage.footerBottomMm <= printPage.pageHeightMm)).toBe(true);
  expect(consoleLines.some(line => line.includes('[Chunk Debug]') || line.includes('[Multi-Page Debug]'))).toBe(false);
});
