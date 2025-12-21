---
description: Run strict non-regression tests for the entire application
---

This workflow runs the complete test suite to ensure no regressions were introduced.

1. Open a terminal.
2. Run the full test suite:
   // turbo
   npm test

3. If you want to check specific UI regressions (PC/Mobile) verify the output of `tests/non_regression.test.js`.

4. If any test fails, STOP and fix the code. Do not proceed with new features until all tests are green.
