# Calculation Documentation

**Parent Documentation**: This guide is part of the CLAUDE.md documentation.
See [CLAUDE.md](../CLAUDE.md) for project overview and navigation.

---

## Overview

The calculator computes total cost based on four components:
1. **Labor**: Job manhours × branch-specific cost per hour (with branch multipliers and sales profit)
2. **Materials**: User-selected materials with quantities (**using tiered pricing** - no branch/sales profit multipliers)
3. **Sales Profit**: User-editable percentage applied after branch multipliers for Labor only (can be negative for discounts)
4. **Travel/Shipping**: Distance in Km multiplied by 15 baht/km rate (with sales profit only)

**Important Notes**:
- Branch defaults (OverheadPercent and PolicyProfit) are applied silently to Labor only
- Materials use **tiered pricing** instead of branch multipliers (see Material Calculations section)
- Travel and Onsite Options have sales profit multiplier but NO branch multipliers

---

## Multipliers

### Branch Multiplier
```
BranchMultiplier = (1 + OverheadPercent/100) × (1 + PolicyProfit/100)
```
- From branch defaults
- Applied silently (not user-editable)

### Sales Profit Multiplier
```
SalesProfitMultiplier = (1 + SalesProfit%/100)
```
- User input
- Can be negative for discounts

### Complete Multiplier
```
CompleteMultiplier = BranchMultiplier × SalesProfitMultiplier
```

---

## Labor Calculations

### Per-Job Calculations

**Raw Cost** (Executive mode only):
```
Raw_Cost = CostPerHour × effectiveManHours
```

**Cost After Branch Multiplier** (Executive mode only):
```
Cost_Before_Sales_Profit = effectiveManHours × CostPerHour × BranchMultiplier
```

**Final Price** (with commission):
```
Final_Price = Selling_Price × (1 + commissionPercent / 100)
```

Where `Selling_Price` = `effectiveManHours × CostPerHour × CompleteMultiplier`

### Labor Subtotal
```
Labor Subtotal = sum of all Final Prices (for checked jobs only)
```

**Important**: Only jobs with `isChecked !== false` are included in labor calculations. Unchecked jobs are excluded from:
- Labor Subtotal
- Grand Total
- Commission calculations
- All database-stored GrandTotal values (calculated in backend `calculateGrandTotal` function)

---

## Material Calculations

### Per-Line Calculations

**IMPORTANT**: Materials use **tiered pricing** instead of branch multipliers. Per user decision, Materials skip Overhead, Policy Profit, AND Sales Profit multipliers. Only commission is applied.

**Raw Cost** (Executive mode only):
```
Raw_Cost = UnitCost × Quantity
```

**Tiered Base Price (F)**:
The tier is determined by UnitCost alone, then multiplied by Quantity:
```
if (UnitCost < 50)       PricePerUnit = 250
else if (UnitCost < 100) PricePerUnit = 400
else if (UnitCost < 200) PricePerUnit = 800
else if (UnitCost < 300) PricePerUnit = 1000
else if (UnitCost < 600) PricePerUnit = 1500
else if (UnitCost < 1000) PricePerUnit = 2000
else                     PricePerUnit = UnitCost × 2
```

**Final Price** (with commission):
```
Final_Price = PricePerUnit × Quantity × (1 + commissionPercent / 100)
```

**Manual Override**:
- Users can manually override the Final Price for individual material lines
- When `overrideFinalPrice` is set, it bypasses ALL calculations (tiered pricing, commission)
- Overridden rows display with amber styling (`border-amber-300`, `bg-amber-50`)
- Reset button (↺) clears the override and reverts to calculated price
- Quantity changes automatically clear the override
- Validation: >= 0, max 999999.99, 2 decimal places

### Materials Subtotal
```
Materials Subtotal = sum of all Final Prices (or override values if set)
```

**Note on Commission Calculation**:
- Overridden material rows are **excluded** from the commission tier calculation base (`materialSubtotalBase()`)
- This prevents circular dependencies since override prices already include all calculations
- Only non-overridden materials contribute to the Sub Total Cost (STC) used for commission ratio

**Important Changes**:
- **Cost+Ovh+PP column is hidden** for Materials (not applicable with tiered pricing)
- Branch multipliers (Overhead%, PolicyProfit%) are **NOT** applied to Materials
- Sales Profit multiplier is **NOT** applied to Materials
- Only commission is applied to the tiered base price

---

## Travel Calculations

### Base Cost
```
Travel_Cost = Km × 15
```

### Travel Final Price (with all multipliers and commission)
```
Travel_Final_Price = Km × 15 × SalesProfitMultiplier × (1 + commissionPercent / 100)
```

---

## Grand Total Calculations

### Sub Total Cost (STC)
```
Sub Total Cost = Labor (raw) + Materials (tiered base F) + Travel (raw) + Onsite Options (raw)
```
- Labor: WITHOUT any multipliers (raw manhours × CostPerHour)
- Materials: Tiered base price (F) WITHOUT commission
- Travel: Km × 15 (base rate)
- Onsite Options: Sum of option prices (base)
- Displayed in Executive mode only

### Sub Grand Total (SGT)
```
Sub Grand Total = Labor (with multipliers) + Materials (tiered base F) + Travel (with SalesProfitMultiplier) + Onsite Options (with SalesProfitMultiplier)
```
- Labor: With branch multipliers AND sales profit multiplier
- Materials: **Tiered base price (F) only** - no branch multipliers, no sales profit
- Travel: With sales profit multiplier only (no branch multipliers)
- Onsite Options: With sales profit multiplier only (no branch multipliers)
- Used for commission calculation
- Displayed in BOTH Executive and Sales modes

### Grand Total
```
Grand Total = Labor Final Prices + Materials Final Prices + Travel Final Price + Onsite Options Final Price
```
- Labor: With all multipliers AND commission
- Materials: **Tiered base price × (1 + commission%)** - no other multipliers
- Travel: Base × sales profit multiplier × (1 + commission%)
- Onsite Options: Base × sales profit multiplier × (1 + commission%)
- Includes commission
- Displayed prominently at bottom

---

## Commission Calculation

### Overview
Commission is calculated based on the ratio of Sub Grand Total (SGT) to Sub Total Cost (STC).

### Commission Percentage

| SGT vs STC Ratio | Commission% |
|------------------|-------------|
| 0 ≤ ratio < 0.8 (80%) | 0% |
| 0.8 (80%) ≤ ratio < 1.0 (100%) | 1% |
| 1.0 (100%) ≤ ratio < 1.05 (105%) | 2% |
| 1.05 (105%) ≤ ratio < 1.20 (120%) | 2.5% |
| ratio ≥ 1.20 (120%) | 5% |

**Note**: Tier boundaries use inclusive lower bound and exclusive upper bound. For example, exactly 80% (0.8) ratio earns 1% commission, not 0%.

### Commission Value
```
Commission = Commission% × Sub Grand Total
```

### Implementation
- Calculation performed in `calcAll()` function (lines ~820-850)
- Commission percent stored globally (`commissionPercent`) for use in render functions
- Updates in real-time whenever any value affecting SGT or STC changes
- Visually separated with border and emerald color (`text-emerald-400`)

---

## Column Calculations

### Labor Table Columns

#### Raw Cost Column
- Shows cost WITHOUT any multipliers
- Formula: `Raw_Cost = CostPerHour × effectiveManHours`
- Executive mode only
- Right-aligned with strikethrough for unchecked jobs

#### Cost+Ovh+PP Column
- Shows cost after Branch Multiplier but before Sales Profit
- Formula: `Cost_Before_Sales_Profit = effectiveManHours × CostPerHour × BranchMultiplier`
- Equivalent to: `Final_Selling_Price / SalesProfitMultiplier`
- Executive mode only
- When Sales Profit % = 0: equals Final Selling Price
- When Sales Profit % > 0: shows lower value than Final Price
- When Sales Profit % < 0: shows higher value than Final Price

#### Final Price Column
- Shows price including commission
- Formula: `Final_Price = Selling_Price × (1 + commissionPercent / 100)`
- Right-aligned with strikethrough for unchecked jobs
- Updates in real-time when commission percentage changes

### Materials Table Columns

#### Raw Cost Column
- Shows cost WITHOUT any multipliers (UnitCost × Quantity)
- Formula: `Raw_Cost = UnitCost × Quantity`
- Executive mode only
- Displayed in both desktop table column and mobile card

#### Cost+Ovh+PP Column
- **HIDDEN** for Materials - not applicable with tiered pricing
- Materials use tiered pricing formula instead of branch multipliers

#### Final Price Column
- **Editable input field** - Users can manually override the calculated Final Price
- Default formula: `Final_Price = F × (1 + commissionPercent / 100)` where F is the tiered base price
- When manual override is set:
  - Amber styling (`border-amber-300`, `bg-amber-50`) indicates override is active
  - Reset button (↺) appears to clear override
  - Override bypasses ALL calculations (tiered pricing, commission)
- Displayed in both desktop table column and mobile card
- Updates in real-time when commission percentage changes
- Quantity changes clear the override and recalculate

---

## Percentage Breakdown Calculations (Executive Only)

### Overview
The Percentage Breakdown panel displays each cost component as a percentage of the Grand Total. This helps Executives understand the composition of the total price at a glance.

### Percentage Formulas

All percentages are calculated as **% of Grand Total**:

```
Labor % = (Labor Final Prices Sum / Grand Total) × 100
```

```
Materials % = (Materials Final Prices Sum / Grand Total) × 100
```

**Note**: Materials percentage shows tiered prices (without commission), not raw costs.

```
Ovh+PP % = (Overhead / Grand Total) × 100
```

**Note**: Overhead is calculated from Labor only (Materials do not use branch multipliers).

```
Commission % = (Commission Amount / Grand Total) × 100
```

```
Gross Profit % = (Gross Profit / Grand Total) × 100
```

Where:
- **Gross Profit** = Sub Grand Total - Total Raw Cost = Total markup from branch multipliers + sales profit + tiered materials pricing
- Should always be positive when branch multipliers and/or tiered pricing are applied

### Edge Cases
- **Zero Grand Total**: All percentages show "0.00%" (handled via `Number.isFinite()` check)
- **Formatting**: Uses `fmtPercent(value)` helper for 2 decimal places with "%" suffix

### Implementation
- Calculation performed in `calcAll()` function (`src/js/calculator/calculations.js`)
- Visibility controlled by `isExecutiveMode()` check (hidden in Sales mode)
- Card uses `hidden` class by default, removed only in Executive mode
- Element IDs: `laborPercent`, `materialsPercent`, `overheadPercent`, `commissionPercentOfTotal`, `grossProfitPercent`

---

## Helper Functions (`src/js/utils.js`)

- `fmt(value)` - Format number with locale string (2 decimal places)
- `fmtPercent(value)` - Format number as percentage with 2 decimal places (e.g., "25.50%")
- `el(id)` - Get DOM element by ID
- `formatDate(dateStr)` - Format date for display
- `extractInitials(emailOrName)` - Extract initials from email/name
- `setStatus(msg)` - Set status message
- `setDbLoadingModal(show)` - Show/hide database loading modal
- `showNotification(message)` - Show notification message
- `showView(viewName, isNoRoleState)` - Navigate between views

### Helper Functions (`src/index.html`, lines ~206-239)

- `getBranchMultiplier()` - Returns `(1 + OverheadPercent/100) × (1 + PolicyProfit/100)`
- `getSalesProfitMultiplier()` - Returns `(1 + SalesProfit%/100)`
- `getTravelCost()` - Returns `Km × 15`
- `getCompleteMultiplier()` - Returns branch multiplier × sales profit multiplier

---

## Event Listeners

- Sales Profit % changes trigger `renderLabor()`, `renderMaterials()`, and `calcAll()` for real-time updates
- Travel Km changes trigger `calcAll()` (line ~690)
- Any change affecting SGT or STC triggers commission recalculation
