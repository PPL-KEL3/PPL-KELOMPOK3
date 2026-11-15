"""
PBI-13 / TPR-13: Pemesanan Jasa (sheet Excel "Booking & Service Requests"). Pemilik PBI: Arsya.

Satu fungsi tes = satu Case ID di Excel (lihat nama tes di output `pytest -v`).

Data uji:
- Jasa "[E2E] Jasa Booking" (+ paket "Dasar" Rp 150.000) milik E2E_PROVIDER_A dibuat sekali
  lalu dipakai ulang. Selama modul berjalan, profil penyedia A dibuat publik dengan jam
  operasional default (Senin-Jumat 08:00-17:00, Sabtu 08:00-12:00, Minggu tutup), lalu
  dikembalikan seperti semula setelah semua tes selesai, dan jasa dinonaktifkan.
- Booking dibuat oleh E2E_CUSTOMER_A / E2E_CUSTOMER_B pada tanggal acak jauh di depan
  (supaya slot tidak bentrok antar run). Booking yang masih menunggu konfirmasi dibatalkan
  setelah tiap tes. Booking berstatus diterima tidak bisa dibatalkan customer, jadi tetap tersimpan.
- Belum ada halaman penyedia untuk menerima booking, jadi status "Diterima Penyedia"
  disiapkan lewat API (POST /bookings/:id/accept sebagai penyedia).

Jalankan:  pytest test_tpr13_booking.py -v
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


def slot(start):
    end = f"{int(start[:2]) + 1:02d}.{start[3:]}"
    return f"{start}{DASH}{end}"


# Tanggal acak jauh di depan supaya slot tidak bentrok dengan run sebelumnya.
_BASE_WEEK = random.randint(10, 60)
_week_counter = [0]


def future_day(weekday):
    """weekday: 0=Senin ... 6=Minggu. Tiap pemanggilan memakai minggu yang berbeda."""
    _week_counter[0] += 1
    today = dt.date.today()
    start = today + dt.timedelta(weeks=_BASE_WEEK + _week_counter[0])
    return start + dt.timedelta(days=(weekday - start.weekday()) % 7)


# ---------------------------------------------------------------------------
# Helper API
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

    def me(self):
        return self.call("GET", "/auth/me")["user"]


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
def customer_b():
    return Api(*env_account("E2E_CUSTOMER_B"))


@pytest.fixture(scope="module")
def setup(provider):
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
    packages = provider.call("GET", f"/packages/mine?serviceId={service['id']}")["packages"]
    package = next((p for p in packages if p["name"] == "Dasar"), None)
    if package is None:
        package = provider.call("POST", "/packages", json={
            "serviceId": service["id"], "name": "Dasar", "description": "", "price": 150000, "isActive": True,
        })["package"]
    yield {"service": service, "package": package}
    provider.call("PATCH", f"/services/{service['id']}", json={"isActive": False})
    provider.call("PUT", "/providers/me", json=original)


@pytest.fixture(autouse=True)
def cancel_pending(request):
    yield
    for name in ("customer_a", "customer_b"):
        if name not in request.fixturenames:
            continue
        api = request.getfixturevalue(name)
        for booking in api.call("GET", "/bookings/mine")["bookings"]:
            if booking.get("serviceName") == SERVICE_NAME and booking["status"] == "pending_provider_confirmation":
                try:
                    api.call("POST", f"/bookings/{booking['id']}/cancel")
                except AssertionError as error:
                    print(f"Peringatan pembersihan booking: {error}")


def create_booking(customer, service_id, day, start, package_id=None):
    return customer.call("POST", "/bookings", json={
        "serviceId": service_id, "packageId": package_id,
        "workDate": day.isoformat(), "workTime": slot(start),
    })["booking"]


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


def css(driver, selector):
    return wait(driver).until(EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))


def body_text(driver):
    return norm(driver.find_element(By.TAG_NAME, "body").text)


def set_react_value(driver, element, value):
    driver.execute_script(
        "const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
        "setter.call(arguments[0], arguments[1]);"
        "arguments[0].dispatchEvent(new Event('input', { bubbles: true }));",
        element, value)


def open_form(driver, customer, service_id):
    login(driver, customer)
    driver.get(f"{BASE_URL}/customer/booking/new?serviceId={service_id}")
    return css(driver, "#booking-date")


def pick_date(driver, day):
    set_react_value(driver, driver.find_element(By.ID, "booking-date"), day.isoformat())


def slot_texts(driver):
    return [norm(b.text) for b in driver.find_elements(By.CSS_SELECTOR, ".booking-slot")]


def pick_slot(driver, start):
    wanted = slot(start)
    wait(driver).until(lambda d: wanted in slot_texts(d))
    for button in driver.find_elements(By.CSS_SELECTOR, ".booking-slot"):
        if norm(button.text) == wanted:
            button.click()
            return
    raise AssertionError(f"Slot {wanted} tidak ditemukan")


def pick_package(driver, name):
    for button in driver.find_elements(By.CSS_SELECTOR, ".booking-package"):
        if name in button.text:
            button.click()
            return
    raise AssertionError(f'Paket "{name}" tidak ditemukan')


def submit_button(driver):
    return driver.find_element(By.CSS_SELECTOR, ".booking-submit")


def submit(driver):
    submit_button(driver).click()


def wait_detail(driver):
    wait(driver).until(lambda d: "/customer/booking/" in d.current_url and "/new" not in d.current_url)
    wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, ".booking-status, .booking-state"))


def error_text(driver):
    return norm(css(driver, ".booking-error").text)


# ---------------------------------------------------------------------------
# TS.BOOK.001 Akses form
# ---------------------------------------------------------------------------

@tc("TC.BOOK.001.001")
def test_buka_form_dari_katalog(case_id, driver, setup, customer_a):
    login(driver, customer_a)
    driver.get(BASE_URL + "/customer/services")
    article = wait(driver).until(lambda d: next(
        (a for a in d.find_elements(By.CSS_SELECTOR, "article") if SERVICE_NAME in a.text), None))
    article.find_element(By.XPATH, ".//a[normalize-space()='Booking Sekarang']").click()
    wait(driver).until(EC.url_contains(f"/customer/booking/new?serviceId={setup['service']['id']}"))
    css(driver, "#booking-date")
    text = body_text(driver)
    assert "Buat Pemesanan Jasa" in text and "Ringkasan Jasa" in text and SERVICE_NAME in text


@tc("TC.BOOK.001.002")
def test_tamu_tidak_bisa_buka_form(case_id, driver, setup):
    driver.get(f"{BASE_URL}/customer/booking/new?serviceId={setup['service']['id']}")
    wait(driver).until(EC.url_contains("/login"))


# ---------------------------------------------------------------------------
# TS.BOOK.002 Jadwal
# ---------------------------------------------------------------------------

@tc("TC.BOOK.002.001")
def test_tombol_konfirmasi_nonaktif_tanpa_jadwal(case_id, driver, setup, customer_a):
    open_form(driver, customer_a, setup["service"]["id"])
    assert not submit_button(driver).is_enabled()


@tc("TC.BOOK.002.002")
def test_tanggal_hari_tutup(case_id, driver, setup, customer_a):
    open_form(driver, customer_a, setup["service"]["id"])
    pick_date(driver, future_day(6))
    assert error_text(driver) == "Penyedia tidak beroperasi pada tanggal tersebut. Pilih tanggal lain."
    assert not submit_button(driver).is_enabled()


@tc("TC.BOOK.002.003")
def test_slot_hari_kerja(case_id, driver, setup, customer_a):
    open_form(driver, customer_a, setup["service"]["id"])
    pick_date(driver, future_day(0))
    wait(driver).until(lambda d: slot_texts(d))
    slots = slot_texts(driver)
    assert slots[0] == slot("08.00") and slots[-1] == slot("16.00")
    assert slot("07.00") not in slots and slot("17.00") not in slots


@tc("TC.BOOK.002.004")
def test_slot_hari_sabtu(case_id, driver, setup, customer_a):
    open_form(driver, customer_a, setup["service"]["id"])
    pick_date(driver, future_day(5))
    wait(driver).until(lambda d: slot_texts(d))
    assert slot_texts(driver)[-1] == slot("11.00")


@tc("TC.BOOK.002.005")
def test_tanggal_kemarin_ditolak(case_id, driver, setup, customer_a):
    yesterday = dt.date.today() - dt.timedelta(days=1)
    if yesterday.weekday() == 6:
        pytest.skip("Kemarin hari Minggu (penyedia tutup); jalankan di hari lain")
    open_form(driver, customer_a, setup["service"]["id"])
    pick_date(driver, yesterday)
    pick_slot(driver, "08.00")
    submit(driver)
    assert error_text(driver) == "Tanggal pengerjaan tidak boleh berada di masa lalu."
    assert "/customer/booking/new" in driver.current_url


@tc("TC.BOOK.002.006")
def test_tanggal_hari_ini_diterima(case_id, driver, setup, customer_a):
    now = dt.datetime.now()
    close_hour = 12 if now.weekday() == 5 else 17
    if now.weekday() == 6 or now.hour >= close_hour - 1:
        pytest.skip("Tidak ada slot tersisa hari ini; jalankan di hari kerja sebelum jam tutup")
    open_form(driver, customer_a, setup["service"]["id"])
    pick_date(driver, dt.date.today())
    pick_slot(driver, f"{close_hour - 1:02d}.00")
    submit(driver)
    wait_detail(driver)
    assert "Menunggu Konfirmasi Penyedia" in body_text(driver)


# ---------------------------------------------------------------------------
# TS.BOOK.003 Membuat booking
# ---------------------------------------------------------------------------

@pytest.mark.alur_utama
@tc("TC.BOOK.003.001")
def test_booking_tanpa_paket(case_id, driver, setup, customer_a):
    open_form(driver, customer_a, setup["service"]["id"])
    pick_date(driver, future_day(0))
    pick_slot(driver, "08.00")
    submit(driver)
    wait_detail(driver)
    text = body_text(driver)
    assert "Menunggu Konfirmasi Penyedia" in text
    assert "Booking sedang menunggu konfirmasi penyedia jasa." in text
    assert "Rp 100.000" in text


@tc("TC.BOOK.003.002")
def test_booking_dengan_paket(case_id, driver, setup, customer_a):
    open_form(driver, customer_a, setup["service"]["id"])
    pick_package(driver, "Dasar")
    wait(driver).until(lambda d: "Dasar" in norm(d.find_element(By.CSS_SELECTOR, ".booking-summary").text))
    assert "Rp 150.000" in norm(driver.find_element(By.CSS_SELECTOR, ".booking-summary").text)
    pick_date(driver, future_day(1))
    pick_slot(driver, "09.00")
    submit(driver)
    wait_detail(driver)
    text = body_text(driver)
    assert "Dasar" in text and "Rp 150.000" in text


@tc("TC.BOOK.003.003")
def test_slot_sudah_dipesan_ditolak(case_id, driver, setup, customer_a, customer_b):
    day = future_day(0)
    create_booking(customer_b, setup["service"]["id"], day, "10.00")
    open_form(driver, customer_a, setup["service"]["id"])
    pick_date(driver, day)
    pick_slot(driver, "10.00")
    submit(driver)
    assert error_text(driver) == "Jadwal yang kamu pilih sudah tidak tersedia. Silakan pilih waktu lain."


@tc("TC.BOOK.003.004")
def test_ganti_tanggal_mereset_slot(case_id, driver, setup, customer_a):
    open_form(driver, customer_a, setup["service"]["id"])
    pick_date(driver, future_day(0))
    pick_slot(driver, "08.00")
    assert submit_button(driver).is_enabled()
    pick_date(driver, future_day(2))
    wait(driver).until(lambda d: not d.find_elements(By.CSS_SELECTOR, ".booking-slot.is-selected"))
    assert not submit_button(driver).is_enabled()


# ---------------------------------------------------------------------------
# TS.BOOK.004 Pembatalan
# ---------------------------------------------------------------------------

def open_detail(driver, customer, booking_id):
    login(driver, customer)
    driver.get(f"{BASE_URL}/customer/booking/{booking_id}")
    wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, ".booking-status, .booking-state"))


@tc("TC.BOOK.004.001")
def test_batalkan_booking_menunggu(case_id, driver, setup, customer_a):
    booking = create_booking(customer_a, setup["service"]["id"], future_day(0), "13.00")
    open_detail(driver, customer_a, booking["id"])
    css(driver, ".booking-cancel").click()
    alert = wait(driver).until(EC.alert_is_present())
    assert alert.text == "Batalkan booking ini?"
    alert.accept()
    wait(driver).until(lambda d: "Booking berhasil dibatalkan." in norm(d.find_element(By.CSS_SELECTOR, ".toast-stack").text))
    wait(driver).until(lambda d: "Dibatalkan" in norm(d.find_element(By.CSS_SELECTOR, ".booking-status").text))


@tc("TC.BOOK.004.002")
def test_batal_membatalkan_booking(case_id, driver, setup, customer_a):
    booking = create_booking(customer_a, setup["service"]["id"], future_day(0), "14.00")
    open_detail(driver, customer_a, booking["id"])
    css(driver, ".booking-cancel").click()
    wait(driver).until(EC.alert_is_present()).dismiss()
    assert "Menunggu Konfirmasi Penyedia" in norm(css(driver, ".booking-status").text)


@tc("TC.BOOK.004.003")
def test_booking_diterima_tidak_bisa_dibatalkan(case_id, driver, setup, provider, customer_a):
    booking = create_booking(customer_a, setup["service"]["id"], future_day(0), "15.00")
    provider.call("POST", f"/bookings/{booking['id']}/accept")
    open_detail(driver, customer_a, booking["id"])
    assert "Diterima Penyedia" in norm(css(driver, ".booking-status").text)
    assert not driver.find_elements(By.CSS_SELECTOR, ".booking-cancel")


# ---------------------------------------------------------------------------
# TS.BOOK.005 Akses detail
# ---------------------------------------------------------------------------

@tc("TC.BOOK.005.001")
def test_tidak_bisa_buka_booking_customer_lain(case_id, driver, setup, customer_a, customer_b):
    booking = create_booking(customer_b, setup["service"]["id"], future_day(0), "16.00")
    open_detail(driver, customer_a, booking["id"])
    wait(driver).until(lambda d: "Booking tidak ditemukan" in body_text(d))
    assert not driver.find_elements(By.CSS_SELECTOR, ".booking-status")


@tc("TC.BOOK.005.002")
def test_detail_booking_id_tidak_terdaftar(case_id, driver, customer_a):
    open_detail(driver, customer_a, "99999999-9999-4999-8999-999999999999")
    wait(driver).until(lambda d: "Booking tidak ditemukan" in body_text(d))
    assert driver.find_element(By.XPATH, "//a[contains(normalize-space(),'Dashboard Customer')]")
