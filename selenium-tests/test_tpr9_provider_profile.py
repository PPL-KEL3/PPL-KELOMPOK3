"""
PBI-09 / TPR-9: Profil Penyedia dan Kontak WhatsApp (sheet Excel "Provider Management").
Pemilik PBI: Fattan.

Satu fungsi tes = satu Case ID di Excel (lihat nama tes di output `pytest -v`).

Data uji:
- E2E_PROVIDER_A: penyedia uji yang SUDAH punya profil. Profilnya disalin sebelum tiap tes
  dan dikembalikan seperti semula setelah tes, jadi tes boleh mengubah isinya.
- E2E_PROVIDER_NEW: penyedia uji yang BELUM punya profil. TC.PRF.002.001 akan membuat
  profil untuk akun ini (profil tidak bisa dihapus lewat aplikasi), jadi setelah satu kali
  run, TC.PRF.001.001 dan TC.PRF.002.001 akan di-skip. Untuk mengulang, pakai akun baru.
- Jasa yang dibuat tes (untuk halaman publik) dihapus setelah tes.

Jalankan:  pytest test_tpr9_provider_profile.py -v
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
WA_INVALID = "Masukkan nomor WhatsApp Indonesia yang valid, contoh 081234567890."
DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


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

    def services(self):
        return self.call("GET", "/services/mine")["services"]


def profile_payload(profile):
    return {
        "businessName": profile["businessName"],
        "bio": profile.get("bio"),
        "whatsappNumber": profile["whatsappNumber"],
        "address": profile["address"],
        "serviceArea": profile["serviceArea"],
        "operatingHours": profile["operatingHours"],
        "primaryCategoryId": (profile.get("primaryCategory") or {}).get("id") or profile.get("primaryCategoryId"),
        "isPublic": profile["isPublic"],
    }


@pytest.fixture(scope="module")
def api_a():
    api = Api(*env_account("E2E_PROVIDER_A"))
    if not api.profile():
        pytest.skip("E2E_PROVIDER_A harus sudah punya profil penyedia (isi sekali lewat /provider/profile)")
    return api


@pytest.fixture
def restore_profile(api_a):
    snapshot = api_a.profile()
    yield
    api_a.call("PUT", "/providers/me", json=profile_payload(snapshot))


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


def body_text(driver):
    return norm(driver.find_element(By.TAG_NAME, "body").text)


def type_into(element, text):
    element.send_keys(Keys.CONTROL, "a")
    element.send_keys(Keys.DELETE)
    if text:
        element.send_keys(text)


def set_react_value(driver, element, value):
    """Mengisi input type=time tanpa tergantung format jam bawaan sistem."""
    driver.execute_script(
        "const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
        "setter.call(arguments[0], arguments[1]);"
        "arguments[0].dispatchEvent(new Event('input', { bubbles: true }));",
        element, value)


def open_profile(driver, api):
    login(driver, api)
    driver.get(BASE_URL + "/provider/profile")
    css(driver, "#provider-business-name")
    # Tunggu useEffect profil selesai mengisi form. Kategori terisi lebih lambat
    # daripada render pertama, jadi aman dipakai sebagai penanda hydrasi.
    wait(driver).until(
        lambda d: d.find_element(By.ID, "provider-category").get_attribute("value")
    )


FIELDS = {
    "name": "provider-business-name",
    "bio": "provider-bio",
    "whatsapp": "provider-whatsapp",
    "address": "provider-address",
    "area": "provider-service-area",
}


def fill(driver, **values):
    for key, value in values.items():
        if key == "category":
            Select(driver.find_element(By.ID, "provider-category")).select_by_value(value)
        elif key == "public":
            checkbox = driver.find_element(By.CSS_SELECTOR, ".prf-toggle-row input[type='checkbox']")
            if checkbox.is_selected() != value:
                checkbox.click()
        else:
            type_into(driver.find_element(By.ID, FIELDS[key]), value)


def save(driver):
    driver.find_element(By.CSS_SELECTOR, ".prf-form button[type='submit']").click()


def errors(driver):
    return [norm(e.text) for e in driver.find_elements(By.CSS_SELECTOR, ".prf-form .auth-field__error")]


def expect_error(driver, message):
    wait(driver).until(lambda d: message in errors(d))


def expect_saved(driver):
    toast(driver, "Profil penyedia berhasil disimpan.")


def status_pill(driver):
    return norm(css(driver, ".prf-status-pill").text)


def day_row(driver, day):
    for row in driver.find_elements(By.CSS_SELECTOR, ".prf-hour-row"):
        if norm(row.find_element(By.CSS_SELECTOR, ".prf-hour-day").text) == day:
            return row
    raise AssertionError(f"Baris hari {day} tidak ditemukan")


# ---------------------------------------------------------------------------
# TS.PRF.001 Akses
# ---------------------------------------------------------------------------

@pytest.fixture
def api_new():
    api = Api(*env_account("E2E_PROVIDER_NEW"))
    if api.profile():
        pytest.skip("E2E_PROVIDER_NEW sudah punya profil; pakai akun penyedia baru untuk mengulang tes ini")
    return api


@tc("TC.PRF.001.001")
def test_halaman_profil_belum_dibuat(case_id, driver, api_new):
    open_profile(driver, api_new)
    assert status_pill(driver) == "Profil belum dibuat"
    assert not driver.find_elements(By.CSS_SELECTOR, ".prf-sa-card")


@tc("TC.PRF.001.002")
def test_customer_tidak_bisa_buka_profil_penyedia(case_id, driver):
    customer = Api(*env_account("E2E_CUSTOMER_A"))
    login(driver, customer)
    driver.get(BASE_URL + "/provider/profile")
    wait(driver).until(lambda d: "/provider/profile" not in d.current_url)
    assert "/customer" in driver.current_url


# ---------------------------------------------------------------------------
# TS.PRF.002 Simpan profil
# ---------------------------------------------------------------------------

@tc("TC.PRF.002.001")
def test_simpan_profil_lengkap(case_id, driver, api_new):
    category = api_new.call("GET", "/categories")["categories"][0]
    open_profile(driver, api_new)
    fill(driver, name="Bengkel Bangunan Pak Rahmat", bio="Spesialis renovasi atap dan dinding.",
         whatsapp="081234567890", category=category["id"],
         address="Jl. Cihampelas No. 10, Bandung", area="Kecamatan Coblong dan sekitarnya", public=True)
    save(driver)
    expect_saved(driver)
    wait(driver).until(lambda d: status_pill(d) == "Profil publik aktif")
    css(driver, ".prf-sa-card")


@tc("TC.PRF.002.002")
def test_perbarui_alamat(case_id, driver, api_a, restore_profile):
    open_profile(driver, api_a)
    fill(driver, address="Jl. Dago No. 5, Bandung")
    save(driver)
    expect_saved(driver)
    driver.refresh()
    field = css(driver, "#provider-address")
    assert field.get_attribute("value") == "Jl. Dago No. 5, Bandung"


# ---------------------------------------------------------------------------
# TS.PRF.003 Nama usaha
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,name,message", [
    ("TC.PRF.003.001", "", "Nama usaha wajib diisi."),
    ("TC.PRF.003.002", "A", "Nama usaha minimal 2 karakter."),
], ids=["TC.PRF.003.001", "TC.PRF.003.002"])
def test_nama_usaha_ditolak(case_id, name, message, driver, api_a):
    open_profile(driver, api_a)
    fill(driver, name=name)
    save(driver)
    expect_error(driver, message)


@pytest.mark.parametrize("case_id,name", [
    ("TC.PRF.003.003", "AB"),
    ("TC.PRF.003.004", "U" * 80),
], ids=["TC.PRF.003.003", "TC.PRF.003.004"])
def test_nama_usaha_batas_diterima(case_id, name, driver, api_a, restore_profile):
    open_profile(driver, api_a)
    fill(driver, name=name)
    save(driver)
    expect_saved(driver)
    assert api_a.profile()["businessName"] == name


@tc("TC.PRF.003.005")
def test_nama_usaha_81_terpotong(case_id, driver, api_a):
    open_profile(driver, api_a)
    field = driver.find_element(By.ID, "provider-business-name")
    type_into(field, "U" * 81)
    assert len(field.get_attribute("value")) == 80


# ---------------------------------------------------------------------------
# TS.PRF.004 WhatsApp
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,number,message", [
    ("TC.PRF.004.001", "", "Nomor WhatsApp wajib diisi."),
    ("TC.PRF.004.003", "08123456", WA_INVALID),
    ("TC.PRF.004.006", "081234567890123", WA_INVALID),
    ("TC.PRF.004.007", "0221234567", WA_INVALID),
], ids=["TC.PRF.004.001", "TC.PRF.004.003", "TC.PRF.004.006", "TC.PRF.004.007"])
def test_whatsapp_ditolak(case_id, number, message, driver, api_a):
    open_profile(driver, api_a)
    fill(driver, whatsapp=number)
    save(driver)
    expect_error(driver, message)


@tc("TC.PRF.004.002")
def test_whatsapp_format_plus62(case_id, driver, api_a, restore_profile):
    open_profile(driver, api_a)
    fill(driver, whatsapp="+62 812-3456-7890")
    save(driver)
    expect_saved(driver)
    assert api_a.profile()["whatsappNumber"] == "6281234567890"
    driver.refresh()
    css(driver, "#provider-business-name")
    assert "+62 812-3456-7890" in body_text(driver)
    links = [a.get_attribute("href") for a in driver.find_elements(By.CSS_SELECTOR, "a[href*='wa.me/']")]
    assert any(href.startswith("https://wa.me/6281234567890") for href in links), links


@pytest.mark.parametrize("case_id,number", [
    ("TC.PRF.004.004", "081234567"),
    ("TC.PRF.004.005", "08123456789012"),
], ids=["TC.PRF.004.004", "TC.PRF.004.005"])
def test_whatsapp_batas_diterima(case_id, number, driver, api_a, restore_profile):
    open_profile(driver, api_a)
    fill(driver, whatsapp=number)
    save(driver)
    expect_saved(driver)


# ---------------------------------------------------------------------------
# TS.PRF.005 Alamat
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,address,message", [
    ("TC.PRF.005.001", "", "Alamat lengkap wajib diisi."),
    ("TC.PRF.005.002", "Jl 1", "Alamat lengkap minimal 5 karakter."),
], ids=["TC.PRF.005.001", "TC.PRF.005.002"])
def test_alamat_ditolak(case_id, address, message, driver, api_a):
    open_profile(driver, api_a)
    fill(driver, address=address)
    save(driver)
    expect_error(driver, message)


@tc("TC.PRF.005.003")
def test_alamat_5_karakter_diterima(case_id, driver, api_a, restore_profile):
    open_profile(driver, api_a)
    fill(driver, address="Jl 12")
    save(driver)
    expect_saved(driver)


@tc("TC.PRF.005.004")
def test_alamat_256_terpotong(case_id, driver, api_a):
    open_profile(driver, api_a)
    field = driver.find_element(By.ID, "provider-address")
    type_into(field, "J" * 256)
    assert len(field.get_attribute("value")) == 255


# ---------------------------------------------------------------------------
# TS.PRF.006 Area layanan
# ---------------------------------------------------------------------------

@tc("TC.PRF.006.001")
def test_area_2_karakter_ditolak(case_id, driver, api_a):
    open_profile(driver, api_a)
    fill(driver, area="AB")
    save(driver)
    expect_error(driver, "Area layanan minimal 3 karakter.")


@tc("TC.PRF.006.002")
def test_area_batas_bawah_diterima(case_id, driver, api_a, restore_profile):
    open_profile(driver, api_a)
    fill(driver, area="Dago")
    save(driver)
    expect_saved(driver)


@tc("TC.PRF.006.003")
def test_area_101_terpotong(case_id, driver, api_a):
    open_profile(driver, api_a)
    field = driver.find_element(By.ID, "provider-service-area")
    type_into(field, "W" * 101)
    assert len(field.get_attribute("value")) == 100


# ---------------------------------------------------------------------------
# TS.PRF.007 Kategori utama
# ---------------------------------------------------------------------------

@tc("TC.PRF.007.001")
def test_kategori_utama_wajib(case_id, driver, api_a):
    open_profile(driver, api_a)
    select = Select(driver.find_element(By.ID, "provider-category"))
    if "" not in [o.get_attribute("value") for o in select.options]:
        pytest.skip("Pilihan kosong tidak tersedia saat profil sudah punya kategori")
    select.select_by_value("")
    save(driver)
    expect_error(driver, "Kategori utama wajib dipilih.")


# ---------------------------------------------------------------------------
# TS.PRF.008 Jam operasional
# ---------------------------------------------------------------------------

def set_monday(driver, open_time, close_time):
    row = day_row(driver, "Senin")
    checkbox = row.find_element(By.CSS_SELECTOR, ".prf-hour-toggle input")
    if not checkbox.is_selected():
        checkbox.click()
    set_react_value(driver, row.find_element(By.CSS_SELECTOR, "[aria-label='Jam buka hari Senin']"), open_time)
    set_react_value(driver, row.find_element(By.CSS_SELECTOR, "[aria-label='Jam tutup hari Senin']"), close_time)


@pytest.mark.parametrize("case_id,open_time,close_time", [
    ("TC.PRF.008.001", "17:00", "08:00"),
    ("TC.PRF.008.002", "08:00", "08:00"),
], ids=["TC.PRF.008.001", "TC.PRF.008.002"])
def test_jam_tutup_tidak_valid(case_id, open_time, close_time, driver, api_a):
    open_profile(driver, api_a)
    set_monday(driver, open_time, close_time)
    save(driver)
    expect_error(driver, "Jam tutup hari Senin harus lebih lambat dari jam buka.")


@tc("TC.PRF.008.003")
def test_semua_hari_tutup(case_id, driver, api_a):
    open_profile(driver, api_a)
    for day in DAYS:
        checkbox = day_row(driver, day).find_element(By.CSS_SELECTOR, ".prf-hour-toggle input")
        if checkbox.is_selected():
            checkbox.click()
    save(driver)
    expect_error(driver, "Minimal satu hari harus dibuka.")


# ---------------------------------------------------------------------------
# TS.PRF.009 Bio
# ---------------------------------------------------------------------------

@tc("TC.PRF.009.001")
def test_bio_500_diterima(case_id, driver, api_a, restore_profile):
    open_profile(driver, api_a)
    fill(driver, bio="B" * 500)
    save(driver)
    expect_saved(driver)
    assert len(api_a.profile()["bio"]) == 500


@tc("TC.PRF.009.002")
def test_bio_501_terpotong(case_id, driver, api_a):
    open_profile(driver, api_a)
    field = driver.find_element(By.ID, "provider-bio")
    type_into(field, "B" * 501)
    assert len(field.get_attribute("value")) == 500


# ---------------------------------------------------------------------------
# TS.PRF.010 Halaman publik
# ---------------------------------------------------------------------------

@pytest.fixture
def temp_services(api_a):
    before = {s["id"] for s in api_a.services()}
    yield
    for service in api_a.services():
        if service["id"] not in before:
            try:
                api_a.call("DELETE", f"/services/{service['id']}")
            except AssertionError:
                api_a.call("PATCH", f"/services/{service['id']}", json={"isActive": False})


@tc("TC.PRF.010.001")
def test_profil_publik_terlihat(case_id, driver, api_a, restore_profile, temp_services):
    profile = api_a.profile()
    payload = profile_payload(profile)
    payload["isPublic"] = True
    api_a.call("PUT", "/providers/me", json=payload)
    category_id = payload["primaryCategoryId"]
    for name, active in (("[E2E] Jasa Profil Aktif", True), ("[E2E] Jasa Profil Nonaktif", False)):
        api_a.call("POST", "/services", json={
            "categoryId": category_id, "name": name, "description": "Jasa pengujian halaman profil.",
            "price": 50000, "isActive": active,
        })
    driver.get(f"{BASE_URL}/providers/{api_a.me()['id']}")
    wait(driver).until(lambda d: "[E2E] Jasa Profil Aktif" in body_text(d))
    text = body_text(driver)
    assert norm(profile["businessName"]) in text
    assert "[E2E] Jasa Profil Nonaktif" not in text
    assert driver.find_elements(By.CSS_SELECTOR, "a[href*='wa.me/']")


@tc("TC.PRF.010.002")
def test_sembunyikan_profil(case_id, driver, api_a, restore_profile):
    open_profile(driver, api_a)
    fill(driver, public=False)
    save(driver)
    expect_saved(driver)
    wait(driver).until(lambda d: status_pill(d) == "Belum dipublikasikan")
    uid = api_a.me()["id"]
    driver.delete_all_cookies()
    driver.get(f"{BASE_URL}/providers/{uid}")
    wait(driver).until(lambda d: "Profil belum tersedia" in body_text(d))


@tc("TC.PRF.010.003")
def test_profil_publik_tanpa_jasa_aktif(case_id, driver, api_a, restore_profile):
    if any(s.get("isActive") for s in api_a.services()):
        pytest.skip("E2E_PROVIDER_A masih punya jasa aktif; nonaktifkan dulu untuk kasus ini")
    payload = profile_payload(api_a.profile())
    payload["isPublic"] = True
    api_a.call("PUT", "/providers/me", json=payload)
    driver.get(f"{BASE_URL}/providers/{api_a.me()['id']}")
    wait(driver).until(lambda d: "Penyedia ini belum menambahkan layanan yang dipublikasikan saat ini." in body_text(d))


@tc("TC.PRF.010.004")
def test_profil_publik_id_tidak_terdaftar(case_id, driver):
    driver.get(f"{BASE_URL}/providers/22222222-2222-4222-8222-222222222222")
    wait(driver).until(lambda d: "Profil belum tersedia" in body_text(d))
    assert driver.find_element(By.XPATH, "//a[normalize-space()='Kembali ke Beranda']")
