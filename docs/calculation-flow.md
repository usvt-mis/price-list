# Calculation Flow Documentation

**Parent Documentation**: This guide is part of the CLAUDE.md documentation.
See [CLAUDE.md](../CLAUDE.md) for project overview and navigation.

---

## Overview

The Price List Calculator has two types of calculators:

| Calculator | Purpose | Key Features | Run Number Format |
|------------|---------|--------------|-------------------|
| **Onsite** | Field/onsite service calculations | Onsite Options (Crane, 4 People, Safety), Scope, Priority Level, Site Access | `ONS-YYYY-XXX` |
| **Workshop** | Workshop/facility-based service calculations | Simplified layout (Labor, Materials, Travel) | `WKS-YYYY-XXX` |

Both calculators share the same core calculation logic for Labor, Materials, and Travel. The Onsite calculator has an additional **Onsite Options** section that is not present in the Workshop calculator.

---

## Calculation Flow Architecture

The calculation system follows a sequential flow from user input to final output:

```
User Input
    ↓
Base Cost Calculation
    ↓
Apply Branch Multiplier (Labor only)
    ↓
Apply Sales Profit (Labor, Travel, Onsite Options)
    ↓
Calculate Commission
    ↓
Final Output (Grand Total)
```

### Key Multipliers

```
Branch Multiplier = (1 + OverheadPercent/100) × (1 + PolicyProfit/100)
Sales Profit Multiplier = (1 + SalesProfit%/100)
Complete Multiplier = Branch Multiplier × Sales Profit Multiplier
```

---

## Section Calculation Flows (Onsite Calculator)

### A. Labor Section

**Input Flow:**
```
Select Motor Type → Load Jobs → Input Manhours
```

**Calculation Flow:**

```
INPUT: User selects Motor Type and Branch
  ↓
Load Jobs based on Motor Type
  ↓
INPUT: User enters Manhours for each Job
  ↓
Base Cost = Manhours × CostPerHour
  ↓
Apply Branch Multiplier: (1 + Overhead%) × (1 + PolicyProfit%)
  ↓
Apply Sales Profit (Percentage Mode OR Flat Amount Mode)
  ↓
Apply Commission (based on SGT/SSP ratio)
  ↓
OUTPUT: Final Labor Cost
```

**Sales Profit Modes:**

1. **Percentage Mode** (default):
   ```
   Labor Cost = Manhours × CostPerHour × BranchMultiplier × SalesProfitMultiplier
   ```

2. **Flat Amount Mode**:
   ```
   For each checked job:
     Job_Raw_Cost = CostPerHour × effectiveManHours
     Total_Selected_Raw_Cost = sum of all Job_Raw_Cost for checked jobs
     Job_Share = Job_Raw_Cost / Total_Selected_Raw_Cost
     Job_Flat_Amount = Flat_Amount × Job_Share
     Job_Cost_After_Branch = Job_Raw_Cost × BranchMultiplier
     Final_Price = (Job_Cost_After_Branch + Job_Flat_Amount) × (1 + commissionPercent / 100)
   ```

**Note:** Only jobs with `isChecked !== false` are included in calculations.

---

### B. Materials Section

**Input Flow:**
```
Search Materials → Select Material → Input Quantity
```

**Calculation Flow:**

```
INPUT: User searches and selects Materials
  ↓
INPUT: User enters Quantity for each Material
  ↓
Base Cost = UnitCost × Quantity
  ↓
Apply Tiered Pricing Formula:
  - UnitCost < 50:       PricePerUnit = 250
  - 50 ≤ UnitCost < 100: PricePerUnit = 400
  - 100 ≤ UnitCost < 200: PricePerUnit = 800
  - 200 ≤ UnitCost < 300: PricePerUnit = 1000
  - 300 ≤ UnitCost < 600: PricePerUnit = 1500
  - 600 ≤ UnitCost < 1000: PricePerUnit = 2000
  - UnitCost ≥ 1000:     PricePerUnit = UnitCost × 2
  ↓
Apply Commission (5-tier system based on SGT/SSP ratio)
  ↓
OUTPUT: Final Material Cost
```

**Important Notes:**
- Materials **skip** Branch Multiplier (Overhead%, PolicyProfit%)
- Materials **skip** Sales Profit multiplier (both Percentage and Flat modes)
- Only Commission is applied to the tiered price
- Users can manually override Final Price per item (override bypasses all calculations)

---

### C. Travel/Shipping Section

**Input Flow:**
```
Input Distance (Km)
```

**Calculation Flow:**

```
INPUT: User enters Distance in Km
  ↓
Base Cost = Km × 15 (baht/km rate)
  ↓
Apply Sales Profit (Percentage Mode ONLY)
  ↓
Apply Commission
  ↓
OUTPUT: Final Travel Cost
```

**Sales Profit Modes:**

1. **Percentage Mode**:
   ```
   Travel Cost = Km × 15 × SalesProfitMultiplier
   ```

2. **Flat Amount Mode**:
   ```
   Travel Cost = Km × 15 (Base cost only, no Sales Profit)
   ```

**Note:** Travel cost is **never** affected by Branch Multiplier.

---

### D. Onsite Options Section (Onsite ONLY)

**Input Flow:**
```
Toggle Options (Crane, 4 People, Safety) → Input Prices
```

**Calculation Flow:**

```
INPUT: User toggles Onsite Options (Crane, 4 People, Safety)
  ↓
INPUT: User enters Price for each enabled option
  ↓
Base Cost = Sum of enabled option prices
  ↓
Apply Sales Profit (Percentage Mode ONLY)
  ↓
Apply Commission
  ↓
OUTPUT: Final Onsite Options Cost
```

**Sales Profit Modes:**

1. **Percentage Mode**:
   ```
   Onsite Options Cost = Sum(Option Prices) × SalesProfitMultiplier
   ```

2. **Flat Amount Mode**:
   ```
   Onsite Options Cost = Sum(Option Prices) (Base cost only, no Sales Profit)
   ```

**Note:** Onsite Options are **never** affected by Branch Multiplier.

---

### E. Sales Profit Section

**Input Flow:**
```
User selects Percentage Mode OR Flat Amount Mode
```

**Calculation Flow - Percentage Mode:**
```
INPUT: User enters Sales Profit Percentage
  ↓
Calculate Multiplier: (1 + SalesProfit%/100)
  ↓
Apply to Labor (after Branch Multiplier)
Apply to Travel (base cost)
Apply to Onsite Options (base cost)
  ↓
OUTPUT: Component costs with Sales Profit applied
```

**Calculation Flow - Flat Amount Mode:**
```
INPUT: User enters Sales Profit Flat Amount (Baht)
  ↓
Calculate SSP (Standard Selling Price) = Labor (after branch) + Materials (tiered base) + Travel (base) + Onsite Options (base)
  ↓
Sync Percentage: FlatAmount / SSP × 100
  ↓
Apply entire Flat Amount to Labor ONLY:
  - Distributed proportionally to each checked job based on raw cost contribution
  - Travel & Onsite Options: Keep base amount (no Sales Profit)
  ↓
OUTPUT: Labor cost includes flat amount, Travel & Onsite Options at base cost
```

**Sync Functions:**
- `syncFlatFromPercent()`: Converts percentage to flat amount based on SSP
- `syncPercentFromFlat()`: Converts flat amount to percentage based on SSP

---

### F. Commission Section

**Input Flow:**
```
Calculate SGT/SSP Ratio
```

**Calculation Flow:**

```
Calculate SGT (Sub Grand Total):
  SGT = Labor (with Sales Profit) + Materials (tiered base) + Travel (with Sales Profit) + Onsite Options (with Sales Profit)
  ↓
Calculate SSP (Standard Selling Price):
  SSP = Labor (after branch only) + Materials (tiered base only) + Travel (base) + Onsite Options (base)
  ↓
Calculate Ratio: Ratio = SGT / SSP
  ↓
Apply 5-Tier Commission System:
  - Ratio < 0.8:        0%
  - 0.8 ≤ Ratio < 1.0:   1%
  - 1.0 ≤ Ratio < 1.05:  2%
  - 1.05 ≤ Ratio < 1.20: 2.5%
  - Ratio ≥ 1.20:       5%
  ↓
Calculate Commission Value: SGT × (Commission% / 100)
  ↓
OUTPUT: Final Commission Amount
```

**Commission Tiers:**

| SGT vs SSP Ratio | Commission% |
|------------------|-------------|
| 0 ≤ ratio < 0.8 (80%) | 0% |
| 0.8 (80%) ≤ ratio < 1.0 (100%) | 1% |
| 1.0 (100%) ≤ ratio < 1.05 (105%) | 2% |
| 1.05 (105%) ≤ ratio < 1.20 (120%) | 2.5% |
| ratio ≥ 1.20 (120%) | 5% |

---

## Workshop Calculator Flow

The Workshop calculator follows the same calculation flow as the Onsite calculator, with the following differences:

1. **No Onsite Options section** - This section is completely absent
2. **Simplified Travel calculation** - No site access considerations
3. **Same Labor, Materials, Sales Profit, and Commission logic**

### Workshop Calculation Flow

```
Labor Section (same as Onsite)
  + Materials Section (same as Onsite)
  + Travel Section (same as Onsite, but simpler)
  = Sub Grand Total (SGT)
  → Commission Calculation
  = Grand Total
```

---

## Calculation Comparison Table

| Section | Branch Multiplier | Sales Profit (Percentage) | Sales Profit (Flat) | Commission |
|---------|-------------------|---------------------------|---------------------|------------|
| **Labor** | ✓ Applied | ✓ Applied to all labor | ✓ Distributed to labor only | ✓ Applied |
| **Materials** | ✗ Skipped | ✗ Skipped | ✗ Skipped | ✓ Applied |
| **Travel** | ✗ Skipped | ✓ Applied to travel | ✗ Base cost only | ✓ Applied |
| **Onsite Options** | ✗ Skipped | ✓ Applied to options | ✗ Base cost only | ✓ Applied |

---

## Key Differences: Onsite vs Workshop

| Feature | Onsite Calculator | Workshop Calculator |
|---------|-------------------|---------------------|
| **Onsite Options** | ✓ Present (Crane, 4 People, Safety) | ✗ Not available |
| **Scope Selection** | ✓ Available | ✗ Not available |
| **Priority Level** | ✓ Available | ✗ Not available |
| **Site Access** | ✓ Available | ✗ Not available |
| **Labor Jobs** | Onsite-specific jobs | Workshop-specific jobs |
| **Cost Per Hour** | OnsiteCostPerHour (if set) or CostPerHour | CostPerHour |
| **Travel Calculation** | Same | Same |

---

## Grand Total Flow

### Final Grand Total Calculation

```
Grand Total = Labor Final Prices + Materials Final Prices + Travel Final Price + Onsite Options Final Price
```

**Where:**
- **Labor Final Prices**: Sum of all labor Final Prices (includes all multipliers and commission)
- **Materials Final Prices**: Sum of all material Final Prices (tiered price × commission, NO Sales Profit)
- **Travel Final Price**: Travel cost with Sales Profit (Percentage mode) or base (Flat mode) × commission
- **Onsite Options Final Price**: Options cost with Sales Profit (Percentage mode) or base (Flat mode) × commission

### Intermediate Totals

**Sub Grand Total (SGT):**
```
SGT = Labor (with Sales Profit) + Materials (tiered base) + Travel (with Sales Profit) + Onsite Options (with Sales Profit)
```

**Standard Selling Price (SSP):**
```
SSP = Labor (after branch only) + Materials (tiered base only) + Travel (base) + Onsite Options (base)
```

**Total Raw Cost:**
```
Total Raw Cost = Labor (raw) + Materials (raw) + Travel (base) + Onsite Options (base)
```

---

## Source Files Reference

### Onsite Calculator
- `src/js/onsite/calculations.js` - Main calculation function (`calcAll()`)
- `src/js/onsite/labor.js` - Labor calculations and multipliers
- `src/js/onsite/materials.js` - Materials calculations with tiered pricing
- `src/js/onsite/onsite-options.js` - Onsite Options calculations

### Workshop Calculator
- `src/js/workshop/calculations.js` - Main calculation function (`calcAll()`)
- `src/js/workshop/labor.js` - Labor calculations and multipliers
- `src/js/workshop/materials.js` - Materials calculations with tiered pricing

### Shared Modules
- `src/js/core/tieredMaterials.js` - Tiered pricing formula implementation
- `src/js/core/config.js` - Commission tiers configuration

### Related Documentation
- `docs/calculation.md` - Formulas and calculation conditions
- `CLAUDE.md` - Project overview and quick start

---

## Event Flow Summary

```
User Input Change
    ↓
Update State (appState)
    ↓
Recalculate Affected Section
    ↓
Trigger calcAll()
    ↓
Update All Display Elements
    ↓
Sync Sales Profit (if needed)
    ↓
Recalculate Commission
    ↓
Update Grand Total
```

---

## Mode-Specific Behavior

### Executive Mode
- Shows all cost breakdowns (Raw Cost, Cost+Ovh+PP, Final Price)
- Shows Standard Selling Price (SSP)
- Shows Percentage Breakdown panel
- Can edit all values

### Sales Mode
- Hides Raw Cost and Cost+Ovh+PP columns
- Shows Standard Selling Price (SSP) for quoting
- Hides Percentage Breakdown panel
- Cannot see cost data

### Customer Mode
- Shows only Grand Total
- Hides all cost breakdowns
- All inputs are read-only
- Minimal information display
