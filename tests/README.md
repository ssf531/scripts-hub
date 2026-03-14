# UI Automation Tests

End-to-end tests using [Playwright](https://playwright.dev) for the SmartScript Hub frontend.

## Setup

Install dependencies (from `src/SmartScript.WebUI/ClientApp`):

```bash
npm install
```

## Running Tests

Before running tests, ensure the dev server is running:

```bash
# Terminal 1: Start the dev server
npm run dev

# Terminal 2: Run tests
npm test              # Run all tests headlessly
npm run test:ui       # Run with UI mode (interactive)
npm run test:debug    # Run in debug mode with inspector
```

## Test Coverage

### Navigation (`navigation.spec.ts`)
- ✅ Navigate to all main pages (Dashboard, M3U8, PDF Parser, Spending Analysis, History, Settings)
- ✅ Active nav item highlighting
- ✅ Nav items displayed in correct order

### Sidebar (`sidebar.spec.ts`)
- ✅ Collapse and expand sidebar with toggle button
- ✅ Show/hide nav labels on collapse
- ✅ Auto-collapse on small screens (< 768px)
- ✅ Auto-expand on large screens (>= 768px)
- ✅ Display v1.0 text when expanded

### History Page (`history.spec.ts`)
- ✅ Navigate to history page
- ✅ Display history table with data
- ✅ Independent table scrolling (not page scroll)
- ✅ Success/failed status badges

### Log Console (`log-console.spec.ts`)
- ✅ Toggle log console open/closed
- ✅ Display log console header and icon
- ✅ Show disconnected badge (when applicable)
- ✅ Auto-collapse on startup

### Dashboard (`dashboard.spec.ts`)
- ✅ Load dashboard page
- ✅ Display script cards
- ✅ Show script card details
- ✅ Start button availability
- ✅ Navigate to script details

## Configuration

Tests are configured in `playwright.config.ts`:

- **Base URL**: `http://localhost:3005`
- **Browsers**: Chromium, Firefox
- **Timeout**: 30 seconds per test
- **Retries**: 2 (CI only)
- **Reports**: HTML report saved to `playwright-report/`

## CI/CD Integration

In CI environments, set `CI=true` before running tests:

```bash
CI=true npm test
```

This enables:
- Retries (2 attempts)
- Single worker process
- Screenshot/trace on failure

## Debugging Tips

- Use `--debug` flag to open Inspector:
  ```bash
  npm run test:debug
  ```

- Add `.only` to run a single test:
  ```typescript
  test.only("should collapse sidebar", async ({ page }) => { ... })
  ```

- Check `trace.zip` files in failure reports for detailed action logs

## Adding New Tests

1. Create a new file in `tests/e2e/` with `.spec.ts` extension
2. Import `test` and `expect` from `@playwright/test`
3. Wrap tests in `test.describe()` blocks
4. Run tests to verify

Example:

```typescript
import { test, expect } from "@playwright/test";

test.describe("New Feature", () => {
  test("should do something", async ({ page }) => {
    await page.goto("/");
    // Add assertions
  });
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Assertions Reference](https://playwright.dev/docs/api/class-pageassertions)
- [Selectors Guide](https://playwright.dev/docs/selectors)
