import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080';
const MANUAL_OTHER_JOB_CODE = 'SQ-OTHER';
const MANUAL_OTHER_JOB_NAME = 'อื่นๆ';

async function mockSalesQuotesShell(page) {
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

  await page.route('**/api/motor-types', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          MotorTypeId: 1,
          MotorTypeName: '0 - 10 kW AC'
        }
      ])
    });
  });

  await page.route('**/api/app-settings/motor-job-defaults', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ value: { uncheckedPrefixes: [] } })
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
}

async function loadConfirmNewSerLaborHarness(page) {
  await page.goto(`${BASE_URL}/salesquotes.html`);
  await page.waitForFunction(() => Boolean((window as Window & { SalesQuotesApp?: unknown }).SalesQuotesApp));

  await page.evaluate(async () => {
    const modalLoader = await import('/js/salesquotes/components/modal-loader.js');
    const globalState = await import('/js/state.js');
    const labor = await import('/js/salesquotes/service-item-labor.js');

    globalState.authState.user = {
      branchId: 1,
      email: 'sales@example.com',
      effectiveRole: 'Sales',
      roles: ['Sales']
    };

    await modalLoader.loadModal('confirmNewSerModal');
    document.getElementById('confirmNewSerModal')?.classList.remove('hidden');
    const modalContent = document.getElementById('confirmNewSerModalContent');
    if (modalContent) {
      modalContent.style.opacity = '1';
      modalContent.style.transform = 'translateY(0)';
    }
    const branchField = document.getElementById('branch') as HTMLInputElement | null;
    if (branchField) {
      branchField.value = 'URY';
    }
    labor.initConfirmNewSerLaborUi();
  });
}

test('Sales Quotes workshop joblist adds manual Other as unchecked and requires manhours only when selected', async ({ page }) => {
  const workshopLaborRequests: string[] = [];
  let savedPayload: Record<string, unknown> | null = null;

  await mockSalesQuotesShell(page);

  await page.route('**/api/workshop/labor?**', async (route) => {
    workshopLaborRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { JobId: 1, JobCode: 'J001', JobName: 'Overhaul', SortOrder: 10, ManHours: 2 },
        { JobId: 999, JobCode: MANUAL_OTHER_JOB_CODE, JobName: MANUAL_OTHER_JOB_NAME, SortOrder: 999, ManHours: 0 }
      ])
    });
  });

  await page.route('**/api/salesquotes/service-item-labor/SER-OTHER', async (route) => {
    if (route.request().method() === 'PUT') {
      savedPayload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'ok', profile: savedPayload })
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not found' })
    });
  });

  await loadConfirmNewSerLaborHarness(page);

  await page.evaluate(async () => {
    const labor = await import('/js/salesquotes/service-item-labor.js');
    await labor.syncConfirmNewSerLaborProfile({
      repairMode: 'Workshop',
      workType: 'Motor',
      serviceType: 'Overhaul',
      motorKw: '7.5',
      motorIsDc: false
    }, { forceReload: true });
  });

  expect(workshopLaborRequests.some((url) => new URL(url).searchParams.get('includeManualOther') === 'true')).toBe(true);

  const manualRow = page.locator('#confirmNewSerLaborRows tr', { hasText: MANUAL_OTHER_JOB_NAME });
  await expect(manualRow).toBeVisible();
  await expect(manualRow.locator('input[type="checkbox"]')).not.toBeChecked();
  await expect(manualRow.locator('input[type="number"]')).toBeDisabled();

  await manualRow.locator('input[type="checkbox"]').check();
  await expect(manualRow.locator('input[type="number"]')).toBeEnabled();

  const missingValidation = await page.evaluate(async () => {
    const labor = await import('/js/salesquotes/service-item-labor.js');
    return labor.getConfirmNewSerLaborValidation({
      repairMode: 'Workshop',
      workType: 'Motor',
      serviceType: 'Overhaul',
      motorKw: '7.5',
      motorIsDc: false
    })?.message || null;
  });
  expect(missingValidation).toBe('Please enter manhours greater than 0 for the checked Other job.');

  await manualRow.locator('input[type="number"]').fill('1.25');

  const validationAfterManhours = await page.evaluate(async () => {
    const labor = await import('/js/salesquotes/service-item-labor.js');
    return labor.getConfirmNewSerLaborValidation({
      repairMode: 'Workshop',
      workType: 'Motor',
      serviceType: 'Overhaul',
      motorKw: '7.5',
      motorIsDc: false
    })?.message || null;
  });
  expect(validationAfterManhours).toBeNull();

  await page.evaluate(async () => {
    const labor = await import('/js/salesquotes/service-item-labor.js');
    const snapshot = {
      repairMode: 'Workshop',
      workType: 'Motor',
      serviceType: 'Overhaul',
      motorKw: '7.5',
      motorIsDc: false
    };
    await labor.saveConfirmNewSerLaborProfile('SER-OTHER', snapshot, {
      description: 'Motor AC 7.5 kW',
      customerNo: 'C0001',
      groupNo: '1',
      jobs: labor.getConfirmNewSerLaborJobsSnapshot()
    });
  });

  const savedJobs = Array.isArray(savedPayload?.jobs) ? savedPayload.jobs as Array<Record<string, unknown>> : [];
  const savedManualJob = savedJobs.find((job) => job.jobCode === MANUAL_OTHER_JOB_CODE);
  expect(savedManualJob).toMatchObject({
    jobCode: MANUAL_OTHER_JOB_CODE,
    jobName: MANUAL_OTHER_JOB_NAME,
    isChecked: true,
    effectiveManHours: 1.25
  });
});

test('Sales Quotes onsite joblist adds manual Other as unchecked and validates selected manhours', async ({ page }) => {
  const onsiteLaborRequests: string[] = [];

  await mockSalesQuotesShell(page);

  await page.route('**/api/onsite/labor?**', async (route) => {
    onsiteLaborRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { JobId: 2, JobCode: 'O001', JobName: 'Onsite inspection', SortOrder: 10, ManHours: 0 },
        { JobId: 999, JobCode: MANUAL_OTHER_JOB_CODE, JobName: MANUAL_OTHER_JOB_NAME, SortOrder: 999, ManHours: 0 }
      ])
    });
  });

  await loadConfirmNewSerLaborHarness(page);

  await page.evaluate(async () => {
    const labor = await import('/js/salesquotes/service-item-labor.js');
    await labor.syncConfirmNewSerLaborProfile({
      repairMode: 'Onsite',
      workType: 'Motor',
      serviceType: 'Overhaul',
      motorKw: '7.5',
      motorIsDc: false
    }, { forceReload: true });
  });

  expect(onsiteLaborRequests.some((url) => new URL(url).searchParams.get('includeManualOther') === 'true')).toBe(true);

  const manualRow = page.locator('#confirmNewSerLaborRows tr', { hasText: MANUAL_OTHER_JOB_NAME });
  await expect(manualRow).toBeVisible();
  await expect(manualRow.locator('input[type="checkbox"]')).not.toBeChecked();
  await expect(manualRow.locator('input[type="number"]')).toBeDisabled();

  const normalRow = page.locator('#confirmNewSerLaborRows tr', { hasText: 'Onsite inspection' });
  await normalRow.locator('input[type="number"]').fill('2');
  await manualRow.locator('input[type="checkbox"]').check();

  const missingValidation = await page.evaluate(async () => {
    const labor = await import('/js/salesquotes/service-item-labor.js');
    return labor.getConfirmNewSerLaborValidation({
      repairMode: 'Onsite',
      workType: 'Motor',
      serviceType: 'Overhaul',
      motorKw: '7.5',
      motorIsDc: false
    })?.message || null;
  });
  expect(missingValidation).toBe('Onsite requires manhours greater than 0 for every checked job.');

  await manualRow.locator('input[type="number"]').fill('0.75');

  const validationAfterManhours = await page.evaluate(async () => {
    const labor = await import('/js/salesquotes/service-item-labor.js');
    return labor.getConfirmNewSerLaborValidation({
      repairMode: 'Onsite',
      workType: 'Motor',
      serviceType: 'Overhaul',
      motorKw: '7.5',
      motorIsDc: false
    })?.message || null;
  });
  expect(validationAfterManhours).toBeNull();
});

test('approval preview includes checked manual Other manhours in standard labor pricing', async ({ page }) => {
  await mockSalesQuotesShell(page);

  await page.route('**/api/salesquotes/service-item-labor/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          serviceItemNo: 'SER-OTHER',
          repairMode: 'Workshop',
          serviceItemDescription: 'Motor overhaul with other work',
          branchId: 1,
          workType: 'Motor',
          serviceType: 'Overhaul',
          motorKw: 7.5,
          motorDriveType: 'AC',
          jobs: [
            { jobCode: 'J001', jobName: 'Overhaul', effectiveManHours: 2, isChecked: true },
            { jobCode: MANUAL_OTHER_JOB_CODE, jobName: MANUAL_OTHER_JOB_NAME, effectiveManHours: 1.5, isChecked: true }
          ]
        }
      })
    });
  });

  await page.route('**/api/materials/lookup?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.goto(`${BASE_URL}/salesquotes.html`);
  await page.waitForFunction(() => Boolean((window as Window & { SalesQuotesApp?: unknown }).SalesQuotesApp));

  await page.evaluate(async () => {
    const approvals = await import('/js/salesquotes/approvals.js');
    await approvals.openApprovalPreviewModal('SQOTHER-0001', {
      source: 'current',
      eyebrow: 'Send Approval Preview',
      title: 'Send Approval Preview',
      quoteData: {
        number: 'SQOTHER-0001',
        customerName: 'ACME Industries',
        sellToCustomerName: 'ACME Industries',
        customerNumber: 'C0001',
        sellToCustomerNo: 'C0001',
        branch: 'URY',
        branchCode: 'URY',
        orderDate: '2026-04-17',
        amountExcludingTax: 500,
        totalTaxAmount: 35,
        totalAmount: 535,
        salesQuoteLines: [
          {
            lineType: 'Item',
            lineObjectNumber: '1900-S',
            description: 'Service Item - Labor',
            quantity: 1,
            unitPrice: 500,
            amountExcludingTax: 500,
            usvtServiceItemNo: 'SER-OTHER'
          }
        ]
      },
      approval: {
        salesQuoteNumber: 'SQOTHER-0001',
        approvalStatus: 'SubmittedToBC',
        customerName: 'ACME Industries',
        salespersonName: 'Sales Demo',
        salespersonEmail: 'sales@example.com',
        workDescription: 'Workshop overhaul',
        totalAmount: 535,
        submittedForApprovalAt: '2026-04-17T09:00:00.000Z',
        updatedAt: '2026-04-17T09:00:00.000Z'
      }
    });
  });

  await expect(page.locator('#approvalPreviewModal')).toBeVisible();
  await expect(page.locator('#approvalPreviewContent')).toContainText('Standard Labor');
  await expect(page.locator('#approvalPreviewContent')).toContainText('462.00');
});
