import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const COMMISSION_ESTIMATE_NOTE = '* ตัวเลขนี้เป็นเพียงการประเมินคร่าวๆ  ยังไม่ใช่ตัวเลขที่แท้จริง';

async function expectCommissionNoteLayout(page) {
  await expect(page.locator('#approvalPreviewContent')).toContainText(COMMISSION_ESTIMATE_NOTE);
  await expect(page.locator('.approval-preview-summary-strip .approval-preview-commission-estimate-note')).toHaveCount(0);

  const pricingSummary = page.locator('.approval-preview-collapsible', {
    has: page.locator('summary', { hasText: 'Pricing Summary' })
  });
  await pricingSummary.evaluate((details) => {
    if (details instanceof HTMLDetailsElement) {
      details.open = true;
    }
  });

  await expect(page.locator('.approval-preview-actual-selling-price-group .approval-preview-commission-estimate-note')).toBeVisible();

  const summaryLayout = await page.locator('.approval-preview-summary-strip').evaluate((strip) => {
    const itemRects = Array.from(strip.querySelectorAll('.approval-preview-summary-item'))
      .map((item) => item.getBoundingClientRect());

    return {
      itemCount: itemRects.length,
      firstTop: itemRects[0]?.top ?? 0,
      lastTop: itemRects[itemRects.length - 1]?.top ?? 0
    };
  });

  expect(summaryLayout.itemCount).toBe(6);
  expect(Math.abs(summaryLayout.firstTop - summaryLayout.lastTop)).toBeLessThan(2);
}

test('sales director approval preview calculates commission from remote BC preview data', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clientPrincipal: {
          userDetails: 'director@example.com',
          userRoles: ['SalesDirector'],
          branchId: 1
        },
        effectiveRole: 'SalesDirector'
      })
    });
  });

  await page.route('**/api/salesquotes/approvals/list/pending', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ approvals: [] })
    });
  });

  await page.route('**/api/salesquotes/approvals/list/my-requests', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ approvals: [] })
    });
  });

  await page.route('**/api/salesquotes/approvals/SQRY2604-0001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        approval: {
          salesQuoteNumber: 'SQRY2604-0001',
          approvalStatus: 'PendingApproval',
          customerName: 'ACME Industries',
          salespersonName: 'Sales Demo',
          salespersonEmail: 'sales@example.com',
          salesDirectorName: 'Director Demo',
          workDescription: 'Workshop overhaul',
          totalAmount: 1391,
          submittedForApprovalAt: '2026-04-09T09:00:00.000Z',
          updatedAt: '2026-04-09T09:00:00.000Z'
        }
      })
    });
  });

  await page.route('**/api/business-central/gateway/sales-quotes/from-number?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          number: 'SQRY2604-0001',
          sellToCustomerName: 'ACME Industries',
          sellToCustomerNo: 'C0001',
          branch: 'URY',
          branchCode: 'URY',
          orderDate: '2026-04-09',
          amountExcludingTax: 1300,
          totalTaxAmount: 91,
          totalAmount: 1391,
          NavWordReportXmlPart: {
            Sales_Header: {
              DocNo_SaleHeader: 'SQRY2604-0001',
              Name: 'ACME Industries',
              responsibilityCenter: 'URY',
              OrderDate_SaleHeader: '2026-04-09',
              TotalAmt1: 1300,
              TotalAmt4: 91,
              TotalAmt5: 1391
            },
            Integer: [
              {
                Type: 'Item',
                ItemNo_SaleLine: '1900-S',
                Description_SaleLine: 'Service Item - Labor',
                Qty_SaleLine: 1,
                Unit_Price: 300,
                Line_Amount: 300,
                USVT_Group_No_: '1',
                USVT_Service_Item_No_: 'SER0001',
                USVT_Show_in_Document: 'true'
              },
              {
                Type: 'Item',
                ItemNo_SaleLine: 'MAT-001',
                Description_SaleLine: 'Copper wire',
                Qty_SaleLine: 2,
                Unit_Price: 500,
                Line_Amount: 1000,
                USVT_Group_No_: '1',
                USVT_Show_in_Document: 'true'
              }
            ]
          }
        }
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

  await page.route('**/api/salesquotes/service-item-labor/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          serviceItemNo: 'SER0001',
          repairMode: 'Workshop',
          serviceItemDescription: 'Motor overhaul',
          branchId: 1,
          workType: 'Motor',
          serviceType: 'Overhaul',
          motorKw: 7.5,
          motorDriveType: 'AC',
          jobs: [
            { jobCode: 'J001', jobName: 'Strip & inspect', effectiveManHours: 2, isChecked: true },
            { jobCode: 'J002', jobName: 'Assemble', effectiveManHours: 1, isChecked: true }
          ]
        }
      })
    });
  });

  await page.route('**/api/materials/lookup?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          MaterialId: 1,
          MaterialCode: 'MAT-001',
          MaterialName: 'Copper wire',
          UnitCost: 80
        }
      ])
    });
  });

  await page.goto(`${BASE_URL}/salesquotes.html`);
  await page.waitForFunction(() => Boolean((window as Window & { SalesQuotesApp?: unknown }).SalesQuotesApp));

  await page.evaluate(async () => {
    const approvals = await import('/js/salesquotes/approvals.js');
    await approvals.openApprovalPreviewModal('SQRY2604-0001');
  });

  await expect(page.locator('#approvalPreviewModal')).toBeVisible();
  await expect(page.locator('.approval-preview-collapsible summary', { hasText: 'Pricing Summary' })).toBeVisible();
  await expect(page.locator('#approvalPreviewContent')).toContainText('Actual Selling Price');
  await expect(page.locator('#approvalPreviewContent')).toContainText('1,300.00');
  await expect(page.locator('#approvalPreviewContent')).toContainText('Standard Price');
  await expect(page.locator('#approvalPreviewContent')).toContainText('1,196.00');
  await expect(page.locator('#approvalPreviewContent')).toContainText('Standard Labor');
  await expect(page.locator('#approvalPreviewContent')).toContainText('396.00');
  await expect(page.locator('#approvalPreviewContent')).toContainText('Standard Materials');
  await expect(page.locator('#approvalPreviewContent')).toContainText('800.00');
  await expect(page.locator('#approvalPreviewContent')).toContainText('Commission %');
  await expect(page.locator('#approvalPreviewContent')).toContainText('2.50%');
  await expect(page.locator('#approvalPreviewContent')).toContainText('Commission Amount');
  await expect(page.locator('#approvalPreviewContent')).toContainText('29.90');
  await expectCommissionNoteLayout(page);
});

test('sales director approval preview derives VAT when BC preview omits precomputed totals', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clientPrincipal: {
          userDetails: 'director@example.com',
          userRoles: ['SalesDirector'],
          branchId: 1
        },
        effectiveRole: 'SalesDirector'
      })
    });
  });

  await page.route('**/api/salesquotes/approvals/list/pending', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ approvals: [] })
    });
  });

  await page.route('**/api/salesquotes/approvals/list/my-requests', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ approvals: [] })
    });
  });

  await page.route('**/api/salesquotes/approvals/SQRY2604-0002', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        approval: {
          salesQuoteNumber: 'SQRY2604-0002',
          approvalStatus: 'PendingApproval',
          customerName: 'ACME Industries',
          salespersonName: 'Sales Demo',
          salespersonEmail: 'sales@example.com',
          salesDirectorName: 'Director Demo',
          workDescription: 'Workshop overhaul',
          totalAmount: 1391,
          submittedForApprovalAt: '2026-04-09T09:00:00.000Z',
          updatedAt: '2026-04-09T09:00:00.000Z'
        }
      })
    });
  });

  await page.route('**/api/business-central/gateway/sales-quotes/from-number?**', async (route) => {
    const url = route.request().url();
    if (!url.includes('SQRY2604-0002')) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          number: 'SQRY2604-0002',
          sellToCustomerName: 'ACME Industries',
          sellToCustomerNo: 'C0001',
          branch: 'URY',
          branchCode: 'URY',
          orderDate: '2026-04-09',
          NavWordReportXmlPart: {
            Sales_Header: {
              DocNo_SaleHeader: 'SQRY2604-0002',
              Name: 'ACME Industries',
              responsibilityCenter: 'URY',
              OrderDate_SaleHeader: '2026-04-09',
              VATText: 'VAT 7%'
            },
            Integer: [
              {
                Type: 'Item',
                ItemNo_SaleLine: '1900-S',
                Description_SaleLine: 'Service Item - Labor',
                Qty_SaleLine: 1,
                Unit_Price: 300,
                Line_Amount: 300,
                USVT_Group_No_: '1',
                USVT_Service_Item_No_: 'SER0001',
                USVT_Show_in_Document: 'true'
              },
              {
                Type: 'Item',
                ItemNo_SaleLine: 'MAT-001',
                Description_SaleLine: 'Copper wire',
                Qty_SaleLine: 2,
                Unit_Price: 500,
                Line_Amount: 1000,
                USVT_Group_No_: '1',
                USVT_Show_in_Document: 'true'
              }
            ]
          }
        }
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

  await page.route('**/api/salesquotes/service-item-labor/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          serviceItemNo: 'SER0001',
          repairMode: 'Workshop',
          serviceItemDescription: 'Motor overhaul',
          branchId: 1,
          workType: 'Motor',
          serviceType: 'Overhaul',
          motorKw: 7.5,
          motorDriveType: 'AC',
          jobs: [
            { jobCode: 'J001', jobName: 'Strip & inspect', effectiveManHours: 2, isChecked: true },
            { jobCode: 'J002', jobName: 'Assemble', effectiveManHours: 1, isChecked: true }
          ]
        }
      })
    });
  });

  await page.route('**/api/materials/lookup?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          MaterialId: 1,
          MaterialCode: 'MAT-001',
          MaterialName: 'Copper wire',
          UnitCost: 80
        }
      ])
    });
  });

  await page.goto(`${BASE_URL}/salesquotes.html`);
  await page.waitForFunction(() => Boolean((window as Window & { SalesQuotesApp?: unknown }).SalesQuotesApp));

  await page.evaluate(async () => {
    const approvals = await import('/js/salesquotes/approvals.js');
    await approvals.openApprovalPreviewModal('SQRY2604-0002');
  });

  await expect(page.locator('#approvalPreviewModal')).toBeVisible();
  await expect(page.locator('#approvalPreviewContent')).toContainText('Total');
  await expect(page.locator('#approvalPreviewContent')).toContainText('1,391.00');
  await expect(page.locator('#approvalPreviewContent')).toContainText('VAT');
  await expect(page.locator('#approvalPreviewContent')).toContainText('91.00');
  await expect(page.locator('#approvalPreviewContent')).toContainText('Net Amount');
  await expect(page.locator('#approvalPreviewContent')).toContainText('1,300.00');
});
