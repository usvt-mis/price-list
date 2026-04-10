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

test('send approval preview calculates commission from standard labor and materials pricing', async ({ page }) => {
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
    await approvals.openApprovalPreviewModal('SQTEST-0001', {
      source: 'current',
      eyebrow: 'Send Approval Preview',
      title: 'Send Approval Preview',
      quoteData: {
        number: 'SQTEST-0001',
        customerName: 'ACME Industries',
        sellToCustomerName: 'ACME Industries',
        customerNumber: 'C0001',
        sellToCustomerNo: 'C0001',
        branch: 'URY',
        branchCode: 'URY',
        orderDate: '2026-04-09',
        amountExcludingTax: 1300,
        totalTaxAmount: 91,
        totalAmount: 1391,
        salesQuoteLines: [
          {
            lineType: 'Item',
            lineObjectNumber: '1900-S',
            description: 'Service Item - Labor',
            quantity: 1,
            unitPrice: 300,
            amountExcludingTax: 300,
            usvtServiceItemNo: 'SER0001'
          },
          {
            lineType: 'Item',
            lineObjectNumber: 'MAT-001',
            description: 'Copper wire',
            quantity: 2,
            unitPrice: 500,
            amountExcludingTax: 1000
          }
        ]
      },
      approval: {
        salesQuoteNumber: 'SQTEST-0001',
        approvalStatus: 'SubmittedToBC',
        customerName: 'ACME Industries',
        salespersonName: 'Sales Demo',
        salespersonEmail: 'sales@example.com',
        workDescription: 'Workshop overhaul',
        totalAmount: 1391,
        submittedForApprovalAt: '2026-04-09T09:00:00.000Z',
        updatedAt: '2026-04-09T09:00:00.000Z'
      }
    });
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
