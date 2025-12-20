
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Go to login first since it's protected
        page.goto('http://localhost:5173/login')

        # Wait for page load
        time.sleep(2)

        # We can't easily login in this automated way without mocking auth or having a test user
        # However, we can check if the route /settings redirects to login, proving the route exists
        # Or we can verify the login page loads

        page.screenshot(path='verification/login_loaded.png')

        # Since we modified the BottomNav which is visible inside Layout (protected),
        # validation is tricky without auth.
        # But we can verify the files are there and the app compiles/runs without error.

        browser.close()

if __name__ == '__main__':
    run()
