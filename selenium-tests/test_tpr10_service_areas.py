"""
PBI-10 / TPR-10: Wilayah Layanan (sheet Excel "Provider Management"). Pemilik PBI: Fattan.

Satu fungsi tes = satu Case ID di Excel (lihat nama tes di output `pytest -v`).

Data uji:
- E2E_PROVIDER_A (sudah punya profil). Wilayah layanan miliknya disalin sebelum tiap tes,
  dikosongkan, lalu dikembalikan seperti semula setelah tes.
- E2E_PROVIDER_NEW (belum punya profil) dipakai untuk TC.AREA.001.001. File ini dijalankan
  sebelum test_tpr9_provider_profile.py (urutan nama file), jadi akun itu masih tanpa profil.

Jalankan:  pytest test_tpr10_service_areas.py -v
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
RADIUS_RANGE = "Radius layanan harus antara 1 dan 100 km."


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

    def me(self):
        return self.call("GET", "/auth/me")["user"]

    def profile(self):
        return self.call("GET", "/providers/me").get("profile")

    def areas(self):
        return self.call("GET", "/providers/me/service-areas")["serviceAreas"]

    def add_area(self, name, radius):
        self.call("POST", "/providers/me/service-areas", json={"areaName": name, "radiusKm": radius})

    def clear_areas(self):
        for area in self.areas():
            self.call("DELETE", f"/providers/me/service-areas/{area['id']}")


@pytest.fixture(scope="module")
def api_a():
    api = Api(*env_account("E2E_PROVIDER_A"))
    if not api.profile():
        pytest.skip("E2E_PROVIDER_A harus sudah punya profil penyedia")
    return api


@pytest.fixture
def areas(api_a):
    snapshot = [(a["areaName"], a["radiusKm"]) for a in api_a.areas()]
    api_a.clear_areas()
    yield api_a
    api_a.clear_areas()
    for name, radius in snapshot:
        api_a.add_area(name, radius)


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


def toast(driver, text):
    wait(driver).until(lambda d: text in norm(d.find_element(By.CSS_SELECTOR, ".toast-stack").text))


def type_into(element, text):
    element.send_keys(Keys.CONTROL, "a")
    element.send_keys(Keys.DELETE)
    if text:
        element.send_keys(text)


def open_areas(driver, api):
    login(driver, api)
    driver.get(BASE_URL + "/provider/profile")
    card = css(driver, ".prf-sa-card")
    wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, ".prf-sa-item, .prf-sa-card .prf-state-panel"))
    return card


def count_text(driver):
    return norm(css(driver, ".prf-sa-count").text)


def area_names(driver):
    return [norm(e.text) for e in driver.find_elements(By.CSS_SELECTOR, ".prf-sa-item__copy strong")]


def area_item(driver, name):
    for item in driver.find_elements(By.CSS_SELECTOR, ".prf-sa-item"):
        if norm(item.find_element(By.CSS_SELECTOR, ".prf-sa-item__copy strong").text) == name:
            return item
    raise AssertionError(f'Wilayah "{name}" tidak ditemukan')


def open_add(driver):
    driver.find_element(By.XPATH, "//*[contains(@class,'prf-sa-header')]//button[normalize-space()='Tambah Wilayah']").click()
    css(driver, ".prf-modal")


def fill(driver, name=None, radius=None):
    if name is not None:
        type_into(driver.find_element(By.ID, "service-area-name"), name)
    if radius is not None:
        type_into(driver.find_element(By.ID, "service-area-radius"), radius)


def submit(driver):
    driver.find_element(By.CSS_SELECTOR, ".prf-modal button[type='submit']").click()


def modal_gone(driver):
    wait(driver).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".prf-modal")))


def expect_modal_text(driver, message):
    wait(driver).until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, ".prf-modal"), message))


def add_via_ui(driver, name, radius):
    open_add(driver)
    fill(driver, name=name, radius=radius)
    submit(driver)


# ---------------------------------------------------------------------------
# TS.AREA.001 Akses
# ---------------------------------------------------------------------------

@tc("TC.AREA.001.001")
def test_wilayah_belum_ada_sebelum_profil(case_id, driver):
    api_new = Api(*env_account("E2E_PROVIDER_NEW"))
    if api_new.profile():
        pytest.skip("E2E_PROVIDER_NEW sudah punya profil; pakai akun penyedia baru")
    login(driver, api_new)
    driver.get(BASE_URL + "/provider/profile")
    css(driver, "#provider-business-name")
    assert not driver.find_elements(By.CSS_SELECTOR, ".prf-sa-card")
    assert not driver.find_elements(By.XPATH, "//button[normalize-space()='Tambah Wilayah']")


@tc("TC.AREA.001.002")
def test_tampilan_wilayah_kosong(case_id, driver, areas):
    open_areas(driver, areas)
    assert count_text(driver) == "0 Wilayah"
    assert driver.find_element(By.XPATH, "//button[normalize-space()='Tambah Wilayah']").is_displayed()


# ---------------------------------------------------------------------------
# TS.AREA.002 Tambah
# ---------------------------------------------------------------------------

@tc("TC.AREA.002.001")
def test_tambah_wilayah_valid(case_id, driver, areas):
    open_areas(driver, areas)
    add_via_ui(driver, "Kecamatan Coblong", "5")
    modal_gone(driver)
    toast(driver, "Wilayah layanan berhasil ditambahkan.")
    assert "Radius 5 km" in norm(area_item(driver, "Kecamatan Coblong").text)
    assert count_text(driver) == "1 Wilayah"


# ---------------------------------------------------------------------------
# TS.AREA.003 Validasi nama wilayah
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,name,message", [
    ("TC.AREA.003.001", "", "Nama wilayah layanan wajib diisi."),
    ("TC.AREA.003.002", "AB", "Nama wilayah layanan minimal 3 karakter."),
], ids=["TC.AREA.003.001", "TC.AREA.003.002"])
def test_nama_wilayah_ditolak(case_id, name, message, driver, areas):
    open_areas(driver, areas)
    add_via_ui(driver, name, "5")
    expect_modal_text(driver, message)


@pytest.mark.parametrize("case_id,name", [
    ("TC.AREA.003.003", "Lio"),
    ("TC.AREA.003.004", "W" * 100),
], ids=["TC.AREA.003.003", "TC.AREA.003.004"])
def test_nama_wilayah_batas_diterima(case_id, name, driver, areas):
    open_areas(driver, areas)
    add_via_ui(driver, name, "5")
    modal_gone(driver)
    wait(driver).until(lambda d: name in area_names(d))


@tc("TC.AREA.003.005")
def test_nama_wilayah_101_terpotong(case_id, driver, areas):
    open_areas(driver, areas)
    open_add(driver)
    field = driver.find_element(By.ID, "service-area-name")
    field.send_keys("W" * 101)
    assert len(field.get_attribute("value")) == 100


@tc("TC.AREA.003.006")
def test_nama_wilayah_duplikat(case_id, driver, areas):
    areas.add_area("Kecamatan Coblong", 5)
    open_areas(driver, areas)
    add_via_ui(driver, "kecamatan coblong", "3")
    expect_modal_text(driver, "Nama wilayah layanan sudah digunakan.")
    assert len(areas.areas()) == 1


# ---------------------------------------------------------------------------
# TS.AREA.004 Validasi radius (BVA)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,radius,message", [
    ("TC.AREA.004.001", "", "Radius layanan wajib diisi dengan angka."),
    ("TC.AREA.004.002", "0", RADIUS_RANGE),
    ("TC.AREA.004.005", "101", RADIUS_RANGE),
], ids=["TC.AREA.004.001", "TC.AREA.004.002", "TC.AREA.004.005"])
def test_radius_ditolak(case_id, radius, message, driver, areas):
    open_areas(driver, areas)
    add_via_ui(driver, "Kecamatan Sukajadi", radius)
    expect_modal_text(driver, message)


@pytest.mark.parametrize("case_id,name,radius", [
    ("TC.AREA.004.003", "Kecamatan Sukajadi", "1"),
    ("TC.AREA.004.004", "Kabupaten Bandung", "100"),
], ids=["TC.AREA.004.003", "TC.AREA.004.004"])
def test_radius_batas_diterima(case_id, name, radius, driver, areas):
    open_areas(driver, areas)
    add_via_ui(driver, name, radius)
    modal_gone(driver)
    wait(driver).until(lambda d: name in area_names(d))
    assert f"Radius {radius} km" in norm(area_item(driver, name).text)


# ---------------------------------------------------------------------------
# TS.AREA.005 Batas 10 wilayah
# ---------------------------------------------------------------------------

@tc("TC.AREA.005.001")
def test_tambah_wilayah_ke_10(case_id, driver, areas):
    for index in range(1, 10):
        areas.add_area(f"Wilayah {index:02d}", 5)
    open_areas(driver, areas)
    add_via_ui(driver, "Wilayah Ke-10", "5")
    modal_gone(driver)
    wait(driver).until(lambda d: count_text(d) == "10 Wilayah")


@tc("TC.AREA.005.002")
def test_tambah_wilayah_ke_11_ditolak(case_id, driver, areas):
    for index in range(1, 11):
        areas.add_area(f"Wilayah {index:02d}", 5)
    open_areas(driver, areas)
    add_via_ui(driver, "Wilayah Ke-11", "5")
    expect_modal_text(driver, "Maksimal 10 wilayah layanan per penyedia.")
    assert count_text(driver) == "10 Wilayah"


# ---------------------------------------------------------------------------
# TS.AREA.006 Edit
# ---------------------------------------------------------------------------

@tc("TC.AREA.006.001")
def test_edit_wilayah(case_id, driver, areas):
    areas.add_area("Kecamatan Coblong", 5)
    open_areas(driver, areas)
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Edit wilayah Kecamatan Coblong']").click()
    css(driver, ".prf-modal")
    assert driver.find_element(By.ID, "service-area-name").get_attribute("value") == "Kecamatan Coblong"
    fill(driver, radius="8")
    submit(driver)
    modal_gone(driver)
    toast(driver, "Wilayah layanan berhasil diperbarui.")
    wait(driver).until(lambda d: "Radius 8 km" in norm(area_item(d, "Kecamatan Coblong").text))


# ---------------------------------------------------------------------------
# TS.AREA.007 Hapus
# ---------------------------------------------------------------------------

@tc("TC.AREA.007.001")
def test_hapus_wilayah(case_id, driver, areas):
    areas.add_area("Lio", 5)
    open_areas(driver, areas)
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Hapus wilayah Lio']").click()
    dialog = css(driver, ".prf-modal--confirm")
    assert "Hapus Wilayah Layanan?" in dialog.text
    dialog.find_element(By.XPATH, ".//button[normalize-space()='Hapus Wilayah']").click()
    toast(driver, "Wilayah layanan berhasil dihapus.")
    wait(driver).until(lambda d: "Lio" not in area_names(d))


@tc("TC.AREA.007.002")
def test_batal_hapus_wilayah(case_id, driver, areas):
    areas.add_area("Lio", 5)
    open_areas(driver, areas)
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Hapus wilayah Lio']").click()
    dialog = css(driver, ".prf-modal--confirm")
    dialog.find_element(By.XPATH, ".//button[normalize-space()='Batal']").click()
    wait(driver).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, ".prf-modal--confirm")))
    assert "Lio" in area_names(driver)


# ---------------------------------------------------------------------------
# TS.AREA.008 Profil publik
# ---------------------------------------------------------------------------

@tc("TC.AREA.008.001")
def test_wilayah_tampil_di_profil_publik(case_id, driver, areas):
    profile = areas.profile()
    if not profile.get("isPublic"):
        pytest.skip("Profil E2E_PROVIDER_A harus publik untuk kasus ini")
    areas.add_area("Kecamatan Coblong", 8)
    driver.get(f"{BASE_URL}/providers/{areas.me()['id']}")
    wait(driver).until(lambda d: "Kecamatan Coblong" in d.find_element(By.TAG_NAME, "body").text)
    assert "Radius 8 km" in norm(driver.find_element(By.TAG_NAME, "body").text)
