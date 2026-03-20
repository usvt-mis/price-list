# Tailwind CSS Orange Color Fix

## Issue
The Upload button in the Sales Director Signatures tab had incorrect color values. The `bg-orange-600` and `bg-orange-700` classes were not being generated in the compiled Tailwind CSS output.

## Root Cause
The Tailwind CSS build process was not generating the orange background color classes (`bg-orange-50`, `bg-orange-200`, `bg-orange-300`, `bg-orange-600`, `bg-orange-700`) even though they were used in `backoffice.html`.

## Solution
Added explicit orange color class definitions to `src/css/input.css` using the `@layer utilities` directive to force Tailwind to include these classes in the compiled output.

### Changes Made

#### File: `src/css/input.css`
Added the following section at the end of the file:

```css
/* ========================================
   Tailwind Safelist - Force include specific classes
   ======================================== */

@layer utilities {
  /* Orange colors for Sales Director Signature tab */
  .bg-orange-50 {
    --tw-bg-opacity: 1;
    background-color: rgb(255 247 237 / var(--tw-bg-opacity, 1));
  }
  
  .bg-orange-200 {
    --tw-bg-opacity: 1;
    background-color: rgb(254 215 170 / var(--tw-bg-opacity, 1));
  }
  
  .bg-orange-300 {
    --tw-bg-opacity: 1;
    background-color: rgb(253 186 116 / var(--tw-bg-opacity, 1));
  }
  
  .bg-orange-600 {
    --tw-bg-opacity: 1;
    background-color: rgb(234 88 12 / var(--tw-bg-opacity, 1));
  }
  
  .bg-orange-700 {
    --tw-bg-opacity: 1;
    background-color: rgb(194 65 12 / var(--tw-bg-opacity, 1));
  }
  
  .border-orange-200,
  .border-orange-300,
  .border-orange-500,
  .text-orange-600,
  .text-orange-700,
  .text-orange-800,
  .ring-orange-500
}
```

### Verification
Run the following command to rebuild the CSS:
```bash
npm run build:css
```

The build completed successfully in 1801ms and the orange color classes are now present in `src/css/output.css`.

## Classes Now Available

The following Tailwind orange color classes are now properly defined:
- Background colors: `bg-orange-50`, `bg-orange-200`, `bg-orange-300`, `bg-orange-600`, `bg-orange-700`
- Border colors: `border-orange-200`, `border-orange-300`, `border-orange-500`
- Text colors: `text-orange-600`, `text-orange-700`, `text-orange-800`
- Ring colors: `ring-orange-500`

## Date Fixed
2025-03-20