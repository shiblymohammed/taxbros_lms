# Income Tax Return Calculation Examples

This document provides real examples of how the ITR simulation calculates tax using the simplified progressive bracket system.

## Tax Brackets (Simplified for Training)

| Income Range | Rate | Description |
|--------------|------|-------------|
| ₹0 - ₹2,50,000 | 0% | No tax up to ₹2.5 Lakh |
| ₹2,50,001 - ₹5,00,000 | 5% | 5% on income between ₹2.5L and ₹5L |
| ₹5,00,001 - ₹10,00,000 | 20% | 20% on income between ₹5L and ₹10L |
| Above ₹10,00,000 | 30% | 30% on income above ₹10L |

## Example 1: Low Income (No Tax)

**Input**:
- Gross Income: ₹3,00,000
- Deductions: ₹1,00,000
- **Taxable Income: ₹2,00,000**

**Calculation**:
- Income falls in 0% bracket (below ₹2.5L)
- **Tax Amount: ₹0**

```json
{
  "grossIncome": 300000,
  "deductions": 100000,
  "taxableIncome": 200000,
  "taxAmount": 0,
  "taxBrackets": []
}
```

## Example 2: Single Bracket (5%)

**Input**:
- Gross Income: ₹4,00,000
- Deductions: ₹50,000
- **Taxable Income: ₹3,50,000**

**Calculation**:
- First ₹2,50,000 @ 0% = ₹0
- Next ₹1,00,000 @ 5% = ₹5,000
- **Tax Amount: ₹5,000**

```json
{
  "grossIncome": 400000,
  "deductions": 50000,
  "taxableIncome": 350000,
  "taxAmount": 5000,
  "taxBrackets": [
    {
      "from": 250000,
      "to": 500000,
      "rate": 5,
      "taxOnBracket": 5000
    }
  ]
}
```

## Example 3: Multiple Brackets (5% + 20%)

**Input**:
- Gross Income: ₹6,00,000
- Deductions: ₹50,000
- **Taxable Income: ₹5,50,000**

**Calculation**:
- First ₹2,50,000 @ 0% = ₹0
- Next ₹2,50,000 @ 5% = ₹12,500
- Next ₹50,000 @ 20% = ₹10,000
- **Tax Amount: ₹22,500**

```json
{
  "grossIncome": 600000,
  "deductions": 50000,
  "taxableIncome": 550000,
  "taxAmount": 22500,
  "taxBrackets": [
    {
      "from": 250000,
      "to": 500000,
      "rate": 5,
      "taxOnBracket": 12500
    },
    {
      "from": 500000,
      "to": 1000000,
      "rate": 20,
      "taxOnBracket": 10000
    }
  ]
}
```

## Example 4: All Brackets (5% + 20% + 30%)

**Input**:
- Gross Income: ₹15,00,000
- Deductions: ₹1,00,000
- **Taxable Income: ₹14,00,000**

**Calculation**:
- First ₹2,50,000 @ 0% = ₹0
- Next ₹2,50,000 @ 5% = ₹12,500
- Next ₹5,00,000 @ 20% = ₹1,00,000
- Next ₹4,00,000 @ 30% = ₹1,20,000
- **Tax Amount: ₹2,32,500**

```json
{
  "grossIncome": 1500000,
  "deductions": 100000,
  "taxableIncome": 1400000,
  "taxAmount": 232500,
  "taxBrackets": [
    {
      "from": 250000,
      "to": 500000,
      "rate": 5,
      "taxOnBracket": 12500
    },
    {
      "from": 500000,
      "to": 1000000,
      "rate": 20,
      "taxOnBracket": 100000
    },
    {
      "from": 1000000,
      "to": null,
      "rate": 30,
      "taxOnBracket": 120000
    }
  ]
}
```

## Example 5: Sample Data (Default Form)

**Input**:
- Gross Income: ₹8,00,000
- Deductions: ₹1,50,000
- **Taxable Income: ₹6,50,000**

**Calculation**:
- First ₹2,50,000 @ 0% = ₹0
- Next ₹2,50,000 @ 5% = ₹12,500
- Next ₹1,50,000 @ 20% = ₹30,000
- **Tax Amount: ₹42,500**

```json
{
  "grossIncome": 800000,
  "deductions": 150000,
  "taxableIncome": 650000,
  "taxAmount": 42500,
  "taxBrackets": [
    {
      "from": 250000,
      "to": 500000,
      "rate": 5,
      "taxOnBracket": 12500
    },
    {
      "from": 500000,
      "to": 1000000,
      "rate": 20,
      "taxOnBracket": 30000
    }
  ]
}
```

## Example 6: Edge Case - Full Deductions

**Input**:
- Gross Income: ₹5,00,000
- Deductions: ₹5,00,000
- **Taxable Income: ₹0**

**Calculation**:
- No taxable income
- **Tax Amount: ₹0**

```json
{
  "grossIncome": 500000,
  "deductions": 500000,
  "taxableIncome": 0,
  "taxAmount": 0,
  "taxBrackets": []
}
```

## Example 7: Edge Case - Exactly at Bracket Boundary

**Input**:
- Gross Income: ₹5,00,000
- Deductions: ₹0
- **Taxable Income: ₹5,00,000**

**Calculation**:
- First ₹2,50,000 @ 0% = ₹0
- Next ₹2,50,000 @ 5% = ₹12,500
- **Tax Amount: ₹12,500**

```json
{
  "grossIncome": 500000,
  "deductions": 0,
  "taxableIncome": 500000,
  "taxAmount": 12500,
  "taxBrackets": [
    {
      "from": 250000,
      "to": 500000,
      "rate": 5,
      "taxOnBracket": 12500
    }
  ]
}
```

## Validation Rules

### Required Fields
- ✅ taxpayerName - Non-empty string
- ✅ pan - 10-character fictional pattern
- ✅ incomeSource - Non-empty string
- ✅ grossIncome - Number >= 0
- ✅ deductions - Number >= 0

### Business Rules
- ✅ Deductions cannot exceed gross income
- ✅ PAN must use fictional patterns (TEST, DEMO, TRAIN, LEARN)
- ✅ Realistic PAN patterns are rejected for safety

### Fictional PAN Examples
- ✅ `TEST00000T` - Valid
- ✅ `DEMO00000D` - Valid
- ✅ `TRAIN0000R` - Valid
- ✅ `LEARN0000L` - Valid
- ❌ `ABCDE1234F` - Rejected (realistic pattern)

## Complete Submission Response

**Request**:
```json
POST /labs/INCOME_TAX_RETURN/submit
{
  "taxpayerName": "Sample Taxpayer",
  "pan": "TEST00000T",
  "incomeSource": "Salary",
  "grossIncome": 800000,
  "deductions": 150000
}
```

**Response**:
```json
{
  "id": "cm3qx1y2z0001abc123def456",
  "labId": "cm3qw1x2y0001xyz789ghi012",
  "studentId": "cm3qv1w2x0001stu345jkl678",
  "formData": {
    "taxpayerName": "Sample Taxpayer",
    "pan": "TEST00000T",
    "incomeSource": "Salary",
    "grossIncome": 800000,
    "deductions": 150000
  },
  "result": {
    "formData": {
      "taxpayerName": "Sample Taxpayer",
      "pan": "TEST00000T",
      "incomeSource": "Salary",
      "grossIncome": 800000,
      "deductions": 150000
    },
    "calculation": {
      "grossIncome": 800000,
      "deductions": 150000,
      "taxableIncome": 650000,
      "taxAmount": 42500,
      "taxBrackets": [
        {
          "from": 250000,
          "to": 500000,
          "rate": 5,
          "taxOnBracket": 12500
        },
        {
          "from": 500000,
          "to": 1000000,
          "rate": 20,
          "taxOnBracket": 30000
        }
      ]
    },
    "result": {
      "acknowledgementNumber": "123456789012345",
      "taxpayerName": "Sample Taxpayer",
      "pan": "TEST00000T",
      "taxableIncome": 650000,
      "taxAmount": 42500,
      "filingDate": "2024-11-20T10:30:45.123Z",
      "status": "FILED"
    }
  },
  "completedAt": "2024-11-20T10:30:45.123Z",
  "createdAt": "2024-11-20T10:30:45.123Z"
}
```

## Important Notes

### This is a Training Simulation
- 🚨 **Do NOT use real PANs or real taxpayer data**
- ✅ Use fictional patterns only (TEST, DEMO, TRAIN, LEARN)
- ✅ Tax brackets are simplified for educational purposes
- ✅ Acknowledgement numbers are fictional

### Safety Features
- Realistic PAN patterns are actively rejected
- Clear error messages guide users to fictional data
- System explicitly warns about simulation nature

### Calculation Accuracy
- All calculations use progressive bracket system
- Tax amounts are rounded to nearest integer
- Bracket breakdowns are provided for transparency
- Historical attempts are preserved for learning

---

**Note**: These examples demonstrate the backend calculation logic. The frontend UI will display these calculations with appropriate warnings and educational context.
