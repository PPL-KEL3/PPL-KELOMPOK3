"""
PBI-06 / TPR-6: Portofolio Penyedia Jasa (sheet Excel "Service Offering").

Satu fungsi tes = satu Case ID di Excel (lihat nama tes di output `pytest -v`).

Data uji:
- Memakai akun penyedia uji E2E_PROVIDER_A. Sebelum tiap tes, semua item portofolio
  akun itu dihapus (beserta file fotonya), dan dihapus lagi setelah semua tes selesai.
- E2E_PROVIDER_EMPTY dipakai sebagai penyedia tanpa portofolio.
- File uji (PNG, JPG, GIF, PDF, file 0 byte, tepat 5 MB, 5 MB + 1 byte) dibuat otomatis
  di folder _files/ saat tes dijalankan.

Jalankan:  pytest test_tpr6_portfolio.py -v
Satu kasus: pytest test_tpr6_portfolio.py -v -k "TC.PF.003.004"
"""

import io
import os
import pathlib

import pytest
import requests
from PIL import Image
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


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
FILES = pathlib.Path(__file__).with_name("_files")

FIVE_MB = 5 * 1024 * 1024


def env_account(prefix):
    email = os.getenv(f"{prefix}_EMAIL")
    password = os.getenv(f"{prefix}_PASSWORD")
    if not email or not password:
        pytest.skip(f"Akun {prefix}_EMAIL / {prefix}_PASSWORD belum diisi di selenium-tests/.env")
    return email, password


def tc(case_id):
    return pytest.mark.parametrize("case_id", [case_id], ids=[case_id])


# ---------------------------------------------------------------------------
# File uji
# ---------------------------------------------------------------------------

def image_bytes(fmt, color=(46, 125, 50), size=(320, 240)):
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format=fmt)
    return buffer.getvalue()


def make_file(name, content=None, fmt=None, exact_size=None):
    """Membuat file uji. exact_size menambah byte kosong di akhir gambar (tetap terbaca browser)."""
    FILES.mkdir(exist_ok=True)
    path = FILES / name
    data = content if content is not None else image_bytes(fmt)
    if exact_size is not None:
        data = data + b"\0" * (exact_size - len(data))
    path.write_bytes(data)
    return str(path.resolve())


@pytest.fixture(scope="module")
def files():
    return {
        "atap.png": make_file("atap.png", fmt="PNG", exact_size=300 * 1024),
        "dapur.jpg": make_file("dapur.jpg", fmt="JPEG", exact_size=500 * 1024),
        "pas-5mb.png": make_file("pas-5mb.png", fmt="PNG", exact_size=FIVE_MB),
        "lebih-5mb.png": make_file("lebih-5mb.png", fmt="PNG", exact_size=FIVE_MB + 1),
        "kosong.png": make_file("kosong.png", content=b""),
        "dokumen.pdf": make_file("dokumen.pdf", content=b"%PDF-1.4\n% E2E dokumen uji\n%%EOF\n"),
        "animasi.gif": make_file("animasi.gif", fmt="GIF"),
    }


# ---------------------------------------------------------------------------
# Helper API (menyiapkan dan membersihkan data)
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

    def me(self):
        return self.call("GET", "/auth/me")["user"]

    def items(self):
        return self.call("GET", "/providers/me/portfolio")["items"]

    def clear_items(self):
        for item in self.items():
            self.call("DELETE", f"/providers/me/portfolio/{item['id']}")

    def add_item(self, title, description=""):
        data = image_bytes("PNG", color=(25, 90, 140))
        upload = self.call("POST", "/providers/me/portfolio/upload-url", json={
            "fileName": "e2e.png", "contentType": "image/png", "size": len(data),
        })
        put = requests.put(upload["uploadUrl"], data=data,
                           headers={"Content-Type": "image/png"}, timeout=60)
        if not put.ok:
            raise AssertionError(f"Unggah file gagal ({put.status_code}): {put.text}")
        return self.call("POST", "/providers/me/portfolio", json={
            "title": title, "description": description, "imagePath": upload["imagePath"],
        })["item"]


# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def api_a():
    api = Api(*env_account("E2E_PROVIDER_A"))
    yield api
    try:
        api.clear_items()
    except AssertionError as error:
        print(f"Peringatan pembersihan data: {error}")


@pytest.fixture(scope="module")
def uid_a(api_a):
    return api_a.me()["id"]


@pytest.fixture(autouse=True)
def clean_items(api_a):
    api_a.clear_items()
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
    driver.get(BASE_URL + "/login")
    for cookie in api.session.cookies:
        driver.add_cookie({"name": cookie.name, "value": cookie.value, "path": "/"})


def wait(driver, seconds=WAIT):
    return WebDriverWait(driver, seconds)


def tid(driver, name):
    return wait(driver).until(EC.visibility_of_element_located((By.CSS_SELECTOR, f"[data-testid='{name}']")))


def all_tid(driver, name):
    return driver.find_elements(By.CSS_SELECTOR, f"[data-testid='{name}']")


def wait_gone(driver, name, seconds=WAIT):
    wait(driver, seconds).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, f"[data-testid='{name}']")))


def toast(driver, text, seconds=WAIT):
    wait(driver, seconds).until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, ".toast-stack"), text))


def type_into(element, text):
    element.send_keys(Keys.CONTROL, "a")
    element.send_keys(Keys.DELETE)
    if text:
        element.send_keys(text)


def open_portfolio(driver):
    driver.get(BASE_URL + "/provider/dashboard/portfolio")
    wait(driver).until(lambda d: all_tid(d, "pf-card") or all_tid(d, "pf-state"))


def open_add_modal(driver):
    tid(driver, "pf-add").click()
    tid(driver, "pf-form-modal")


def choose_file(driver, path):
    driver.find_element(By.CSS_SELECTOR, "[data-testid='pf-file-input']").send_keys(path)


def fill(driver, title=None, description=None):
    if title is not None:
        type_into(driver.find_element(By.ID, "portfolio-title-input"), title)
    if description is not None:
        type_into(driver.find_element(By.ID, "portfolio-description-input"), description)


def card_titles(driver):
    return [e.text for e in all_tid(driver, "pf-card-title")]


def card(driver, title):
    for element in all_tid(driver, "pf-card"):
        if element.find_element(By.CSS_SELECTOR, "[data-testid='pf-card-title']").text == title:
            return element
    raise AssertionError(f'Kartu portofolio "{title}" tidak ditemukan')


def slots(driver):
    return tid(driver, "pf-slots").text


def drop_message(driver, text):
    wait(driver).until(EC.text_to_be_present_in_element(
        (By.CSS_SELECTOR, "[data-testid='pf-drop-message']"), text))


def field_error(driver, message):
    wait(driver).until(EC.text_to_be_present_in_element(
        (By.CSS_SELECTOR, "[data-testid='pf-form-modal']"), message))
    assert any(message in e.text for e in all_tid(driver, "pf-field-error"))
    assert all_tid(driver, "pf-form-modal"), "Modal seharusnya tetap terbuka"


def save_new(driver, path, title, description=""):
    open_add_modal(driver)
    choose_file(driver, path)
    tid(driver, "pf-preview")
    fill(driver, title=title, description=description)
    tid(driver, "pf-form-submit").click()
    wait_gone(driver, "pf-form-modal", seconds=60)
    toast(driver, "Portofolio baru berhasil ditambahkan.")


# ---------------------------------------------------------------------------
# TS.PF.001 Akses & tampilan
# ---------------------------------------------------------------------------

@tc("TC.PF.001.001")
def test_akses_halaman_dari_sidebar(case_id, driver, api_a):
    login(driver, api_a)
    driver.get(BASE_URL + "/provider/dashboard")
    links = wait(driver).until(lambda d: d.find_elements(By.CSS_SELECTOR, "nav a[href]"))
    hrefs = [link.get_attribute("href").replace(BASE_URL, "") for link in links]
    assert hrefs.index("/provider/dashboard/portfolio") == hrefs.index("/provider/dashboard/packages") + 1
    driver.find_element(By.CSS_SELECTOR, "a[href='/provider/dashboard/portfolio']").click()
    wait(driver).until(EC.url_contains("/provider/dashboard/portfolio"))
    wait(driver).until(EC.text_to_be_present_in_element((By.TAG_NAME, "body"), "Portofolio Pekerjaan"))
    active = driver.find_element(By.CSS_SELECTOR, "a[href='/provider/dashboard/portfolio']")
    assert active.get_attribute("aria-current") == "page"


@tc("TC.PF.001.002")
def test_belum_ada_portofolio(case_id, driver):
    api_empty = Api(*env_account("E2E_PROVIDER_EMPTY"))
    api_empty.clear_items()
    login(driver, api_empty)
    open_portfolio(driver)
    assert tid(driver, "pf-state-title").text == "Belum ada portofolio."
    assert tid(driver, "pf-empty-add").is_displayed()


@tc("TC.PF.001.003")
def test_penanda_slot_tersisa(case_id, driver, api_a):
    for index in range(3):
        api_a.add_item(f"Item {index + 1}")
    login(driver, api_a)
    open_portfolio(driver)
    assert slots(driver) == "17 slot tersisa"


# ---------------------------------------------------------------------------
# TS.PF.002 Tambah
# ---------------------------------------------------------------------------

@pytest.mark.alur_utama
@tc("TC.PF.002.001")
def test_tambah_portofolio_png(case_id, driver, api_a, files):
    login(driver, api_a)
    open_portfolio(driver)
    before = slots(driver)
    open_add_modal(driver)
    choose_file(driver, files["atap.png"])
    assert tid(driver, "pf-preview").is_displayed()
    fill(driver, title="Perbaikan Atap Bocor", description="Ganti genteng pecah.")
    tid(driver, "pf-form-submit").click()
    wait_gone(driver, "pf-form-modal", seconds=60)
    toast(driver, "Portofolio baru berhasil ditambahkan.")
    assert card_titles(driver)[0] == "Perbaikan Atap Bocor"
    assert int(slots(driver).split()[0]) == int(before.split()[0]) - 1


@tc("TC.PF.002.002")
def test_tambah_portofolio_jpg_tanpa_deskripsi(case_id, driver, api_a, files):
    login(driver, api_a)
    open_portfolio(driver)
    save_new(driver, files["dapur.jpg"], "Renovasi Dapur")
    assert card_titles(driver)[0] == "Renovasi Dapur"
    assert not card(driver, "Renovasi Dapur").find_elements(By.CSS_SELECTOR, "[data-testid='pf-card-desc']")


# ---------------------------------------------------------------------------
# TS.PF.003 Validasi file
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,file_key,message", [
    ("TC.PF.003.001", "dokumen.pdf", "Format file tidak didukung. Gunakan foto JPG atau PNG."),
    ("TC.PF.003.002", "animasi.gif", "Format file tidak didukung. Gunakan foto JPG atau PNG."),
    ("TC.PF.003.003", "kosong.png", "File kosong. Pilih foto lain."),
], ids=["TC.PF.003.001", "TC.PF.003.002", "TC.PF.003.003"])
def test_file_ditolak(case_id, file_key, message, driver, api_a, files):
    login(driver, api_a)
    open_portfolio(driver)
    open_add_modal(driver)
    choose_file(driver, files[file_key])
    drop_message(driver, message)
    assert not all_tid(driver, "pf-preview")


@tc("TC.PF.003.004")
def test_file_tepat_5mb_diterima(case_id, driver, api_a, files):
    login(driver, api_a)
    open_portfolio(driver)
    save_new(driver, files["pas-5mb.png"], "Foto Batas 5 MB")
    assert card_titles(driver)[0] == "Foto Batas 5 MB"


@tc("TC.PF.003.005")
def test_file_lebih_5mb_ditolak(case_id, driver, api_a, files):
    login(driver, api_a)
    open_portfolio(driver)
    open_add_modal(driver)
    choose_file(driver, files["lebih-5mb.png"])
    drop_message(driver, "melebihi batas 5 MB. Pilih foto lain.")
    assert not tid(driver, "pf-form-submit").is_enabled()


# ---------------------------------------------------------------------------
# TS.PF.004 Validasi judul & deskripsi
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case_id,title,message", [
    ("TC.PF.004.001", "   ", "Judul wajib diisi."),
    ("TC.PF.004.002", "Ab", "Judul minimal 3 karakter."),
], ids=["TC.PF.004.001", "TC.PF.004.002"])
def test_judul_ditolak(case_id, title, message, driver, api_a, files):
    login(driver, api_a)
    open_portfolio(driver)
    open_add_modal(driver)
    choose_file(driver, files["atap.png"])
    tid(driver, "pf-preview")
    fill(driver, title=title)
    tid(driver, "pf-form-submit").click()
    field_error(driver, message)
    assert not all_tid(driver, "pf-progress"), "Tidak boleh ada unggahan saat judul tidak valid"


@pytest.mark.parametrize("case_id,title", [
    ("TC.PF.004.003", "Abc"),
    ("TC.PF.004.004", "J" * 100),
], ids=["TC.PF.004.003", "TC.PF.004.004"])
def test_judul_batas_diterima(case_id, title, driver, api_a, files):
    login(driver, api_a)
    open_portfolio(driver)
    save_new(driver, files["atap.png"], title)
    assert card_titles(driver)[0] == title


@tc("TC.PF.004.005")
def test_judul_101_terpotong(case_id, driver, api_a):
    login(driver, api_a)
    open_portfolio(driver)
    open_add_modal(driver)
    field = driver.find_element(By.ID, "portfolio-title-input")
    field.send_keys("J" * 101)
    assert len(field.get_attribute("value")) == 100


@tc("TC.PF.004.006")
def test_deskripsi_500_diterima(case_id, driver, api_a, files):
    login(driver, api_a)
    open_portfolio(driver)
    save_new(driver, files["atap.png"], "Pengecatan Rumah", description="D" * 500)
    desc = card(driver, "Pengecatan Rumah").find_element(By.CSS_SELECTOR, "[data-testid='pf-card-desc']")
    assert len(desc.text) == 500


@tc("TC.PF.004.007")
def test_deskripsi_501_terpotong(case_id, driver, api_a):
    login(driver, api_a)
    open_portfolio(driver)
    open_add_modal(driver)
    field = driver.find_element(By.ID, "portfolio-description-input")
    field.send_keys("D" * 501)
    assert len(field.get_attribute("value")) == 500


# ---------------------------------------------------------------------------
# TS.PF.005 Edit
# ---------------------------------------------------------------------------

@tc("TC.PF.005.001")
def test_edit_judul(case_id, driver, api_a):
    api_a.add_item("Perbaikan Atap Bocor", "Ganti genteng pecah.")
    login(driver, api_a)
    open_portfolio(driver)
    card(driver, "Perbaikan Atap Bocor").find_element(By.CSS_SELECTOR, "[data-testid='pf-card-edit']").click()
    tid(driver, "pf-form-modal")
    assert driver.find_element(By.ID, "portfolio-title-input").get_attribute("value") == "Perbaikan Atap Bocor"
    fill(driver, title="Pengecatan Ulang Ruang Tamu")
    tid(driver, "pf-form-submit").click()
    wait_gone(driver, "pf-form-modal", seconds=60)
    toast(driver, "Perubahan portofolio disimpan.")
    assert "Pengecatan Ulang Ruang Tamu" in card_titles(driver)


@tc("TC.PF.005.002")
def test_ganti_foto(case_id, driver, api_a, files):
    api_a.add_item("Perbaikan Atap Bocor")
    login(driver, api_a)
    open_portfolio(driver)
    old_src = card(driver, "Perbaikan Atap Bocor").find_element(By.TAG_NAME, "img").get_attribute("src")
    card(driver, "Perbaikan Atap Bocor").find_element(By.CSS_SELECTOR, "[data-testid='pf-card-edit']").click()
    tid(driver, "pf-form-modal")
    choose_file(driver, files["dapur.jpg"])
    tid(driver, "pf-form-submit").click()
    wait_gone(driver, "pf-form-modal", seconds=60)
    toast(driver, "Perubahan portofolio disimpan.")
    wait(driver).until(lambda d: card(d, "Perbaikan Atap Bocor")
                       .find_element(By.TAG_NAME, "img").get_attribute("src") != old_src)


@tc("TC.PF.005.003")
def test_konfirmasi_buang_perubahan(case_id, driver, api_a):
    api_a.add_item("Perbaikan Atap Bocor")
    login(driver, api_a)
    open_portfolio(driver)
    card(driver, "Perbaikan Atap Bocor").find_element(By.CSS_SELECTOR, "[data-testid='pf-card-edit']").click()
    tid(driver, "pf-form-modal")
    title = driver.find_element(By.ID, "portfolio-title-input")
    fill(driver, title="Judul Diubah")
    title.send_keys(Keys.ESCAPE)
    tid(driver, "pf-discard-dialog")
    tid(driver, "pf-discard-keep").click()
    wait_gone(driver, "pf-discard-dialog")
    assert title.get_attribute("value") == "Judul Diubah"
    title.send_keys(Keys.ESCAPE)
    tid(driver, "pf-discard-confirm").click()
    wait_gone(driver, "pf-form-modal")
    assert card_titles(driver) == ["Perbaikan Atap Bocor"]


# ---------------------------------------------------------------------------
# TS.PF.006 Hapus
# ---------------------------------------------------------------------------

@tc("TC.PF.006.001")
def test_batal_hapus(case_id, driver, api_a):
    api_a.add_item("Perbaikan Atap Bocor")
    login(driver, api_a)
    open_portfolio(driver)
    card(driver, "Perbaikan Atap Bocor").find_element(By.CSS_SELECTOR, "[data-testid='pf-card-delete']").click()
    target = tid(driver, "pf-delete-target")
    assert "Perbaikan Atap Bocor" in target.text
    assert target.find_element(By.TAG_NAME, "img").is_displayed()
    tid(driver, "pf-delete-cancel").click()
    wait_gone(driver, "pf-delete-dialog")
    assert card_titles(driver) == ["Perbaikan Atap Bocor"]


@tc("TC.PF.006.002")
def test_hapus_dengan_konfirmasi(case_id, driver, api_a):
    api_a.add_item("Perbaikan Atap Bocor")
    login(driver, api_a)
    open_portfolio(driver)
    assert slots(driver) == "19 slot tersisa"
    card(driver, "Perbaikan Atap Bocor").find_element(By.CSS_SELECTOR, "[data-testid='pf-card-delete']").click()
    tid(driver, "pf-delete-confirm").click()
    toast(driver, "Portofolio dihapus permanen.")
    wait(driver).until(lambda d: "Perbaikan Atap Bocor" not in card_titles(d))
    assert slots(driver) == "20 slot tersisa"


# ---------------------------------------------------------------------------
# TS.PF.007 Batas 20 item
# ---------------------------------------------------------------------------

@tc("TC.PF.007.001")
def test_tambah_item_ke_20(case_id, driver, api_a, files):
    for index in range(19):
        api_a.add_item(f"Item {index + 1:02d}")
    login(driver, api_a)
    open_portfolio(driver)
    save_new(driver, files["atap.png"], "Item Ke-20")
    assert slots(driver) == "0 slot tersisa"


@tc("TC.PF.007.002")
def test_tidak_bisa_tambah_item_ke_21(case_id, driver, api_a):
    for index in range(20):
        api_a.add_item(f"Item {index + 1:02d}")
    login(driver, api_a)
    open_portfolio(driver)
    assert not tid(driver, "pf-add").is_enabled()
    assert tid(driver, "pf-limit-notice").text == \
        "Maksimal 20 item per penyedia. Hapus item lama untuk menambah yang baru."


# ---------------------------------------------------------------------------
# TS.PF.008 Halaman publik (sesi browser tanpa login)
# ---------------------------------------------------------------------------

def seed_three(api):
    for title in ("Foto Pertama", "Foto Kedua", "Foto Ketiga"):
        api.add_item(title)


@pytest.mark.alur_utama
@tc("TC.PF.008.001")
def test_publik_galeri_urut_terbaru(case_id, driver, api_a, uid_a):
    seed_three(api_a)
    driver.get(f"{BASE_URL}/preview/providers/{uid_a}/portfolio")
    wait(driver).until(lambda d: len(all_tid(d, "pfpub-tile")) == 3)
    titles = [e.text for e in all_tid(driver, "pfpub-tile-title")]
    assert titles == ["Foto Ketiga", "Foto Kedua", "Foto Pertama"]


@tc("TC.PF.008.002")
def test_publik_navigasi_lightbox(case_id, driver, api_a, uid_a):
    seed_three(api_a)
    driver.get(f"{BASE_URL}/preview/providers/{uid_a}/portfolio")
    wait(driver).until(lambda d: len(all_tid(d, "pfpub-tile")) == 3)
    all_tid(driver, "pfpub-tile")[0].click()
    counter = tid(driver, "pfpub-lightbox-counter")
    assert counter.text.replace(" ", "") == "1/3"
    body = driver.find_element(By.TAG_NAME, "body")
    for _ in range(3):
        body.send_keys(Keys.ARROW_RIGHT)
    wait(driver).until(lambda d: tid(d, "pfpub-lightbox-counter").text.replace(" ", "") == "3/3")
    body.send_keys(Keys.ESCAPE)
    wait_gone(driver, "pfpub-lightbox")


@tc("TC.PF.008.003")
def test_publik_penyedia_tanpa_portofolio(case_id, driver):
    api_empty = Api(*env_account("E2E_PROVIDER_EMPTY"))
    api_empty.clear_items()
    uid = api_empty.me()["id"]
    driver.get(f"{BASE_URL}/preview/providers/{uid}/portfolio")
    assert tid(driver, "pfpub-state-title").text == "Penyedia ini belum menambahkan portofolio."


@tc("TC.PF.008.004")
def test_publik_id_bukan_penyedia(case_id, driver):
    driver.get(f"{BASE_URL}/preview/providers/22222222-2222-4222-8222-222222222222/portfolio")
    assert tid(driver, "pfpub-state-title").text == "Penyedia jasa tidak ditemukan."
