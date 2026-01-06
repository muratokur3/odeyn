
import os
from playwright.sync_api import sync_playwright

def verify_login_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create context with mobile viewport to match app design
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()

        try:
            page.goto("http://localhost:3000/login")
            page.wait_for_load_state("networkidle")
            page.screenshot(path="verification_login_new.png")
            print("Login screenshot taken.")

        except Exception as e:
            print(f"Error: {e}")

        finally:
            browser.close()

if __name__ == "__main__":
    verify_login_page()
