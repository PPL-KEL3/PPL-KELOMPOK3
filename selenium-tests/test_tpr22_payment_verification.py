"""
PBI-22 / TPR-22: Verifikasi Pembayaran (sheet Excel "Payment & Transaction"). Pemilik PBI: Geraldo.

Satu fungsi tes = satu Case ID di Excel (lihat nama tes di output `pytest -v`).

Flow terbaru yang diuji:
- Admin melihat antrean payment aktual.
- Admin melihat ringkasan status pembayaran.
- Akses non-admin tetap ditolak.
Kasus verifikasi dibuat dari payment yang membutuhkan pemeriksaan dan dikelola
melalui status kasus pada halaman admin.

Jalankan:  pytest test_tpr22_payment_verification.py -v
"""

import os
import pathlib

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
PAGE = "/admin/payments/verification"


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


class Api:
    def __init__(self, email, password):
        self.session = requests.Session()
        response = self.session.post(API_URL + "/auth/login", json={"email": email, "password": password}, timeout=30)
        assert response.ok, f"Login gagal ({response.status_code}): {response.text}"


@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--window-size=1366,900")
    if os.getenv("HEADLESS") == "1":
        options.add_argument("--headless=new")
    browser = webdriver.Chrome(options=options)
    yield browser
    browser.quit()


def login(driver, api):
    driver.get(BASE_URL + "/login")
    for cookie in api.session.cookies:
        driver.add_cookie({"name": cookie.name, "value": cookie.value, "path": "/"})


def wait(driver):
    return WebDriverWait(driver, WAIT)


def body_text(driver):
    return norm(driver.find_element(By.TAG_NAME, "body").text)


def open_as_admin(driver):
    login(driver, Api(*env_account("E2E_ADMIN")))
    driver.get(BASE_URL + PAGE)
    wait(driver).until(lambda d: "Antrean Verifikasi Pembayaran" in body_text(d))


# ---------------------------------------------------------------------------
# TS.PAYVER.001 Halaman antrean (admin)
# ---------------------------------------------------------------------------

@pytest.mark.alur_utama
@tc("TC.PAYVER.001.001")
def test_admin_buka_antrean(case_id, driver):
    open_as_admin(driver)
    text = body_text(driver)
    for label in ("Total Pembayaran", "Menunggu Verifikasi", "Sudah Lunas", "Sesi Tidak Aktif"):
        assert label in text, f"Ringkasan '{label}' tidak tampil"


@tc("TC.PAYVER.001.002")
def test_tampilan_antrean_pembayaran(case_id, driver):
    open_as_admin(driver)
    text = body_text(driver)
    assert "Daftar Pembayaran Customer" in text
    assert "KONTROL PEMBAYARAN" in text
    assert "Antrean belum tersedia" not in text


@tc("TC.PAYVER.001.003")
def test_kembali_ke_dashboard_admin(case_id, driver):
    open_as_admin(driver)
    wait(driver).until(EC.element_to_be_clickable(
        (By.XPATH, "//a[normalize-space()='Kembali ke Dashboard Admin']"))).click()
    wait(driver).until(EC.url_contains("/admin/dashboard"))


# ---------------------------------------------------------------------------
# TS.PAYVER.002 Pembatasan akses
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,account,expected_path", [
    ("TC.PAYVER.002.001", "E2E_CUSTOMER_A", "/customer"),
    ("TC.PAYVER.002.002", "E2E_PROVIDER_A", "/provider"),
], ids=["TC.PAYVER.002.001", "TC.PAYVER.002.002"])
def test_bukan_admin_dialihkan(case_id, account, expected_path, driver):
    login(driver, Api(*env_account(account)))
    driver.get(BASE_URL + PAGE)
    wait(driver).until(lambda d: PAGE not in d.current_url)
    assert expected_path in driver.current_url


@tc("TC.PAYVER.002.003")
def test_tamu_dialihkan_ke_login(case_id, driver):
    driver.get(BASE_URL + PAGE)
    wait(driver).until(EC.url_contains("/login"))
