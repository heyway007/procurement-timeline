# Budget Category and Actual Amount Design

## Objective

Require every procurement project to store both a selected budget category and its actual budget amount, preventing users from saving a category that does not match the entered amount.

## Categories

| Key | Display label | Inclusive range |
| --- | --- | --- |
| `ONE_TO_FIVE_MILLION` | 1–5 ล้านบาท | 1,000,000–5,000,000 baht |
| `FIVE_TO_TEN_MILLION` | 5 ล้าน 1 บาท–10 ล้านบาท | 5,000,001–10,000,000 baht |
| `TEN_TO_TWENTY_MILLION` | 10 ล้าน 1 บาท–20 ล้านบาท | 10,000,001–20,000,000 baht |
| `ABOVE_TWENTY_MILLION` | มากกว่า 20 ล้านบาท | 20,000,001 baht and above |

An actual amount below 1,000,000 baht is invalid because it belongs to none of the approved categories. Decimal amounts are supported to two decimal places; range boundaries use the exact baht values above.

## Data Model and Migration

Add a required `budgetCategory` enum field to `Project`. Existing projects receive their category by applying the same range function to the stored actual `budget` value. If an existing project is below 1,000,000 baht, migration must stop and report the project rather than assigning an incorrect category.

The existing `budget` decimal column remains the authoritative actual amount. API and UI records expose both `budget` and `budgetCategory`.

## Validation

Project creation and project metadata updates require both fields. A shared pure function maps an actual amount to its category and rejects values below 1,000,000. The server compares that result with the selected category and returns a validation error when they differ. Client-side validation presents the same rule immediately, but server validation remains authoritative.

Examples:

- 5,000,000 → `ONE_TO_FIVE_MILLION`
- 5,000,001 → `FIVE_TO_TEN_MILLION`
- 20,000,000 → `TEN_TO_TWENTY_MILLION`
- 20,000,001 → `ABOVE_TWENTY_MILLION`

## User Interface

The create-project form shows a required “ประเภทวงเงิน” select before a required “วงเงินจริง (บาท)” numeric input. Saving is blocked with a Thai error message when the amount does not match the selection or is below 1,000,000 baht.

The dashboard continues to show the formatted actual amount and adds the category label beneath it. Timeline details continue to show the actual amount; adding the category there is optional and outside this change.

## Testing

- Unit tests cover all lower/upper boundaries, amounts below 1,000,000, and category mismatch.
- Project service/API tests prove the server rejects mismatched values.
- Form tests prove both fields are required and mismatch blocks submission.
- Dashboard tests prove the actual amount and category label are both displayed.
- Existing schedule, holiday, and timeline editing tests remain unchanged.

## Acceptance Criteria

- A project cannot be saved without selecting one of the four categories and entering an actual amount.
- A mismatch between selected category and actual amount is explained in Thai and is not submitted.
- 20,000,000 baht belongs to category 3; category 4 starts at 20,000,001 baht.
- Existing valid projects receive the correct category without losing their actual amount.
- The dashboard displays both actual amount and category.
