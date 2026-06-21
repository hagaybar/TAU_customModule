# SVG Code Mismatch Report

**Generated:** 2026-02-11

## Summary

This report identifies svgCodes in the CSV data that are **NOT** found as element IDs in the corresponding SVG floor maps.

| Floor | CSV Codes | SVG IDs | Missing | Status |
|-------|-----------|---------|---------|--------|
| 0     | 1         | 370     | 0       | OK |
| 1     | 196       | 569     | 37      | ISSUES |
| 2     | 189       | 669     | 3       | ISSUES |
| **Total** | **386** | -       | **40**  | - |

## Floor 0 (Entrance)

**Status: OK** - All 1 svgCode found in SVG

- `CB_0` - Bibliography Collection

## Floor 1 (First Floor)

**Status: 37 svgCodes MISSING in SVG**

### Missing CL1 (Limited Loan) Codes
| svgCode | Description |
|---------|-------------|
| `cl1_106_a` | Limited Loan cabinet 106 side A |
| `cl1_106_b` | Limited Loan cabinet 106 side B |
| `cl1_107_a` | Limited Loan cabinet 107 side A |
| `cl1_107_b` | Limited Loan cabinet 107 side B |
| `cl1_108_a` | Limited Loan cabinet 108 side A |

**Note:** SVG has `cl_106_a`, `cl_106_b`, `cl_107_a`, `cl_107_b`, `cl_108_a` (without "1" in prefix). **CSV uses `cl1_*` but SVG uses `cl_*`**

### Missing KA1 (Reading Room 1A) Codes
| svgCode | Notes |
|---------|-------|
| `ka1_17_a` | Missing (but `ka1_17_b` exists in SVG) |
| `ka1_52_b` | Missing (but `ka1_52_a` exists in SVG) |
| `ka1_62_a` through `ka1_76_b` | **30 codes missing** - Shelves 62-76 not in SVG |

**Analysis:** Floor 1 SVG only has shelves up to ka1_61 in the ka1 section. Shelves 62-76 need to be added to the SVG, OR the CSV data is incorrect.

## Floor 2 (Second Floor)

**Status: 3 svgCodes MISSING in SVG**

| svgCode | Notes |
|---------|-------|
| `kb1_28_b` | Missing (but `kb1_28_a` does not exist - check if shelf 28 missing) |
| `kb2_46_b` | Missing (but `kb2_46_a` does not exist - check `ck_46_b` exists) |
| `kb2_75_b` | Missing (but `kb2_75_a` exists in SVG) |

**Note:** For `kb2_46_b`, the SVG has `ck_46_a` and `ck_46_b` - this might be a naming inconsistency (ck vs kb2 prefix).

## Recommendations

### High Priority (Data Alignment Issues)
1. **Fix CL prefix inconsistency (Floor 1):**
   - Option A: Update CSV to use `cl_106_a` instead of `cl1_106_a` (etc.)
   - Option B: Update SVG to use `cl1_*` IDs instead of `cl_*`

2. **Add missing shelves 62-76 to Floor 1 SVG** OR remove these rows from CSV if they don't exist physically

### Medium Priority (Missing Individual Elements)
3. **Floor 1:** Add `ka1_17_a` and `ka1_52_b` to SVG
4. **Floor 2:** Add `kb1_28_b`, `kb2_75_b` to SVG
5. **Floor 2:** Clarify kb2_46 vs ck_46 naming

## Verification Checklist

- [ ] Verify physical shelf layout for ka1_62 through ka1_76
- [ ] Decide on `cl1_*` vs `cl_*` naming convention
- [ ] Update SVG or CSV based on decisions
- [ ] Re-run validation after fixes
