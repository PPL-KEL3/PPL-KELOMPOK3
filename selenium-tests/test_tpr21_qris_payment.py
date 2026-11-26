"""
PBI-21 / TPR-21: Sesi Pembayaran QRIS (sheet Excel "Payment & Transaction"). Pemilik PBI: Geraldo.

Satu fungsi tes = satu Case ID di Excel (lihat nama tes di output `pytest -v`).

Data uji:
- Booking dibuat lewat API oleh E2E_CUSTOMER_A untuk jasa "[E2E] Jasa Booking" milik
  E2E_PROVIDER_A, lalu diterima lewat API (belum ada halaman penyedia untuk menerima booking).
  Tanggalnya acak jauh di depan supaya slot tidak bentrok antar run.
- TC.PAY.005.001 menandai pembayaran "paid" lewat API admin (PATCH /payments/:id/mark-paid).
- TC.PAY.004.x mengubah expires_at sesi pembayaran. Tidak ada API untuk itu, jadi tes memakai
  Supabase REST dengan SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di .env. Kalau tidak diisi,
  dua kasus itu di-skip; ubah expires_at manual lewat SQL lalu jalankan ulang.
- Booking yang dibuat tidak bisa dihapus; booking tetap tercatat dengan status diterima.

Jalankan:  pytest test_tpr21_qris_payment.py -v
"""

import datetime as dt
import os
import pathlib
import random

import pytest
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def _load_env():
    env_file = pathlib.Path(__file__).with_name(".env")
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


_load_env()

BASE_URL = os.getenv("LOKA_BASE_URL", "http://localhost:3000").rstrip("/")
API_URL = os.getenv("LOKA_API_URL", "http://localhost:4000").rstrip("/") + "/api"
WAIT = int(os.getenv("E2E_WAIT_SECONDS", "10"))
SERVICE_NAME = "[E2E] Jasa Booking"
DASH = "–"
DEFAULT_HOURS = {
    **{day: {"isOpen": True, "open": "08:00", "close": "17:00"}
       for day in ("monday", "tuesday", "wednesday", "thursday", "friday")},
    "saturday": {"isOpen": True, "open": "08:00", "close": "12:00"},
    "sunday": {"isOpen": False},
}


def env_account(prefix):
    email = os.getenv(f"{prefix}_EMAIL")
    password = os.getenv(f"{prefix}_PASSWORD")
    if not email or not password:
        pytest.skip(f"Akun {prefix}_EMAIL / {prefix}_PASSWORD belum diisi di selenium-tests/.env")
    return email, password


def tc(case_id):
    return pytest.mark.parametrize("case_id", [case_id], ids=[case_id])


def norm(text):
    return " ".join(text.replace("\xa0", " ").split())


_BASE_WEEK = random.randint(10, 60)
_week_counter = [0]
_hour_counter = [7]


def next_slot():
    """Hari kerja dan jam berbeda untuk tiap booking (slot tidak bentrok)."""
    _hour_counter[0] += 1
    if _hour_counter[0] > 16:
        _hour_counter[0] = 8
    _week_counter[0] += 1
    start = dt.date.today() + dt.timedelta(weeks=_BASE_WEEK + _week_counter[0])
    day = start + dt.timedelta(days=(1 - start.weekday()) % 7)
    hour = _hour_counter[0]
    return day.isoformat(), f"{hour:02d}.00{DASH}{hour + 1:02d}.00"


# ---------------------------------------------------------------------------
# Helper API dan setup
# ---------------------------------------------------------------------------

class Api:
    def __init__(self, email, password):
        self.session = requests.Session()
        self.call("POST", "/auth/login", json={"email": email, "password": password})

    def call(self, method, path, **kwargs):
        response = self.session.request(method, API_URL + path, timeout=30, **kwargs)
        payload = response.json() if response.content else {}
        if not response.ok:
            raise AssertionError(f"{method} {path} gagal ({response.status_code}): {payload}")
        return payload.get("data", payload)


def profile_payload(profile):
    return {
        "businessName": profile["businessName"], "bio": profile.get("bio"),
        "whatsappNumber": profile["whatsappNumber"], "address": profile["address"],
        "serviceArea": profile["serviceArea"], "operatingHours": profile["operatingHours"],
        "primaryCategoryId": (profile.get("primaryCategory") or {}).get("id") or profile.get("primaryCategoryId"),
        "isPublic": profile["isPublic"],
    }


@pytest.fixture(scope="module")
def provider():
    return Api(*env_account("E2E_PROVIDER_A"))


@pytest.fixture(scope="module")
def customer_a():
    return Api(*env_account("E2E_CUSTOMER_A"))


@pytest.fixture(scope="module")
def service_id(provider):
    profile = provider.call("GET", "/providers/me").get("profile")
    if not profile:
        pytest.skip("E2E_PROVIDER_A harus sudah punya profil penyedia")
    original = profile_payload(profile)
    provider.call("PUT", "/providers/me", json={**original, "operatingHours": DEFAULT_HOURS, "isPublic": True})
    service = next((s for s in provider.call("GET", "/services/mine")["services"] if s["name"] == SERVICE_NAME), None)
    if service is None:
        service = provider.call("POST", "/services", json={
            "categoryId": original["primaryCategoryId"], "name": SERVICE_NAME,
            "description": "Jasa khusus pengujian otomatis booking.", "price": 100000, "isActive": True,
        })["service"]
    else:
        provider.call("PATCH", f"/services/{service['id']}", json={"isActive": True})
    yield service["id"]
    provider.call("PATCH", f"/services/{service['id']}", json={"isActive": False})
    provider.call("PUT", "/providers/me", json=original)


def new_booking(customer, service_id, provider=None):
    work_date, work_time = next_slot()
    booking = customer.call("POST", "/bookings", json={
        "serviceId": service_id, "packageId": None, "workDate": work_date, "workTime": work_time,
    })["booking"]
    if provider is not None:
        provider.call("POST", f"/bookings/{booking['id']}/accept")
    return booking


def set_expires_at(payment_id, when):
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        pytest.skip("Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env, atau ubah expires_at manual lewat SQL")
    response = requests.patch(
        f"{url.rstrip('/')}/rest/v1/payments?id=eq.{payment_id}",
        json={"expires_at": when.isoformat()},
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"},
        timeout=30,
    )
    assert response.ok, f"Gagal mengubah expires_at: {response.status_code} {response.text}"
    updated = response.json()
    assert updated and dt.datetime.fromisoformat(updated[0]["expires_at"].replace("Z", "+00:00")) <= when + dt.timedelta(seconds=2), (
        f"expires_at payment tidak berubah sesuai test: {updated}"
    )


@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--window-size=1366,900")
    if os.getenv("HEADLESS") == "1":
        options.add_argument("--headless=new")
    browser = webdriver.Chrome(options=options)
    yield browser
    browser.quit()


# ---------------------------------------------------------------------------
# Helper UI
# ---------------------------------------------------------------------------

def login(driver, api):
    driver.get(BASE_URL + "/login")
    for cookie in api.session.cookies:
        driver.add_cookie({"name": cookie.name, "value": cookie.value, "path": "/"})


def wait(driver):
    return WebDriverWait(driver, WAIT)


def body_text(driver):
    return norm(driver.find_element(By.TAG_NAME, "body").text)


def open_payment(driver, customer, booking_id):
    login(driver, customer)
    driver.get(f"{BASE_URL}/customer/booking/{booking_id}/payment")
    wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, ".payment-status-row, .booking-state")
                       and "Memuat pembayaran..." not in body_text(d))


def payment_status(driver):
    return norm(driver.find_element(By.CSS_SELECTOR, ".payment-status-row .booking-status").text)


def button(driver, text):
    element = wait(driver).until(EC.presence_of_element_located((By.XPATH, f"//button[normalize-space()='{text}']")))
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
    wait(driver).until(lambda d: element.is_displayed() and element.is_enabled())
    return element


def link(driver, text):
    element = wait(driver).until(EC.presence_of_element_located((By.XPATH, f"//a[normalize-space()='{text}']")))
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});", element)
    wait(driver).until(lambda d: element.is_displayed() and element.is_enabled())
    return element


def click_element(driver, element):
    try:
        element.click()
    except Exception:
        driver.execute_script("arguments[0].click();", element)


def has_button(driver, text):
    return bool(driver.find_elements(By.XPATH, f"//button[normalize-space()='{text}']"))


# ---------------------------------------------------------------------------
# TS.PAY.001 Membuka halaman pembayaran
# ---------------------------------------------------------------------------

@pytest.mark.alur_utama
@tc("TC.PAY.001.001")
def test_buka_pembayaran_booking_diterima(case_id, driver, service_id, provider, customer_a):
    booking = new_booking(customer_a, service_id, provider)
    login(driver, customer_a)
    driver.get(f"{BASE_URL}/customer/booking/{booking['id']}")
    click_element(driver, link(driver, "Lihat Pembayaran QRIS"))
    wait(driver).until(EC.url_contains("/payment"))
    wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, ".payment-status-row"))
    assert payment_status(driver) == "Belum Dibayar"
    text = body_text(driver)
    assert "Sesi berlaku sampai" in text
    assert "Rp 100.000" in text


@tc("TC.PAY.001.002")
def test_qris_merchant_tampil(case_id, driver, service_id, provider, customer_a):
    booking = new_booking(customer_a, service_id, provider)
    open_payment(driver, customer_a, booking["id"])
    qr = driver.find_elements(By.CSS_SELECTOR, ".payment-qr-image")
    assert qr, "Gambar QRIS merchant tidak tampil"
    assert qr[0].get_attribute("src").endswith("/qris-merchant.png")
    assert "Pindai QRIS di atas menggunakan aplikasi pembayaran kamu" in body_text(driver)


@tc("TC.PAY.001.003")
def test_pembayaran_booking_pending_ditolak(case_id, driver, service_id, customer_a):
    booking = new_booking(customer_a, service_id)
    try:
        open_payment(driver, customer_a, booking["id"])
        text = body_text(driver)
        assert "Pembayaran tidak dapat dimuat" in text
        assert "Booking belum memenuhi syarat untuk pembayaran." in text
    finally:
        customer_a.call("POST", f"/bookings/{booking['id']}/cancel")


@tc("TC.PAY.001.004")
def test_pembayaran_booking_customer_lain(case_id, driver, service_id, provider, customer_a):
    customer_b = Api(*env_account("E2E_CUSTOMER_B"))
    booking = new_booking(customer_b, service_id, provider)
    open_payment(driver, customer_a, booking["id"])
    assert "Pembayaran tidak dapat dimuat" in body_text(driver)
    assert not driver.find_elements(By.CSS_SELECTOR, ".payment-status-row")


@tc("TC.PAY.001.005")
def test_tamu_tidak_bisa_buka_pembayaran(case_id, driver, service_id, provider, customer_a):
    booking = new_booking(customer_a, service_id, provider)
    driver.get(f"{BASE_URL}/customer/booking/{booking['id']}/payment")
    wait(driver).until(EC.url_contains("/login"))


# ---------------------------------------------------------------------------
# TS.PAY.002 Refresh & sesi yang sama
# ---------------------------------------------------------------------------

@tc("TC.PAY.002.001")
def test_refresh_status(case_id, driver, service_id, provider, customer_a):
    booking = new_booking(customer_a, service_id, provider)
    open_payment(driver, customer_a, booking["id"])
    click_element(driver, button(driver, "Refresh Status"))
    wait(driver).until(lambda d: has_button(d, "Refresh Status"))
    assert payment_status(driver) == "Belum Dibayar"


@tc("TC.PAY.002.002")
def test_buka_ulang_tidak_membuat_sesi_ganda(case_id, driver, service_id, provider, customer_a):
    booking = new_booking(customer_a, service_id, provider)
    open_payment(driver, customer_a, booking["id"])
    first = driver.find_element(By.CSS_SELECTOR, ".payment-expiry").text
    driver.refresh()
    wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, ".payment-expiry"))
    assert driver.find_element(By.CSS_SELECTOR, ".payment-expiry").text == first


# ---------------------------------------------------------------------------
# TS.PAY.003 Membatalkan sesi
# ---------------------------------------------------------------------------

@tc("TC.PAY.003.001")
def test_batalkan_sesi_pembayaran(case_id, driver, service_id, provider, customer_a):
    booking = new_booking(customer_a, service_id, provider)
    open_payment(driver, customer_a, booking["id"])
    click_element(driver, button(driver, "Batalkan Pembayaran"))
    alert = wait(driver).until(EC.alert_is_present())
    assert alert.text == "Batalkan sesi pembayaran ini? Sesi lokal yang aktif tidak akan dapat digunakan lagi."
    alert.accept()
    wait(driver).until(lambda d: payment_status(d) == "Sesi Dibatalkan")
    assert "Sesi pembayaran ini sudah dibatalkan." in body_text(driver)


@tc("TC.PAY.003.002")
def test_batal_membatalkan_sesi(case_id, driver, service_id, provider, customer_a):
    booking = new_booking(customer_a, service_id, provider)
    open_payment(driver, customer_a, booking["id"])
    click_element(driver, button(driver, "Batalkan Pembayaran"))
    wait(driver).until(EC.alert_is_present()).dismiss()
    assert payment_status(driver) == "Belum Dibayar"


# ---------------------------------------------------------------------------
# TS.PAY.004 Masa berlaku sesi (BVA)
# ---------------------------------------------------------------------------

def accepted_payment(customer, provider, service_id):
    booking = new_booking(customer, service_id, provider)
    payment = customer.call("POST", f"/bookings/{booking['id']}/payment")["payment"]
    return booking, payment


@tc("TC.PAY.004.001")
def test_sesi_satu_menit_sebelum_habis(case_id, driver, service_id, provider, customer_a):
    booking, payment = accepted_payment(customer_a, provider, service_id)
    set_expires_at(payment["id"], dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=1))
    open_payment(driver, customer_a, booking["id"])
    assert payment_status(driver) == "Belum Dibayar"
    assert has_button(driver, "Refresh Status") and has_button(driver, "Batalkan Pembayaran")


@tc("TC.PAY.004.002")
def test_sesi_satu_menit_setelah_habis(case_id, driver, service_id, provider, customer_a):
    booking, payment = accepted_payment(customer_a, provider, service_id)
    set_expires_at(payment["id"], dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=10))
    open_payment(driver, customer_a, booking["id"])
    wait(driver).until(lambda d: payment_status(d) == "Sesi Kedaluwarsa")
    assert "Sesi pembayaran sudah kedaluwarsa dan tidak dapat digunakan lagi." in body_text(driver)
    assert has_button(driver, "Buat Sesi Baru")
    assert not has_button(driver, "Batalkan Pembayaran")


@tc("TC.PAY.004.003")
def test_buat_sesi_baru(case_id, driver, service_id, provider, customer_a):
    booking, payment = accepted_payment(customer_a, provider, service_id)
    set_expires_at(payment["id"], dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=10))
    open_payment(driver, customer_a, booking["id"])
    wait(driver).until(lambda d: payment_status(d) == "Sesi Kedaluwarsa")
    click_element(driver, button(driver, "Buat Sesi Baru"))
    wait(driver).until(lambda d: payment_status(d) == "Belum Dibayar")
    assert "Sesi berlaku sampai" in body_text(driver)


# ---------------------------------------------------------------------------
# TS.PAY.005 Pembayaran terbayar
# ---------------------------------------------------------------------------

@tc("TC.PAY.005.001")
def test_tampilan_pembayaran_terbayar(case_id, driver, service_id, provider, customer_a):
    booking, payment = accepted_payment(customer_a, provider, service_id)
    open_payment(driver, customer_a, booking["id"])
    click_element(driver, button(driver, "Bayar Sekarang (Simulasi)"))
    alert = wait(driver).until(EC.alert_is_present())
    assert alert.text == "Konfirmasi pembayaran simulasi? Status pembayaran akan berubah menjadi lunas."
    alert.accept()
    wait(driver).until(lambda d: payment_status(d) == "Pembayaran Terbayar")
    assert payment_status(driver) == "Pembayaran Terbayar"
    assert "Pembayaran untuk booking ini sudah ditandai terbayar oleh administrator." in body_text(driver)
    assert not has_button(driver, "Bayar Sekarang (Simulasi)")
    assert not has_button(driver, "Batalkan Pembayaran")
    assert not has_button(driver, "Buat Sesi Baru")
