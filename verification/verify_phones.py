from playwright.sync_api import sync_playwright

def verify_manage_phones():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use existing storage state if possible, or we need to login
        # Since we don't have a reliable way to login in this script without credentials,
        # we might need to rely on the fact that the dev server allows navigating to pages.
        # BUT this app requires Auth.

        # Let's try to mock the auth in the app or just login if we can.
        # Since I can't easily login without a real user, I will check if I can just screenshot the component
        # by checking if there is a public page or if I can mock the AuthContext.

        # Alternatively, I can use the fact that I am in the sandbox and might be able to inject a mock user.
        # But for now, let's try to hit the page and see if it redirects to Login.

        page = browser.new_page()
        page.goto("http://localhost:5173/login")
        page.wait_for_timeout(3000)
        page.screenshot(path="verification/login_page.png")

        # Since I cannot login via script without credentials (and I shouldn't create them here),
        # I will rely on the fact that I've implemented the code correctly.
        # However, to produce a screenshot, I really need to be logged in.

        # I'll try to register a new user quickly?
        # Click "Hesabın yok mu? Kayıt Ol"
        try:
            page.get_by_text("Hesabın yok mu? Kayıt Ol").click()
            page.wait_for_timeout(1000)

            # Fill Registration
            # Use random email to avoid conflict
            import random
            rnd = random.randint(1000,9999)
            email = f"testuser{rnd}@example.com"
            page.get_by_placeholder("Ad Soyad").fill("Test User")
            page.get_by_placeholder("E-Posta").fill(email)
            page.get_by_placeholder("Şifre").fill("password123")
            page.get_by_placeholder("Şifre Tekrar").fill("password123")

            # Click Register
            page.get_by_role("button", name="Kayıt Ol").click()
            page.wait_for_timeout(5000) # Wait for registration and redirect

            # Check if we are on Dashboard or Profile
            # Navigate to Profile
            page.goto("http://localhost:5173/profile")
            page.wait_for_timeout(3000)

            # Look for "Bağlı Telefon Numaraları" (My new component)
            # Take screenshot of the Profile page with the new component
            page.screenshot(path="verification/profile_manage_phones.png")

            # Try to add a phone
            page.get_by_role("button", name="Yeni Numara Ekle").click()
            page.wait_for_timeout(1000)
            page.get_by_placeholder("+90555...").fill("5551234567")
            page.get_by_role("button", name="Doğrulama Kodu Gönder").click()
            page.wait_for_timeout(2000)

            page.screenshot(path="verification/add_phone_step1.png")

            # Enter Mock Code
            # Mock code is random in my service, but I can't see console log here easily.
            # However, I set it to log to console.
            # Wait, I can't see the code.
            # But the mock service says: "Code sent".
            # I can't verify step 2 without the code.
            # BUT, I can show the UI state of "Input Code".

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")

        browser.close()

if __name__ == "__main__":
    verify_manage_phones()
