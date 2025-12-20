
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Verify Login Page Loads
        page.goto('http://localhost:5173/login')
        time.sleep(1)
        page.screenshot(path='verification/login_loaded_v2.png')

        # 2. Check for unexpected console errors
        page.on('console', lambda msg: print(f'Console: {msg.text}'))

        browser.close()

if __name__ == '__main__':
    run()
