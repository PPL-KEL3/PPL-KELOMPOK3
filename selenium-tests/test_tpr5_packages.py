"""
PBI-05 / TPR-5: Paket & Harga Layanan (sheet Excel "Service Offering").

Satu fungsi tes = satu Case ID di Excel. Nama tes di output pytest berbentuk
`test_xxx[TC.PKG.004.003]`, jadi hasil `pytest -v` bisa langsung dipindah ke kolom Status.

Data uji:
- Semua paket dibuat di dalam satu jasa khusus bernama "[E2E] Jasa Paket" milik akun
  penyedia uji (E2E_PROVIDER_A). Sebelum tiap tes, semua paket di jasa itu dihapus
  supaya tiap tes mulai dari kondisi bersih.
- Setelah semua tes selesai, paket dihapus dan jasa "[E2E] Jasa Paket" dinonaktifkan
  (jasa tidak bisa dihapus permanen karena tabel paket memakai ON DELETE RESTRICT).

Jalankan:  pytest test_tpr5_packages.py -v
Satu kasus: pytest test_tpr5_packages.py -v -k "TC.PKG.004.003"
"""

import os
import pathlib

import pytest
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait


# ---------------------------------------------------------------------------
# Konfigurasi
# ---------------------------------------------------------------------------

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
SERVICE_NAME = "[E2E] Jasa Paket"



def env_account(prefix):
    email = os.getenv(f"{prefix}_EMAIL")
    password = os.getenv(f"{prefix}_PASSWORD")
    if not email or not password:
        pytest.skip(f"Akun {prefix}_EMAIL / {prefix}_PASSWORD belum diisi di selenium-tests/.env")
    return email, password


def tc(case_id):
    """Menamai tes persis dengan Case ID di Excel."""
    return pytest.mark.parametrize("case_id", [case_id], ids=[case_id])


# ---------------------------------------------------------------------------
# Helper API (menyiapkan dan membersihkan data, bukan bagian yang diuji)
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

    def services(self):
        return self.call("GET", "/services/mine")["services"]

    def packages(self, service_id):
        return self.call("GET", f"/packages/mine?serviceId={service_id}")["packages"]

    def add_package(self, service_id, name, price, description="", active=True):
        return self.call("POST", "/packages", json={
            "serviceId": service_id, "name": name, "description": description,
            "price": price, "isActive": active,
        })["package"]

    def delete_package(self, package_id):
        self.call("DELETE", f"/packages/{package_id}")

    def clear_packages(self, service_id):
        for item in self.packages(service_id):
            self.delete_package(item["id"])


def ensure_e2e_service(api):
    for service in api.services():
        if service["name"] == SERVICE_NAME:
            if not service.get("isActive", True):
                api.call("PATCH", f"/services/{service['id']}", json={"isActive": True})
            return service["id"]
    categories = api.call("GET", "/categories")["categories"]
    if not categories:
        pytest.skip("Belum ada kategori jasa di database")
    created = api.call("POST", "/services", json={
        "categoryId": categories[0]["id"],
        "name": SERVICE_NAME,
        "description": "Jasa khusus pengujian otomatis Selenium. Aman diabaikan.",
        "price": 100000,
        "isActive": True,
    })
    return created["service"]["id"]


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def api_a():
    return Api(*env_account("E2E_PROVIDER_A"))


@pytest.fixture(scope="module")
def service_id(api_a):
    sid = ensure_e2e_service(api_a)
    yield sid
    try:
        api_a.clear_packages(sid)
        api_a.call("PATCH", f"/services/{sid}", json={"isActive": False})
    except AssertionError as error:
        print(f"Peringatan pembersihan data: {error}")


@pytest.fixture(autouse=True)
def clean_packages(api_a, service_id):
    api_a.clear_packages(service_id)
    yield


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
    """Masuk memakai sesi dari API (cookie httpOnly loka_at / loka_rt)."""
    driver.get(BASE_URL + "/login")
    for cookie in api.session.cookies:
        driver.add_cookie({"name": cookie.name, "value": cookie.value, "path": "/"})


def wait(driver):
    return WebDriverWait(driver, WAIT)


def tid(driver, name):
    return wait(driver).until(EC.visibility_of_element_located((By.CSS_SELECTOR, f"[data-testid='{name}']")))


def all_tid(driver, name):
    return driver.find_elements(By.CSS_SELECTOR, f"[data-testid='{name}']")


def wait_gone(driver, name):
    wait(driver).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, f"[data-testid='{name}']")))


def toast(driver, text):
    wait(driver).until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, ".toast-stack"), text))


def open_packages(driver, service_id):
    driver.get(f"{BASE_URL}/provider/dashboard/packages?serviceId={service_id}")
    wait(driver).until(lambda d: all_tid(d, "pkg-card") or all_tid(d, "pkg-state"))


def card(driver, name):
    for element in all_tid(driver, "pkg-card"):
        if element.find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-name']").text == name:
            return element
    raise AssertionError(f'Kartu paket "{name}" tidak ditemukan')


def card_names(driver):
    return [e.text for e in all_tid(driver, "pkg-card-name")]


def type_into(element, text):
    element.send_keys(Keys.CONTROL, "a")
    element.send_keys(Keys.DELETE)
    if text:
        element.send_keys(text)


def open_add_modal(driver):
    tid(driver, "pkg-add").click()
    tid(driver, "pkg-form-modal")


def fill_form(driver, name=None, price=None, description=None, active=None):
    if name is not None:
        type_into(driver.find_element(By.ID, "package-name-input"), name)
    if price is not None:
        type_into(driver.find_element(By.ID, "package-price-input"), price)
    if description is not None:
        type_into(driver.find_element(By.ID, "package-description-input"), description)
    if active is not None:
        checkbox = driver.find_element(By.CSS_SELECTOR, "[data-testid='pkg-form-active']")
        if checkbox.is_selected() != active:
            checkbox.click()


def submit(driver):
    tid(driver, "pkg-form-submit").click()


def assert_field_error(driver, message):
    wait(driver).until(EC.text_to_be_present_in_element(
        (By.CSS_SELECTOR, "[data-testid='pkg-form-modal']"), message))
    errors = [e.text for e in all_tid(driver, "pkg-field-error")]
    assert any(message in text for text in errors), f"Pesan '{message}' tidak muncul. Ditemukan: {errors}"
    assert all_tid(driver, "pkg-form-modal"), "Modal seharusnya tetap terbuka (paket tidak tersimpan)"


def add_and_expect_saved(driver, service_id, name, price, description="", expected_price=None):
    open_packages(driver, service_id)
    open_add_modal(driver)
    fill_form(driver, name=name, price=price, description=description)
    submit(driver)
    wait_gone(driver, "pkg-form-modal")
    toast(driver, f'Paket "{name}" berhasil ditambahkan.')
    saved = card(driver, name)
    if expected_price:
        assert saved.find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-price']").text == expected_price
    return saved


# ---------------------------------------------------------------------------
# TS.PKG.001 Akses & tampilan
# ---------------------------------------------------------------------------

@tc("TC.PKG.001.001")
def test_akses_halaman_dari_sidebar(case_id, driver, api_a, service_id):
    login(driver, api_a)
    driver.get(BASE_URL + "/provider/dashboard")
    menu = wait(driver).until(EC.element_to_be_clickable(
        (By.CSS_SELECTOR, "a[href='/provider/dashboard/packages']")))
    menu.click()
    wait(driver).until(EC.url_contains("/provider/dashboard/packages"))
    wait(driver).until(EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Paket & Harga Layanan"))
    active = driver.find_element(By.CSS_SELECTOR, "a[href='/provider/dashboard/packages']")
    assert active.get_attribute("aria-current") == "page"


@tc("TC.PKG.001.002")
def test_penyedia_belum_punya_jasa(case_id, driver):
    api_empty = Api(*env_account("E2E_PROVIDER_EMPTY"))
    if api_empty.services():
        pytest.skip("Akun E2E_PROVIDER_EMPTY harus tidak punya jasa")
    login(driver, api_empty)
    driver.get(BASE_URL + "/provider/dashboard/packages")
    assert tid(driver, "pkg-state-title").text == "Kamu belum punya jasa."
    assert driver.find_element(By.XPATH, "//a[normalize-space()='Buat Jasa']").is_displayed()
    assert not tid(driver, "pkg-add").is_enabled()


@tc("TC.PKG.001.003")
def test_jasa_belum_punya_paket(case_id, driver, api_a, service_id):
    login(driver, api_a)
    driver.get(BASE_URL + "/provider/dashboard/packages")
    select = wait(driver).until(EC.visibility_of_element_located((By.ID, "pkg-service-select")))
    Select(select).select_by_value(service_id)
    wait(driver).until(EC.text_to_be_present_in_element(
        (By.CSS_SELECTOR, "[data-testid='pkg-state-title']"), "Belum ada paket untuk jasa ini."))
    assert tid(driver, "pkg-empty-add").is_displayed()


# ---------------------------------------------------------------------------
# TS.PKG.002 Tambah paket
# ---------------------------------------------------------------------------

@pytest.mark.alur_utama
@tc("TC.PKG.002.001")
def test_tambah_paket_aktif_valid(case_id, driver, api_a, service_id):
    login(driver, api_a)
    open_packages(driver, service_id)
    open_add_modal(driver)
    fill_form(driver, name="Dasar", price="150000",
              description="Cek kebocoran dan tambal titik bocor ringan.", active=True)
    submit(driver)
    wait_gone(driver, "pkg-form-modal")
    toast(driver, 'Paket "Dasar" berhasil ditambahkan.')
    saved = card(driver, "Dasar")
    assert saved.find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-status']").text == "Aktif"
    assert saved.find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-price']").text == "Rp 150.000"


@tc("TC.PKG.002.002")
def test_tambah_paket_nonaktif_tanpa_deskripsi(case_id, driver, api_a, service_id):
    login(driver, api_a)
    open_packages(driver, service_id)
    open_add_modal(driver)
    fill_form(driver, name="Berkala", price="500000", description="", active=False)
    submit(driver)
    wait_gone(driver, "pkg-form-modal")
    saved = card(driver, "Berkala")
    assert saved.find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-status']").text == "Nonaktif"


@tc("TC.PKG.002.003")
def test_daftar_urut_harga_termurah(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Lengkap", 350000)
    api_a.add_package(service_id, "Dasar", 150000)
    login(driver, api_a)
    open_packages(driver, service_id)
    prices = [e.text for e in all_tid(driver, "pkg-card-price")]
    assert prices == ["Rp 150.000", "Rp 350.000"]


# ---------------------------------------------------------------------------
# TS.PKG.003 Validasi nama
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,name,message", [
    ("TC.PKG.003.001", "   ", "Nama paket wajib diisi."),
    ("TC.PKG.003.002", "ab", "Nama paket minimal 3 karakter."),
], ids=["TC.PKG.003.001", "TC.PKG.003.002"])
def test_nama_ditolak(case_id, name, message, driver, api_a, service_id):
    login(driver, api_a)
    open_packages(driver, service_id)
    open_add_modal(driver)
    fill_form(driver, name=name, price="150000")
    submit(driver)
    assert_field_error(driver, message)


@pytest.mark.parametrize("case_id,name", [
    ("TC.PKG.003.003", "Abc"),
    ("TC.PKG.003.004", "A" * 100),
], ids=["TC.PKG.003.003", "TC.PKG.003.004"])
def test_nama_batas_diterima(case_id, name, driver, api_a, service_id):
    login(driver, api_a)
    saved = add_and_expect_saved(driver, service_id, name, "150000")
    assert len(saved.find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-name']").text) == len(name)


@tc("TC.PKG.003.005")
def test_nama_101_karakter_terpotong(case_id, driver, api_a, service_id):
    login(driver, api_a)
    open_packages(driver, service_id)
    open_add_modal(driver)
    field = driver.find_element(By.ID, "package-name-input")
    field.send_keys("A" * 101)
    assert len(field.get_attribute("value")) == 100


@tc("TC.PKG.003.006")
def test_nama_duplikat_ditolak(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Dasar", 150000)
    login(driver, api_a)
    open_packages(driver, service_id)
    open_add_modal(driver)
    fill_form(driver, name="dasar", price="150000")
    submit(driver)
    assert_field_error(driver, "Nama paket sudah dipakai di jasa ini.")


# ---------------------------------------------------------------------------
# TS.PKG.004 Validasi harga (BVA tiga nilai)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,price,message", [
    ("TC.PKG.004.001", "", "Harga paket wajib diisi."),
    ("TC.PKG.004.003", "999", "Harga minimal Rp 1.000."),
    ("TC.PKG.004.008", "100000001", "Harga maksimal Rp 100.000.000."),
], ids=["TC.PKG.004.001", "TC.PKG.004.003", "TC.PKG.004.008"])
def test_harga_ditolak(case_id, price, message, driver, api_a, service_id):
    login(driver, api_a)
    open_packages(driver, service_id)
    open_add_modal(driver)
    fill_form(driver, name="Hemat", price=price)
    submit(driver)
    assert_field_error(driver, message)


@tc("TC.PKG.004.002")
def test_harga_hanya_menerima_angka(case_id, driver, api_a, service_id):
    login(driver, api_a)
    open_packages(driver, service_id)
    open_add_modal(driver)
    field = driver.find_element(By.ID, "package-price-input")
    field.send_keys("1500,5")
    assert field.get_attribute("value") == "15.005"


@pytest.mark.parametrize("case_id,name,price,shown", [
    ("TC.PKG.004.004", "Hemat", "1000", "Rp 1.000"),
    ("TC.PKG.004.005", "Hemat Plus", "1001", "Rp 1.001"),
    ("TC.PKG.004.006", "Premium", "99999999", "Rp 99.999.999"),
    ("TC.PKG.004.007", "Premium Plus", "100000000", "Rp 100.000.000"),
], ids=["TC.PKG.004.004", "TC.PKG.004.005", "TC.PKG.004.006", "TC.PKG.004.007"])
def test_harga_batas_diterima(case_id, name, price, shown, driver, api_a, service_id):
    login(driver, api_a)
    add_and_expect_saved(driver, service_id, name, price, expected_price=shown)


# ---------------------------------------------------------------------------
# TS.PKG.005 Validasi deskripsi
# ---------------------------------------------------------------------------

@tc("TC.PKG.005.001")
def test_deskripsi_500_diterima(case_id, driver, api_a, service_id):
    login(driver, api_a)
    saved = add_and_expect_saved(driver, service_id, "Lengkap", "350000", description="D" * 500)
    assert len(saved.find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-desc']").text) == 500


@tc("TC.PKG.005.002")
def test_deskripsi_501_terpotong(case_id, driver, api_a, service_id):
    login(driver, api_a)
    open_packages(driver, service_id)
    open_add_modal(driver)
    field = driver.find_element(By.ID, "package-description-input")
    field.send_keys("D" * 501)
    assert len(field.get_attribute("value")) == 500


# ---------------------------------------------------------------------------
# TS.PKG.006 Batas jumlah paket
# ---------------------------------------------------------------------------

@tc("TC.PKG.006.001")
def test_tambah_paket_ke_10(case_id, driver, api_a, service_id):
    for index in range(1, 10):
        api_a.add_package(service_id, f"Paket {index:02d}", 100000 + index)
    login(driver, api_a)
    add_and_expect_saved(driver, service_id, "Paket 10", "200000")
    assert not tid(driver, "pkg-add").is_enabled()


@tc("TC.PKG.006.002")
def test_tidak_bisa_tambah_paket_ke_11(case_id, driver, api_a, service_id):
    for index in range(1, 11):
        api_a.add_package(service_id, f"Paket {index:02d}", 100000 + index)
    login(driver, api_a)
    open_packages(driver, service_id)
    assert not tid(driver, "pkg-add").is_enabled()
    assert tid(driver, "pkg-limit-notice").text == \
        "Maksimal 10 paket per jasa. Hapus paket lama untuk menambah yang baru."


# ---------------------------------------------------------------------------
# TS.PKG.007 Edit
# ---------------------------------------------------------------------------

@tc("TC.PKG.007.001")
def test_edit_paket_berhasil(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Lengkap", 350000)
    login(driver, api_a)
    open_packages(driver, service_id)
    card(driver, "Lengkap").find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-edit']").click()
    tid(driver, "pkg-form-modal")
    assert driver.find_element(By.ID, "package-name-input").get_attribute("value") == "Lengkap"
    fill_form(driver, name="Lengkap Plus", price="375000")
    submit(driver)
    wait_gone(driver, "pkg-form-modal")
    toast(driver, 'Perubahan paket "Lengkap Plus" disimpan.')
    edited = card(driver, "Lengkap Plus")
    assert edited.find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-price']").text == "Rp 375.000"


@tc("TC.PKG.007.002")
def test_tutup_edit_tanpa_perubahan(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Dasar", 150000)
    login(driver, api_a)
    open_packages(driver, service_id)
    card(driver, "Dasar").find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-edit']").click()
    tid(driver, "pkg-form-cancel").click()
    wait_gone(driver, "pkg-form-modal")
    assert not all_tid(driver, "pkg-discard-dialog")


@tc("TC.PKG.007.003")
def test_konfirmasi_buang_perubahan(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Dasar", 150000)
    login(driver, api_a)
    open_packages(driver, service_id)
    card(driver, "Dasar").find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-edit']").click()
    fill_form(driver, price="200000")
    tid(driver, "pkg-form-cancel").click()
    tid(driver, "pkg-discard-dialog")
    tid(driver, "pkg-discard-keep").click()
    wait_gone(driver, "pkg-discard-dialog")
    assert driver.find_element(By.ID, "package-price-input").get_attribute("value") == "200.000"
    tid(driver, "pkg-form-cancel").click()
    tid(driver, "pkg-discard-confirm").click()
    wait_gone(driver, "pkg-form-modal")
    price = card(driver, "Dasar").find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-price']").text
    assert price == "Rp 150.000"


# ---------------------------------------------------------------------------
# TS.PKG.008 Nonaktif / aktif
# ---------------------------------------------------------------------------

@tc("TC.PKG.008.001")
def test_nonaktifkan_paket(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Dasar", 150000, active=True)
    login(driver, api_a)
    open_packages(driver, service_id)
    card(driver, "Dasar").find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-toggle']").click()
    toast(driver, 'Paket "Dasar" dinonaktifkan dan tidak tampil ke pelanggan.')
    assert not all_tid(driver, "pkg-delete-dialog")
    updated = card(driver, "Dasar")
    assert updated.find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-status']").text == "Nonaktif"
    assert updated.find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-toggle']").text == "Aktifkan"


@tc("TC.PKG.008.002")
def test_aktifkan_lagi_paket(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Dasar", 150000, active=False)
    login(driver, api_a)
    open_packages(driver, service_id)
    card(driver, "Dasar").find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-toggle']").click()
    toast(driver, 'Paket "Dasar" diaktifkan lagi.')
    assert card(driver, "Dasar").find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-status']").text == "Aktif"


# ---------------------------------------------------------------------------
# TS.PKG.009 Hapus
# ---------------------------------------------------------------------------

@tc("TC.PKG.009.001")
def test_batal_hapus_paket(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Berkala", 500000)
    login(driver, api_a)
    open_packages(driver, service_id)
    card(driver, "Berkala").find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-delete']").click()
    target = tid(driver, "pkg-delete-target").text
    assert "Berkala" in target and "Rp 500.000" in target
    tid(driver, "pkg-delete-cancel").click()
    wait_gone(driver, "pkg-delete-dialog")
    assert card(driver, "Berkala")


@tc("TC.PKG.009.002")
def test_hapus_paket_dengan_konfirmasi(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Berkala", 500000)
    login(driver, api_a)
    open_packages(driver, service_id)
    card(driver, "Berkala").find_element(By.CSS_SELECTOR, "[data-testid='pkg-card-delete']").click()
    tid(driver, "pkg-delete-confirm").click()
    toast(driver, 'Paket "Berkala" dihapus.')
    wait(driver).until(lambda d: "Berkala" not in card_names(d))


# ---------------------------------------------------------------------------
# TS.PKG.010 Chip & filter
# ---------------------------------------------------------------------------

@tc("TC.PKG.010.001")
def test_chip_dan_filter_status(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Dasar", 150000, active=True)
    api_a.add_package(service_id, "Lengkap", 350000, active=True)
    api_a.add_package(service_id, "Berkala", 500000, active=False)
    deleted = api_a.add_package(service_id, "Lama", 90000, active=True)
    api_a.delete_package(deleted["id"])

    login(driver, api_a)
    open_packages(driver, service_id)
    counts = {
        name: tid(driver, f"pkg-filter-{name}")
        .find_element(By.CSS_SELECTOR, "[data-testid='pkg-filter-count']").text
        for name in ("all", "active", "inactive")
    }
    assert counts == {"all": "3", "active": "2", "inactive": "1"}

    tid(driver, "pkg-filter-active").click()
    wait(driver).until(lambda d: len(all_tid(d, "pkg-card")) == 2)
    assert all(e.text == "Aktif" for e in all_tid(driver, "pkg-card-status"))

    tid(driver, "pkg-filter-inactive").click()
    wait(driver).until(lambda d: len(all_tid(d, "pkg-card")) == 1)
    assert card_names(driver) == ["Berkala"]


# ---------------------------------------------------------------------------
# TS.PKG.011 Halaman publik (sesi browser tanpa login)
# ---------------------------------------------------------------------------

@pytest.mark.alur_utama
@tc("TC.PKG.011.001")
def test_publik_hanya_paket_aktif(case_id, driver, api_a, service_id):
    api_a.add_package(service_id, "Lengkap", 350000, active=True)
    api_a.add_package(service_id, "Dasar", 150000, active=True)
    api_a.add_package(service_id, "Berkala", 500000, active=False)
    driver.get(f"{BASE_URL}/preview/services/{service_id}/packages")
    wait(driver).until(lambda d: all_tid(d, "pkgpub-card"))
    names = [e.text for e in all_tid(driver, "pkgpub-card-name")]
    prices = [e.text for e in all_tid(driver, "pkgpub-card-price")]
    assert names == ["Dasar", "Lengkap"]
    assert prices == ["Rp 150.000", "Rp 350.000"]


@tc("TC.PKG.011.002")
def test_publik_jasa_tanpa_paket_aktif(case_id, driver, service_id):
    driver.get(f"{BASE_URL}/preview/services/{service_id}/packages")
    assert tid(driver, "pkgpub-state-title").text == "Jasa ini belum punya paket aktif."


@tc("TC.PKG.011.003")
def test_publik_jasa_tidak_ditemukan(case_id, driver):
    driver.get(f"{BASE_URL}/preview/services/99999999-9999-4999-8999-999999999999/packages")
    assert tid(driver, "pkgpub-state-title").text == "Jasa tidak ditemukan."
