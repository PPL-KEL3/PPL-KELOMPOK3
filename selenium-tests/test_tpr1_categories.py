"""
PBI-01 / TPR-1: Kategori Jasa (sheet Excel "Service Discovery"). Pemilik PBI: Vivi.

Satu fungsi tes = satu Case ID di Excel (lihat nama tes di output `pytest -v`).

Data uji:
- Login sebagai admin uji (E2E_ADMIN). Kategori yang dibuat tes dicatat lalu dihapus
  lagi setelah tiap tes. Kategori yang SUDAH ada sebelumnya tidak pernah dihapus.
- TC.CAT.006.003 membuat kategori "[E2E] Kategori Terpakai" + satu jasa "[E2E] Jasa Kategori"
  milik E2E_PROVIDER_A, lalu menghapus keduanya setelah tes.
- TC.CAT.001.002 butuh database tanpa kategori. Di database bersama tes ini di-skip,
  karena tes tidak boleh menghapus kategori milik tim.

Jalankan:  pytest test_tpr1_categories.py -v
"""

import os
import pathlib

import pytest
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
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

    def categories(self):
        return self.call("GET", "/categories")["categories"]

    def category_by_name(self, name):
        for item in self.categories():
            if item["name"].strip().lower() == name.strip().lower():
                return item
        return None


@pytest.fixture(scope="module")
def admin():
    return Api(*env_account("E2E_ADMIN"))


@pytest.fixture
def created(admin):
    """Daftar nama kategori yang dibuat tes ini; dihapus setelah tes."""
    before = {item["id"] for item in admin.categories()}
    names = []
    yield names
    for item in admin.categories():
        if item["id"] not in before:
            try:
                admin.call("DELETE", f"/categories/{item['id']}")
            except AssertionError as error:
                print(f"Peringatan pembersihan kategori: {error}")


def require_new_name(admin, name):
    if admin.category_by_name(name):
        pytest.skip(f'Kategori "{name}" sudah ada di database; hapus dulu atau jalankan di database uji')


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


def button(driver, text, scope="//"):
    return wait(driver).until(EC.element_to_be_clickable(
        (By.XPATH, f"{scope}button[normalize-space()='{text}']")))


def toast(driver, text):
    wait(driver).until(lambda d: text in norm(d.find_element(By.CSS_SELECTOR, ".toast-stack").text))


def type_into(element, text):
    element.send_keys(Keys.CONTROL, "a")
    element.send_keys(Keys.DELETE)
    if text:
        element.send_keys(text)


def open_page(driver, admin):
    login(driver, admin)
    driver.get(BASE_URL + "/admin/categories")
    wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, ".cat-table__row, .cat-state-panel"))


def open_add(driver):
    button(driver, "Tambah Kategori", scope="//section//").click()
    css(driver, ".cat-modal")


def fill(driver, name=None, description=None):
    if name is not None:
        type_into(driver.find_element(By.ID, "category-name-input"), name)
    if description is not None:
        type_into(driver.find_element(By.ID, "category-description-input"), description)


def submit(driver):
    driver.find_element(By.CSS_SELECTOR, ".cat-modal button[type='submit']").click()


def modal_gone(driver):
    wait(driver).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".cat-modal")))


def row(driver, name):
    for element in driver.find_elements(By.CSS_SELECTOR, ".cat-table__row"):
        if norm(element.find_element(By.CSS_SELECTOR, ".cat-name-text").text) == norm(name):
            return element
    raise AssertionError(f'Baris kategori "{name}" tidak ditemukan')


def wait_row(driver, name):
    wait(driver).until(lambda d: any(
        norm(e.text) == norm(name) for e in d.find_elements(By.CSS_SELECTOR, ".cat-name-text")))
    return row(driver, name)


def error_text(driver, field):
    return css(driver, f"#category-{field}-error").text


# ---------------------------------------------------------------------------
# TS.CAT.001 Akses & tampilan
# ---------------------------------------------------------------------------

@tc("TC.CAT.001.001")
def test_akses_halaman_kategori(case_id, driver, admin):
    open_page(driver, admin)
    assert "Manajemen Kategori Jasa" in driver.find_element(By.TAG_NAME, "body").text
    headers = [norm(h.text) for h in driver.find_elements(By.CSS_SELECTOR, ".cat-table th")]
    for expected in ("Nama Kategori", "Deskripsi", "Relasi Jasa"):
        assert expected in headers


@tc("TC.CAT.001.002")
def test_tampilan_kategori_kosong(case_id, driver, admin):
    if admin.categories():
        pytest.skip("Butuh database tanpa kategori. Tes tidak menghapus kategori milik tim.")
    open_page(driver, admin)
    assert "Belum ada kategori jasa." in driver.find_element(By.CSS_SELECTOR, ".cat-state-panel").text


@tc("TC.CAT.001.003")
def test_customer_tidak_bisa_buka_admin(case_id, driver):
    customer = Api(*env_account("E2E_CUSTOMER_A"))
    login(driver, customer)
    driver.get(BASE_URL + "/admin/categories")
    wait(driver).until(lambda d: "/admin/categories" not in d.current_url)
    assert "/customer" in driver.current_url


@tc("TC.CAT.001.004")
def test_tamu_tidak_bisa_buka_admin(case_id, driver):
    driver.get(BASE_URL + "/admin/categories")
    wait(driver).until(EC.url_contains("/login"))


# ---------------------------------------------------------------------------
# TS.CAT.002 Tambah
# ---------------------------------------------------------------------------

@tc("TC.CAT.002.001")
def test_tambah_kategori_valid(case_id, driver, admin, created):
    name = "Perbaikan Atap & Talang"
    require_new_name(admin, name)
    open_page(driver, admin)
    open_add(driver)
    fill(driver, name=name, description="Jasa perbaikan kebocoran atap dan instalasi talang rumah.")
    submit(driver)
    modal_gone(driver)
    toast(driver, f'Kategori "{name}" berhasil ditambahkan.')
    assert "Belum digunakan" in wait_row(driver, name).text


@tc("TC.CAT.002.002")
def test_tambah_kategori_tanpa_deskripsi(case_id, driver, admin, created):
    name = "Jasa Angkut Barang"
    require_new_name(admin, name)
    open_page(driver, admin)
    open_add(driver)
    fill(driver, name=name)
    submit(driver)
    modal_gone(driver)
    assert "Belum ada deskripsi kategori" in wait_row(driver, name).text


# ---------------------------------------------------------------------------
# TS.CAT.003 Validasi nama
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,name,message", [
    ("TC.CAT.003.001", "   ", "Nama kategori wajib diisi."),
    ("TC.CAT.003.002", "A", "Nama kategori minimal terdiri dari 2 karakter."),
], ids=["TC.CAT.003.001", "TC.CAT.003.002"])
def test_nama_ditolak(case_id, name, message, driver, admin, created):
    open_page(driver, admin)
    open_add(driver)
    fill(driver, name=name)
    submit(driver)
    assert error_text(driver, "name") == message


@pytest.mark.parametrize("case_id,name", [
    ("TC.CAT.003.003", "AC"),
    ("TC.CAT.003.004", "K" * 80),
], ids=["TC.CAT.003.003", "TC.CAT.003.004"])
def test_nama_batas_diterima(case_id, name, driver, admin, created):
    require_new_name(admin, name)
    open_page(driver, admin)
    open_add(driver)
    fill(driver, name=name)
    submit(driver)
    modal_gone(driver)
    assert wait_row(driver, name)


@tc("TC.CAT.003.005")
def test_nama_81_karakter_terpotong(case_id, driver, admin):
    open_page(driver, admin)
    open_add(driver)
    field = driver.find_element(By.ID, "category-name-input")
    field.send_keys("K" * 81)
    assert len(field.get_attribute("value")) == 80


@tc("TC.CAT.003.006")
def test_nama_duplikat_ditolak(case_id, driver, admin, created):
    if not admin.category_by_name("Servis Elektronik & AC"):
        admin.call("POST", "/categories", json={"name": "Servis Elektronik & AC", "description": ""})
    open_page(driver, admin)
    open_add(driver)
    fill(driver, name="  servis elektronik & ac  ")
    submit(driver)
    assert error_text(driver, "name") == "Nama kategori sudah digunakan. Gunakan nama kategori yang berbeda."


# ---------------------------------------------------------------------------
# TS.CAT.004 Validasi deskripsi
# ---------------------------------------------------------------------------

@tc("TC.CAT.004.001")
def test_deskripsi_350_diterima(case_id, driver, admin, created):
    name = "Jasa Taman"
    require_new_name(admin, name)
    open_page(driver, admin)
    open_add(driver)
    fill(driver, name=name, description="D" * 350)
    submit(driver)
    modal_gone(driver)
    assert "D" * 350 in wait_row(driver, name).text


@tc("TC.CAT.004.002")
def test_deskripsi_351_terpotong(case_id, driver, admin):
    open_page(driver, admin)
    open_add(driver)
    field = driver.find_element(By.ID, "category-description-input")
    field.send_keys("D" * 351)
    assert len(field.get_attribute("value")) == 350


# ---------------------------------------------------------------------------
# TS.CAT.005 Edit
# ---------------------------------------------------------------------------

@tc("TC.CAT.005.001")
def test_edit_kategori(case_id, driver, admin, created):
    for name in ("Jasa Angkut Barang", "Jasa Angkut & Pindahan"):
        require_new_name(admin, name)
    admin.call("POST", "/categories", json={"name": "Jasa Angkut Barang", "description": ""})
    open_page(driver, admin)
    wait_row(driver, "Jasa Angkut Barang")
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Edit kategori Jasa Angkut Barang']").click()
    css(driver, ".cat-modal")
    assert driver.find_element(By.ID, "category-name-input").get_attribute("value") == "Jasa Angkut Barang"
    fill(driver, name="Jasa Angkut & Pindahan")
    submit(driver)
    modal_gone(driver)
    toast(driver, 'Kategori "Jasa Angkut & Pindahan" berhasil diperbarui.')
    assert wait_row(driver, "Jasa Angkut & Pindahan")


@tc("TC.CAT.005.002")
def test_batal_edit_kategori(case_id, driver, admin, created):
    name = "Jasa Angkut Barang"
    require_new_name(admin, name)
    admin.call("POST", "/categories", json={"name": name, "description": ""})
    open_page(driver, admin)
    wait_row(driver, name)
    driver.find_element(By.CSS_SELECTOR, f"[aria-label='Edit kategori {name}']").click()
    css(driver, ".cat-modal")
    fill(driver, name="Nama Tidak Disimpan")
    button(driver, "Batal", scope="//*[contains(@class,'cat-modal')]//").click()
    modal_gone(driver)
    assert wait_row(driver, name)


# ---------------------------------------------------------------------------
# TS.CAT.006 Hapus
# ---------------------------------------------------------------------------

@tc("TC.CAT.006.001")
def test_hapus_kategori_belum_dipakai(case_id, driver, admin, created):
    name = "Kategori Uji Kosong"
    require_new_name(admin, name)
    admin.call("POST", "/categories", json={"name": name, "description": ""})
    open_page(driver, admin)
    wait_row(driver, name)
    driver.find_element(By.CSS_SELECTOR, f"[aria-label='Hapus kategori {name}']").click()
    dialog = css(driver, ".cat-modal--confirm")
    assert "Hapus Kategori Jasa?" in dialog.text
    button(driver, "Hapus", scope="//*[contains(@class,'cat-modal--confirm')]//").click()
    toast(driver, f'Kategori "{name}" berhasil dihapus.')
    wait(driver).until(lambda d: name not in [norm(e.text) for e in d.find_elements(By.CSS_SELECTOR, ".cat-name-text")])


@tc("TC.CAT.006.002")
def test_batal_hapus_kategori(case_id, driver, admin, created):
    name = "Kategori Uji Kosong"
    require_new_name(admin, name)
    admin.call("POST", "/categories", json={"name": name, "description": ""})
    open_page(driver, admin)
    wait_row(driver, name)
    driver.find_element(By.CSS_SELECTOR, f"[aria-label='Hapus kategori {name}']").click()
    css(driver, ".cat-modal--confirm")
    button(driver, "Batal", scope="//*[contains(@class,'cat-modal--confirm')]//").click()
    wait(driver).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".cat-modal--confirm")))
    assert wait_row(driver, name)


@tc("TC.CAT.006.003")
def test_kategori_terpakai_tidak_bisa_dihapus(case_id, driver, admin, created):
    name = "[E2E] Kategori Terpakai"
    require_new_name(admin, name)
    category = admin.call("POST", "/categories", json={"name": name, "description": ""})["category"]
    provider = Api(*env_account("E2E_PROVIDER_A"))
    service = provider.call("POST", "/services", json={
        "categoryId": category["id"], "name": "[E2E] Jasa Kategori",
        "description": "Jasa pengujian relasi kategori.", "price": 50000, "isActive": True,
    })["service"]
    try:
        open_page(driver, admin)
        assert "1 layanan terhubung" in wait_row(driver, name).text
        driver.find_element(By.CSS_SELECTOR, f"[aria-label='Hapus kategori {name}']").click()
        dialog = css(driver, ".cat-modal--confirm")
        assert "Kategori Masih Digunakan" in dialog.text
        labels = [norm(b.text) for b in dialog.find_elements(By.TAG_NAME, "button") if b.text.strip()]
        assert "Tutup" in labels and "Hapus" not in labels
    finally:
        provider.call("DELETE", f"/services/{service['id']}")
