"""
PBI-02 / TPR-2: Daftar Jasa penyedia dan katalog customer (sheet Excel "Service Discovery").
Pemilik PBI: Vivi.

Satu fungsi tes = satu Case ID di Excel (lihat nama tes di output `pytest -v`).

Data uji:
- Jasa dibuat oleh akun penyedia uji (E2E_PROVIDER_A / E2E_PROVIDER_B). Jasa yang dibuat
  selama satu tes dihapus setelah tes itu. Jasa yang sudah ada sebelumnya tidak disentuh.
- Jasa yang sudah punya paket tidak bisa dihapus (aturan TPR-5), jadi jasa seperti itu
  dinonaktifkan saja di akhir tes.
- TC.SVC.001.003 diperkirakan FAIL karena bug yang sudah diketahui (Daftar Jasa
  menampilkan jasa penyedia lain). Jangan ubah expected-nya; catat sebagai temuan.

Jalankan:  pytest test_tpr2_services.py -v
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
VALID_DESC = "Cuci unit indoor dan outdoor, cek tekanan freon."


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

    def services(self):
        return self.call("GET", "/services/mine")["services"]

    def add_service(self, name, category_id, price=85000, active=True, description=VALID_DESC):
        return self.call("POST", "/services", json={
            "categoryId": category_id, "name": name, "description": description,
            "price": price, "isActive": active,
        })["service"]


def cleanup_new_services(api, before_ids):
    for service in api.services():
        if service["id"] in before_ids:
            continue
        try:
            api.call("DELETE", f"/services/{service['id']}")
        except AssertionError:
            api.call("PATCH", f"/services/{service['id']}", json={"isActive": False})


@pytest.fixture(scope="module")
def api_a():
    return Api(*env_account("E2E_PROVIDER_A"))


@pytest.fixture(scope="module")
def category(api_a):
    categories = api_a.call("GET", "/categories")["categories"]
    if not categories:
        pytest.skip("Belum ada kategori jasa di database")
    return categories[0]


@pytest.fixture(autouse=True)
def track_services(api_a):
    before = {s["id"] for s in api_a.services()}
    yield
    cleanup_new_services(api_a, before)


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


def open_page(driver, api):
    login(driver, api)
    driver.get(BASE_URL + "/provider/dashboard/services")
    wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, ".svc-table__row, .svc-state-panel"))


def open_add(driver):
    button(driver, "Tambah Layanan", scope="//section//").click()
    css(driver, ".svc-modal")


def fill(driver, name=None, category_id=None, price=None, description=None, active=None):
    if name is not None:
        type_into(driver.find_element(By.ID, "service-name-input"), name)
    if category_id is not None:
        Select(driver.find_element(By.ID, "service-category-select")).select_by_value(category_id)
    if price is not None:
        type_into(driver.find_element(By.ID, "service-price-input"), price)
    if description is not None:
        type_into(driver.find_element(By.ID, "service-description-input"), description)
    if active is not None:
        checkbox = driver.find_element(By.CSS_SELECTOR, ".svc-checkbox-row input[type='checkbox']")
        if checkbox.is_selected() != active:
            checkbox.click()


def fill_valid(driver, category, name="Cuci AC Split", price="85000", description=VALID_DESC):
    fill(driver, name=name, category_id=category["id"], price=price, description=description)


def submit(driver):
    driver.find_element(By.CSS_SELECTOR, ".svc-modal button[type='submit']").click()


def modal_gone(driver):
    wait(driver).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".svc-modal")))


def field_errors(driver):
    return [norm(e.text) for e in driver.find_elements(By.CSS_SELECTOR, ".svc-modal .auth-field__error")]


def expect_error(driver, message):
    wait(driver).until(lambda d: message in field_errors(d))
    assert driver.find_elements(By.CSS_SELECTOR, ".svc-modal"), "Modal seharusnya tetap terbuka"


def row(driver, name):
    for element in driver.find_elements(By.CSS_SELECTOR, ".svc-table__row"):
        if norm(element.find_element(By.CSS_SELECTOR, ".svc-name-text").text) == name:
            return element
    raise AssertionError(f'Baris jasa "{name}" tidak ditemukan')


def wait_row(driver, name):
    wait(driver).until(lambda d: name in [norm(e.text) for e in d.find_elements(By.CSS_SELECTOR, ".svc-name-text")])
    return row(driver, name)


def status(driver, name):
    return norm(row(driver, name).find_element(By.CSS_SELECTOR, ".svc-status-pill").text)


def add_and_expect_saved(driver, api, category, name="Cuci AC Split", price="85000", description=VALID_DESC):
    open_page(driver, api)
    open_add(driver)
    fill_valid(driver, category, name=name, price=price, description=description)
    submit(driver)
    modal_gone(driver)
    return wait_row(driver, name)


# ---------------------------------------------------------------------------
# TS.SVC.001 Akses & tampilan
# ---------------------------------------------------------------------------

@tc("TC.SVC.001.001")
def test_akses_halaman_daftar_jasa(case_id, driver, api_a):
    open_page(driver, api_a)
    body = driver.find_element(By.TAG_NAME, "body").text
    assert "Manajemen Daftar Layanan Jasa" in body
    headers = [norm(h.text) for h in driver.find_elements(By.CSS_SELECTOR, ".svc-table th")]
    for expected in ("Nama & Deskripsi Jasa", "Kategori", "Harga Dasar", "Status Publikasi"):
        assert expected in headers


@tc("TC.SVC.001.002")
def test_penyedia_belum_punya_jasa(case_id, driver):
    api_empty = Api(*env_account("E2E_PROVIDER_EMPTY"))
    if api_empty.services():
        pytest.skip("Akun E2E_PROVIDER_EMPTY harus tidak punya jasa")
    open_page(driver, api_empty)
    panel = css(driver, ".svc-state-panel")
    assert "Belum ada layanan jasa yang didaftarkan." in panel.text
    assert panel.find_element(By.XPATH, ".//button[normalize-space()='Tambah Layanan']")


@tc("TC.SVC.001.003")
def test_daftar_hanya_jasa_milik_sendiri(case_id, driver, api_a, category):
    api_b = Api(*env_account("E2E_PROVIDER_B"))
    before_b = {s["id"] for s in api_b.services()}
    api_b.add_service("[E2E] Jasa Penyedia B", category["id"])
    try:
        open_page(driver, api_a)
        names = [norm(e.text) for e in driver.find_elements(By.CSS_SELECTOR, ".svc-name-text")]
        own = {s["name"] for s in api_a.services()}
        assert "[E2E] Jasa Penyedia B" not in names
        assert set(names) <= own, f"Ada jasa milik penyedia lain: {sorted(set(names) - own)}"
    finally:
        cleanup_new_services(api_b, before_b)


@tc("TC.SVC.001.004")
def test_customer_tidak_bisa_buka_halaman_penyedia(case_id, driver):
    customer = Api(*env_account("E2E_CUSTOMER_A"))
    login(driver, customer)
    driver.get(BASE_URL + "/provider/dashboard/services")
    wait(driver).until(lambda d: "/provider/dashboard/services" not in d.current_url)
    assert "/customer" in driver.current_url


# ---------------------------------------------------------------------------
# TS.SVC.002 Tambah
# ---------------------------------------------------------------------------

@tc("TC.SVC.002.001")
def test_tambah_jasa_terpublikasi(case_id, driver, api_a, category):
    open_page(driver, api_a)
    open_add(driver)
    fill_valid(driver, category)
    fill(driver, active=True)
    submit(driver)
    modal_gone(driver)
    toast(driver, 'Layanan "Cuci AC Split" berhasil ditambahkan.')
    wait_row(driver, "Cuci AC Split")
    assert status(driver, "Cuci AC Split") == "Dipublikasikan"


@tc("TC.SVC.002.002")
def test_tambah_jasa_tanpa_publikasi(case_id, driver, api_a, category):
    open_page(driver, api_a)
    open_add(driver)
    fill_valid(driver, category)
    fill(driver, active=False)
    submit(driver)
    modal_gone(driver)
    wait_row(driver, "Cuci AC Split")
    assert status(driver, "Cuci AC Split") == "Nonaktif"


# ---------------------------------------------------------------------------
# TS.SVC.003 Validasi nama
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,name,message", [
    ("TC.SVC.003.001", "", "Nama layanan jasa wajib diisi."),
    ("TC.SVC.003.002", "AC", "Nama layanan minimal terdiri dari 3 karakter."),
], ids=["TC.SVC.003.001", "TC.SVC.003.002"])
def test_nama_ditolak(case_id, name, message, driver, api_a, category):
    open_page(driver, api_a)
    open_add(driver)
    fill_valid(driver, category, name=name)
    submit(driver)
    expect_error(driver, message)


@pytest.mark.parametrize("case_id,name", [
    ("TC.SVC.003.003", "Las"),
    ("TC.SVC.003.004", "N" * 100),
], ids=["TC.SVC.003.003", "TC.SVC.003.004"])
def test_nama_batas_diterima(case_id, name, driver, api_a, category):
    add_and_expect_saved(driver, api_a, category, name=name)


@tc("TC.SVC.003.005")
def test_nama_101_terpotong(case_id, driver, api_a):
    open_page(driver, api_a)
    open_add(driver)
    field = driver.find_element(By.ID, "service-name-input")
    field.send_keys("N" * 101)
    assert len(field.get_attribute("value")) == 100


# ---------------------------------------------------------------------------
# TS.SVC.004 Kategori
# ---------------------------------------------------------------------------

@tc("TC.SVC.004.001")
def test_kategori_wajib_dipilih(case_id, driver, api_a):
    open_page(driver, api_a)
    open_add(driver)
    fill(driver, name="Cuci AC Split", price="85000", description=VALID_DESC)
    Select(driver.find_element(By.ID, "service-category-select")).select_by_value("")
    submit(driver)
    expect_error(driver, "Kategori layanan wajib dipilih.")


# ---------------------------------------------------------------------------
# TS.SVC.005 Validasi deskripsi
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,description,message", [
    ("TC.SVC.005.001", "", "Deskripsi layanan wajib diisi."),
    ("TC.SVC.005.002", "Cuci AC 1", "Deskripsi layanan minimal terdiri dari 10 karakter."),
], ids=["TC.SVC.005.001", "TC.SVC.005.002"])
def test_deskripsi_ditolak(case_id, description, message, driver, api_a, category):
    open_page(driver, api_a)
    open_add(driver)
    fill_valid(driver, category, description=description)
    submit(driver)
    expect_error(driver, message)


@pytest.mark.parametrize("case_id,description", [
    ("TC.SVC.005.003", "Cuci AC 12"),
    ("TC.SVC.005.004", "D" * 500),
], ids=["TC.SVC.005.003", "TC.SVC.005.004"])
def test_deskripsi_batas_diterima(case_id, description, driver, api_a, category):
    add_and_expect_saved(driver, api_a, category, description=description)


@tc("TC.SVC.005.005")
def test_deskripsi_501_terpotong(case_id, driver, api_a):
    open_page(driver, api_a)
    open_add(driver)
    field = driver.find_element(By.ID, "service-description-input")
    field.send_keys("D" * 501)
    assert len(field.get_attribute("value")) == 500


# ---------------------------------------------------------------------------
# TS.SVC.006 Validasi harga (BVA tiga nilai)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,price,message", [
    ("TC.SVC.006.001", "", "Harga layanan wajib diisi."),
    ("TC.SVC.006.002", "999", "Harga layanan minimal Rp 1.000."),
    ("TC.SVC.006.007", "100000001", "Harga layanan maksimal Rp 100.000.000."),
], ids=["TC.SVC.006.001", "TC.SVC.006.002", "TC.SVC.006.007"])
def test_harga_ditolak(case_id, price, message, driver, api_a, category):
    open_page(driver, api_a)
    open_add(driver)
    fill_valid(driver, category, price=price)
    submit(driver)
    expect_error(driver, message)


@pytest.mark.parametrize("case_id,price,shown", [
    ("TC.SVC.006.003", "1000", "Rp 1.000"),
    ("TC.SVC.006.004", "1001", "Rp 1.001"),
    ("TC.SVC.006.005", "99999999", "Rp 99.999.999"),
    ("TC.SVC.006.006", "100000000", "Rp 100.000.000"),
], ids=["TC.SVC.006.003", "TC.SVC.006.004", "TC.SVC.006.005", "TC.SVC.006.006"])
def test_harga_batas_diterima(case_id, price, shown, driver, api_a, category):
    saved = add_and_expect_saved(driver, api_a, category, price=price)
    assert norm(saved.find_element(By.CSS_SELECTOR, ".svc-price-text").text) == shown


# ---------------------------------------------------------------------------
# TS.SVC.007 Edit
# ---------------------------------------------------------------------------

@tc("TC.SVC.007.001")
def test_edit_jasa(case_id, driver, api_a, category):
    api_a.add_service("Cuci AC Split", category["id"])
    open_page(driver, api_a)
    wait_row(driver, "Cuci AC Split")
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Edit layanan Cuci AC Split']").click()
    css(driver, ".svc-modal")
    assert driver.find_element(By.ID, "service-name-input").get_attribute("value") == "Cuci AC Split"
    fill(driver, name="Cuci AC Split Premium", price="95000")
    submit(driver)
    modal_gone(driver)
    toast(driver, 'Layanan "Cuci AC Split Premium" berhasil diperbarui.')
    edited = wait_row(driver, "Cuci AC Split Premium")
    assert norm(edited.find_element(By.CSS_SELECTOR, ".svc-price-text").text) == "Rp 95.000"


# ---------------------------------------------------------------------------
# TS.SVC.008 Nonaktif / aktif
# ---------------------------------------------------------------------------

@tc("TC.SVC.008.001")
def test_nonaktifkan_jasa(case_id, driver, api_a, category):
    api_a.add_service("Cuci AC Split", category["id"], active=True)
    open_page(driver, api_a)
    wait_row(driver, "Cuci AC Split")
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Nonaktifkan layanan Cuci AC Split']").click()
    toast(driver, 'Layanan "Cuci AC Split" dinonaktifkan dari pencarian pelanggan.')
    wait(driver).until(lambda d: status(d, "Cuci AC Split") == "Nonaktif")


@tc("TC.SVC.008.002")
def test_aktifkan_kembali_jasa(case_id, driver, api_a, category):
    api_a.add_service("Cuci AC Split", category["id"], active=False)
    open_page(driver, api_a)
    wait_row(driver, "Cuci AC Split")
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Aktifkan layanan Cuci AC Split']").click()
    toast(driver, 'Layanan "Cuci AC Split" diaktifkan kembali dan tampil ke pelanggan.')
    wait(driver).until(lambda d: status(d, "Cuci AC Split") == "Dipublikasikan")


# ---------------------------------------------------------------------------
# TS.SVC.009 Hapus
# ---------------------------------------------------------------------------

def click_delete(driver, name):
    driver.find_element(By.CSS_SELECTOR, f"[aria-label='Hapus layanan {name}']").click()
    return css(driver, ".svc-modal--confirm")


@tc("TC.SVC.009.001")
def test_hapus_jasa_tanpa_paket(case_id, driver, api_a, category):
    api_a.add_service("Las", category["id"])
    open_page(driver, api_a)
    wait_row(driver, "Las")
    dialog = click_delete(driver, "Las")
    assert "Hapus Layanan Jasa?" in dialog.text
    button(driver, "Hapus Layanan", scope="//*[contains(@class,'svc-modal--confirm')]//").click()
    toast(driver, 'Layanan "Las" berhasil dihapus dari daftar jasa.')
    wait(driver).until(lambda d: "Las" not in [norm(e.text) for e in d.find_elements(By.CSS_SELECTOR, ".svc-name-text")])


@tc("TC.SVC.009.002")
def test_batal_hapus_jasa(case_id, driver, api_a, category):
    api_a.add_service("Las", category["id"])
    open_page(driver, api_a)
    wait_row(driver, "Las")
    click_delete(driver, "Las")
    button(driver, "Batal", scope="//*[contains(@class,'svc-modal--confirm')]//").click()
    wait(driver).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".svc-modal--confirm")))
    assert wait_row(driver, "Las")


@tc("TC.SVC.009.003")
def test_jasa_punya_paket_tidak_bisa_dihapus(case_id, driver, api_a, category):
    name = "[E2E] Cuci AC Split"
    service = api_a.add_service(name, category["id"])
    api_a.call("POST", "/packages", json={
        "serviceId": service["id"], "name": "Dasar", "description": "",
        "price": 150000, "isActive": True,
    })
    open_page(driver, api_a)
    wait_row(driver, name)
    click_delete(driver, name)
    button(driver, "Hapus Layanan", scope="//*[contains(@class,'svc-modal--confirm')]//").click()
    wait(driver).until(EC.text_to_be_present_in_element(
        (By.CSS_SELECTOR, ".svc-modal--confirm"), "Jasa ini masih punya paket, nonaktifkan saja."))
    assert name in [s["name"] for s in api_a.services()]


# ---------------------------------------------------------------------------
# TS.SVC.010 Katalog customer
# ---------------------------------------------------------------------------

def open_catalog(driver):
    customer = Api(*env_account("E2E_CUSTOMER_A"))
    login(driver, customer)
    driver.get(BASE_URL + "/customer/services")
    wait(driver).until(EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Layanan Jasa Lokal Tersedia"))


def catalog_card(driver, name):
    for article in driver.find_elements(By.CSS_SELECTOR, "article"):
        if name in article.text:
            return article
    return None


@tc("TC.SVC.010.001")
def test_katalog_hanya_jasa_terpublikasi(case_id, driver, api_a, category):
    api_a.add_service("[E2E] Jasa Tampil", category["id"], active=True)
    api_a.add_service("[E2E] Jasa Tersembunyi", category["id"], active=False)
    open_catalog(driver)
    wait(driver).until(lambda d: catalog_card(d, "[E2E] Jasa Tampil") is not None)
    assert catalog_card(driver, "[E2E] Jasa Tersembunyi") is None


@tc("TC.SVC.010.002")
def test_isi_kartu_katalog(case_id, driver, api_a, category):
    api_a.add_service("[E2E] Cuci AC Split", category["id"], active=True)
    open_catalog(driver)
    wait(driver).until(lambda d: catalog_card(d, "[E2E] Cuci AC Split") is not None)
    text = catalog_card(driver, "[E2E] Cuci AC Split").text
    assert category["name"] in text
    assert "Oleh " in text
    assert "Lihat Profil" in text and "Booking Sekarang" in text
