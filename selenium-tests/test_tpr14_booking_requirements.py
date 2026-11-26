"""
PBI-14 / TPR-14: Kebutuhan dan Foto Referensi Booking (sheet Excel "Booking & Service Requests").
Pemilik PBI: Arsya.

Satu fungsi tes = satu Case ID di Excel (lihat nama tes di output `pytest -v`).

Data uji:
- Sama seperti test_tpr13_booking.py: jasa "[E2E] Jasa Booking" milik E2E_PROVIDER_A,
  profil penyedia dibuat publik dengan jam default selama modul, lalu dikembalikan.
- Booking dibuat lewat form oleh E2E_CUSTOMER_A pada tanggal acak jauh di depan, lalu
  dibatalkan setelah tiap tes.
- File uji (JPG, PNG, WEBP, GIF, PDF, file 0 byte) dibuat otomatis di folder _files/.

Jalankan:  pytest test_tpr14_booking_requirements.py -v
"""

import datetime as dt
import io
import os
import pathlib
import random

import pytest
import requests
from PIL import Image
from selenium import webdriver
from selenium.common.exceptions import ElementClickInterceptedException
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
FILES = pathlib.Path(__file__).with_name("_files")
DASH = "–"
FORMAT_ERROR = "Format foto tidak didukung atau file kosong."
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
    return f"{start}{DASH}{int(start[:2]) + 1:02d}.{start[3:]}"


_BASE_WEEK = random.randint(10, 60)
_week_counter = [0]


def future_monday():
    _week_counter[0] += 1
    start = dt.date.today() + dt.timedelta(weeks=_BASE_WEEK + _week_counter[0])
    return start + dt.timedelta(days=(0 - start.weekday()) % 7)


# ---------------------------------------------------------------------------
# File uji
# ---------------------------------------------------------------------------

def make_file(name, fmt=None, content=None):
    FILES.mkdir(exist_ok=True)
    if content is None:
        buffer = io.BytesIO()
        Image.new("RGB", (320, 240), (120, 80, 40)).save(buffer, format=fmt)
        content = buffer.getvalue()
    path = FILES / name
    path.write_bytes(content)
    return str(path.resolve())


@pytest.fixture(scope="module")
def files():
    return {
        "atap.jpg": make_file("atap.jpg", "JPEG"),
        "dinding.png": make_file("dinding.png", "PNG"),
        "lokasi.webp": make_file("lokasi.webp", "WEBP"),
        "animasi.gif": make_file("animasi.gif", "GIF"),
        "dokumen.pdf": make_file("dokumen.pdf", content=b"%PDF-1.4\n% E2E\n%%EOF\n"),
        "kosong.png": make_file("kosong.png", content=b""),
    }


# ---------------------------------------------------------------------------
# Helper API dan setup
# ---------------------------------------------------------------------------

class Api:
    def __init__(self, email, password):
        self.session = requests.Session()
        self.call("POST", "/auth/login", json={"email": email, "password": password})

    def call(self, method, path, **kwargs):
        response = self.session.request(method, API_URL + path, timeout=60, **kwargs)
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
def customer_a():
    return Api(*env_account("E2E_CUSTOMER_A"))


@pytest.fixture(scope="module")
def service_id():
    provider = Api(*env_account("E2E_PROVIDER_A"))
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


@pytest.fixture(autouse=True)
def cancel_pending(customer_a):
    yield
    for booking in customer_a.call("GET", "/bookings/mine")["bookings"]:
        if booking.get("serviceName") == SERVICE_NAME and booking["status"] == "pending_provider_confirmation":
            try:
                customer_a.call("POST", f"/bookings/{booking['id']}/cancel")
            except AssertionError as error:
                print(f"Peringatan pembersihan booking: {error}")


@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--window-size=1366,1200")
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


def wait(driver, seconds=WAIT):
    return WebDriverWait(driver, seconds)


def css(driver, selector):
    return wait(driver).until(EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))


def set_react_value(driver, element, value):
    driver.execute_script(
        "const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
        "setter.call(arguments[0], arguments[1]);"
        "arguments[0].dispatchEvent(new Event('input', { bubbles: true }));",
        element, value)


def open_form(driver, customer, service_id):
    login(driver, customer)
    driver.get(f"{BASE_URL}/customer/booking/new?serviceId={service_id}")
    css(driver, "#booking-date")


def pick_schedule(driver, start="11.00"):
    set_react_value(driver, driver.find_element(By.ID, "booking-date"), future_monday().isoformat())
    wanted = slot(start)
    button = wait(driver).until(lambda d: next(
        (b for b in d.find_elements(By.CSS_SELECTOR, ".booking-slot") if norm(b.text) == wanted), None))
    driver.execute_script(
        "arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});",
        button,
    )
    try:
        button.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", button)


def notes_field(driver):
    return driver.find_element(By.CSS_SELECTOR, "textarea[placeholder^='Jelaskan secara detail']")


def choose_files(driver, *paths):
    driver.find_element(By.CSS_SELECTOR, ".booking-file-input").send_keys("\n".join(paths))


def preview_count(driver):
    return len(driver.find_elements(By.CSS_SELECTOR, ".booking-photo-grid .booking-photo"))


def submit_and_open_detail(driver):
    button = driver.find_element(By.CSS_SELECTOR, ".booking-submit")
    driver.execute_script(
        "arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});",
        button,
    )
    wait(driver).until(lambda d: d.find_element(By.CSS_SELECTOR, ".booking-submit").is_enabled())
    try:
        button.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", button)
    wait(driver, 60).until(lambda d: "/customer/booking/" in d.current_url and "/new" not in d.current_url)
    wait(driver, 30).until(lambda d: "Detail Kebutuhan Pekerjaan" in d.find_element(By.TAG_NAME, "body").text)


def detail_text(driver):
    return norm(driver.find_element(By.TAG_NAME, "body").text)


def detail_photo_count(driver):
    return len(driver.find_elements(By.CSS_SELECTOR, ".booking-photo-grid .booking-photo"))


# ---------------------------------------------------------------------------
# TS.REQ.001 Mengirim kebutuhan bersama booking
# ---------------------------------------------------------------------------

@tc("TC.REQ.001.001")
def test_booking_dengan_catatan_tanpa_foto(case_id, driver, service_id, customer_a):
    open_form(driver, customer_a, service_id)
    pick_schedule(driver)
    notes_field(driver).send_keys("Atap bocor di ruang tamu dekat jendela.")
    submit_and_open_detail(driver)
    text = detail_text(driver)
    assert "Atap bocor di ruang tamu dekat jendela." in text
    assert "Belum ada foto referensi yang tersimpan." in text


@pytest.mark.alur_utama
@tc("TC.REQ.001.002")
def test_booking_dengan_satu_foto_jpg(case_id, driver, service_id, customer_a, files):
    open_form(driver, customer_a, service_id)
    pick_schedule(driver)
    notes_field(driver).send_keys("Atap bocor di ruang tamu dekat jendela.")
    choose_files(driver, files["atap.jpg"])
    wait(driver).until(lambda d: preview_count(d) == 1)
    submit_and_open_detail(driver)
    wait(driver, 30).until(lambda d: detail_photo_count(d) == 1)


@tc("TC.REQ.001.003")
def test_booking_dengan_tiga_format_foto(case_id, driver, service_id, customer_a, files):
    open_form(driver, customer_a, service_id)
    pick_schedule(driver)
    choose_files(driver, files["atap.jpg"], files["dinding.png"], files["lokasi.webp"])
    wait(driver).until(lambda d: preview_count(d) == 3)
    submit_and_open_detail(driver)
    wait(driver, 30).until(lambda d: detail_photo_count(d) == 3)


@tc("TC.REQ.001.004")
def test_booking_dengan_foto_tanpa_catatan(case_id, driver, service_id, customer_a, files):
    open_form(driver, customer_a, service_id)
    pick_schedule(driver)
    choose_files(driver, files["atap.jpg"])
    wait(driver).until(lambda d: preview_count(d) == 1)
    submit_and_open_detail(driver)
    wait(driver, 30).until(lambda d: detail_photo_count(d) == 1)
    assert "Belum ada catatan kebutuhan yang tersimpan." in detail_text(driver)


@tc("TC.REQ.001.005")
def test_booking_tanpa_catatan_dan_foto(case_id, driver, service_id, customer_a):
    open_form(driver, customer_a, service_id)
    pick_schedule(driver)
    submit_and_open_detail(driver)
    text = detail_text(driver)
    assert "Belum ada catatan kebutuhan yang tersimpan." in text
    assert "Belum ada foto referensi yang tersimpan." in text


# ---------------------------------------------------------------------------
# TS.REQ.002 Hapus preview
# ---------------------------------------------------------------------------

@tc("TC.REQ.002.001")
def test_hapus_foto_dari_preview(case_id, driver, service_id, customer_a, files):
    open_form(driver, customer_a, service_id)
    choose_files(driver, files["atap.jpg"], files["dinding.png"])
    wait(driver).until(lambda d: preview_count(d) == 2)
    remove_button = driver.find_element(By.CSS_SELECTOR, "[aria-label='Hapus dinding.png']")
    driver.execute_script(
        "arguments[0].scrollIntoView({block: 'center', inline: 'nearest'});",
        remove_button,
    )
    try:
        remove_button.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", remove_button)
    wait(driver).until(lambda d: preview_count(d) == 1)
    assert driver.find_elements(By.CSS_SELECTOR, "[aria-label='Hapus atap.jpg']")
    pick_schedule(driver)
    submit_and_open_detail(driver)
    wait(driver, 30).until(lambda d: detail_photo_count(d) == 1)


# ---------------------------------------------------------------------------
# TS.REQ.003 Validasi file
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,file_key", [
    ("TC.REQ.003.001", "animasi.gif"),
    ("TC.REQ.003.002", "dokumen.pdf"),
    ("TC.REQ.003.003", "kosong.png"),
], ids=["TC.REQ.003.001", "TC.REQ.003.002", "TC.REQ.003.003"])
def test_file_ditolak(case_id, file_key, driver, service_id, customer_a, files):
    open_form(driver, customer_a, service_id)
    choose_files(driver, files[file_key])
    wait(driver).until(lambda d: any(FORMAT_ERROR in norm(e.text) for e in d.find_elements(By.CSS_SELECTOR, ".booking-error")))
    assert preview_count(driver) == 0


# ---------------------------------------------------------------------------
# TS.REQ.004 Melihat kembali detail kebutuhan
# ---------------------------------------------------------------------------

@tc("TC.REQ.004.001")
def test_detail_kebutuhan_untuk_pemilik(case_id, driver, service_id, customer_a, files):
    open_form(driver, customer_a, service_id)
    pick_schedule(driver)
    notes_field(driver).send_keys("Atap bocor di ruang tamu dekat jendela.")
    choose_files(driver, files["atap.jpg"])
    submit_and_open_detail(driver)
    wait(driver, 30).until(lambda d: detail_photo_count(d) == 1)
    driver.refresh()
    wait(driver, 30).until(lambda d: detail_photo_count(d) == 1)
    assert "Atap bocor di ruang tamu dekat jendela." in detail_text(driver)
