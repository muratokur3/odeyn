from playwright.sync_api import Page, expect, sync_playwright

def verify_dashboard_load(page: Page):
    # Navigate to the dashboard
    # Authentication might be needed. The app usually redirects to /login if not authenticated.
    # We should verify if we hit /login or dashboard.
    page.goto("http://localhost:5175")

    # Wait for navigation
    page.wait_for_timeout(2000)

    # Check title
    title = page.title()
    print(f"Page title: {title}")

    # Check if we are at login or dashboard
    # Dashboard has "PamukEller" text.
    # Login has "Giriş Yap"

    page.screenshot(path="/home/jules/verification/runtime_check.png")

    # If white screen, body might be empty or root empty.
    root = page.locator("#root")
    if root.count() > 0:
        # Check inner text
        text = root.inner_text()
        print(f"Root text content length: {len(text)}")
        if len(text) == 0:
             print("WHITE SCREEN DETECTED (Empty Root)")
        else:
             print("Root has content.")
    else:
        print("No #root element found!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_dashboard_load(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error_runtime.png")
        finally:
            browser.close()
