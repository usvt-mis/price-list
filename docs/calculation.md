# Calculation Documentation

**Parent Documentation**: This guide is part of the CLAUDE.md documentation.
See [CLAUDE.md](../CLAUDE.md) for project overview and navigation.

---

## Overview

The calculator computes total cost based on four components:
1. **Labor**: Job manhours × branch-specific cost per hour
2. **Materials**: User-selected materials with quantities
3. **Sales Profit**: User-editable percentage applied after branch multipliers (can be negative for discounts)
4. **Travel/Shipping**: Distance in Km multiplied by 15 baht/km rate

**Note**: Branch defaults (OverheadPercent and PolicyProfit) are applied silently in the calculation and are not user-editable.

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

---

## Material Calculations

### Per-Line Calculations

**Raw Cost** (Executive mode only):
```
Raw_Cost = UnitCost × Quantity
```

**Cost After Branch Multiplier** (Executive mode only):
```
Cost_Before_Sales_Profit = unitCost × qty × BranchMultiplier
```

**Final Price** (with commission):
```
Final_Price = Line_Total × (1 + commissionPercent / 100)
```

Where `Line_Total` = `UnitCost × Quantity × CompleteMultiplier`

### Materials Subtotal
```
Materials Subtotal = sum of all Final Prices
```

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
Sub Total Cost = Labor (raw) + Materials (raw) + Travel (raw)
```
- WITHOUT any multipliers applied
- Displayed in Executive mode only

### Sub Grand Total (SGT)
```
Sub Grand Total = Labor (with multipliers) + Materials (with multipliers) + Travel (with SalesProfitMultiplier)
```
- Used for commission calculation
- Displayed in BOTH Executive and Sales modes

### Grand Total
```
Grand Total = sum of all Final Prices (labor + materials + travel)
```
- Includes commission
- Displayed prominently at bottom

---

## Commission Calculation

### Overview
Commission is calculated based on the ratio of Sub Grand Total (SGT) to Sub Total Cost (STC).

### Commission Percentage

| SGT vs STC Condition | Commission% |
|---------------------|-------------|
| SGT < 80% of STC | 0% |
| 80% ≤ SGT < 100% of STC | 1% |
| 100% ≤ SGT ≤ 105% of STC | 2% |
| 105% < SGT ≤ 120% of STC | 2.5% |
| SGT > 120% of STC | 5% |

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
- Shows cost WITHOUT any multipliers
- Formula: `Raw_Cost = UnitCost × Quantity`
- Executive mode only
- Displayed in both desktop table column and mobile card

#### Cost+Ovh+PP Column
- Shows cost after Branch Multiplier but before Sales Profit
- Formula: `Cost_Before_Sales_Profit = unitCost × qty × BranchMultiplier`
- Executive mode only
- When Sales Profit % = 0: equals Final Price (before commission)
- When Sales Profit % > 0: shows lower value than Final Price

#### Final Price Column
- Shows price including commission
- Formula: `Final_Price = Line_Total × (1 + commissionPercent / 100)`
- Displayed in both desktop table column and mobile card
- Updates in real-time when commission percentage changes

---

## Helper Functions (`src/index.html`, lines ~206-239)

- `getBranchMultiplier()` - Returns `(1 + OverheadPercent/100) × (1 + PolicyProfit/100)`
- `getSalesProfitMultiplier()` - Returns `(1 + SalesProfit%/100)`
- `getTravelCost()` - Returns `Km × 15`
- `getCompleteMultiplier()` - Returns branch multiplier × sales profit multiplier

---

## Event Listeners

- Sales Profit % changes trigger `renderLabor()`, `renderMaterials()`, and `calcAll()` for real-time updates
- Travel Km changes trigger `calcAll()` (line ~690)
- Any change affecting SGT or STC triggers commission recalculation
