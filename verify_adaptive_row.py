from playwright.sync_api import Page, expect, sync_playwright

def verify_adaptive_row(page: Page):
    # Navigate to the test page
    page.goto("http://localhost:5174/test-adaptive")

    # 1. Test Mobile View (Swipe)
    page.set_viewport_size({"width": 375, "height": 812})
    expect(page.get_by_text("Swipe Left to Delete")).to_be_visible()

    # Take screenshot of Mobile View (Initial)
    page.screenshot(path="/home/jules/verification/mobile_initial.png")

    # Perform Swipe (This is tricky in Playwright, simulating drag)
    row = page.get_by_text("Test Item 1").first
    box = row.bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] - 100, box["y"] + box["height"] / 2, steps=10) # Swipe Left
    page.mouse.up()

    # Verify Delete button revealed (assuming text 'Sil' is visible)
    # Note: Frame-motion animation might take time, or require waiting
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/mobile_swiped.png")

    # 2. Test Desktop View (Three Dots)
    page.set_viewport_size({"width": 1280, "height": 800})

    # Reload to reset state/layout detection
    page.reload()

    # Expect Three Dots button
    # We look for the button that opens the menu. It might not have text, but is a button with an icon.
    # We can try to find by role 'button' inside the row.
    # Or just take a screenshot to visually verify.
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/desktop_view.png")

    # Click the dots
    # There should be a button in the row.
    # Since we have multiple rows, let's pick the first one's button.
    # The structure: div > div > button (three dots)

    # Let's find the button by the MoreVertical icon which might not be accessible by text.
    # However, we can click the button generally in that area or use a selector.
    # In AdaptiveActionRow, the button is: <button className="p-2 ..."><MoreVertical /></button>

    page.locator("button").first.click()
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/desktop_menu_open.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_adaptive_row(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
        finally:
            browser.close()
