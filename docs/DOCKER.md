# English Desk · Docker kurulumu

Docker kurulumu bilgisayarda Node.js, npm veya Python yüklemeni gerektirmez. Windows/macOS için Docker Desktop; Linux için Docker Engine ve Compose eklentisi gerekir. Docker servisi çalışıyor olmalıdır.

## 1. Kaynak kodundan Compose ile kurulum

Depoyu klonla veya GitHub’daki **Code → Download ZIP** seçeneğiyle indirip arşivi aç. Proje klasöründe:

```sh
git clone https://github.com/Teknoloji-Filozoflari/English-Desk.git
cd English-Desk
docker compose up -d --build --wait
```

Uygulama: **http://127.0.0.1:8081** veya **http://localhost:8081**.

İlk derleme internet bağlantısı gerektirir. Sonraki başlatmalarda hazır yerel imaj kullanılır:

```sh
docker compose up -d --wait
```

Bu yol Linux amd64 ve arm64 için kullanılabilir. M1/M2/M3 gibi ARM işlemcili cihazlarda imaj kendi mimarinde derlenir. İsteğe bağlı otomatik Türkçe çeviri kurucusu Linux amd64 içindir.

### Port değiştirme

8081 portunda mevcut yerel uygulaman çalışıyorsa `Docker.env.example` dosyasının bir kopyasını `.env` adıyla kaydet. İçindeki portu değiştir:

```dotenv
ENGLISH_DESK_PORT=8091
```

Ardından `docker compose up -d --build --wait` çalıştır ve **http://127.0.0.1:8091** adresini aç. Compose, uygulamanın izin verdiği adresleri de bu portla birlikte ayarlar.

## 2. Hazır Docker imajını GitHub’dan indir

[Docker sürüm sayfasından](https://github.com/Teknoloji-Filozoflari/English-Desk/releases/tag/docker-v0.1.0) `english-desk-linux-amd64.tar.gz` dosyasını indir. Bu hazır imaj Linux amd64 içindir; Windows/macOS x86_64 üzerinde Docker Desktop ile de çalışır. ARM cihazlarda yukarıdaki kaynak kodundan derleme yolunu kullan.

İndirdiğin dosyayı Docker’a yükle:

```sh
docker load -i english-desk-linux-amd64.tar.gz
```

Başlat:

```sh
docker run -d --name english-desk --init --restart unless-stopped -p 127.0.0.1:8081:8081 -v english-desk-data:/app/data -v english-desk-translation:/app/.runtime -v english-desk-python:/app/.venv english-desk:docker
```

Uygulama: **http://127.0.0.1:8081**. Bu komut kişisel verileri container’dan bağımsız named volume’lerde tutar.

Hazır imajı Compose ile kullanmak istersen proje klasöründeki `.env` dosyasına `ENGLISH_DESK_IMAGE=english-desk:docker` ekleyip aşağıdakini çalıştır:

```sh
docker compose up -d --no-build --pull never --wait
```

Compose ve doğrudan `docker run` örnekleri farklı adlı veri volume’leri kullanır. Kurulum yöntemini değiştirirken uygulamadan tam ZIP yedeği alıp yeni kurulumda geri yükle.

## Veriler ve yedekleme

| Volume / dizin | İçerik |
| --- | --- |
| `notebook-data` → `/app/data` | Defter, hikâye sesleri, otomatik yedekler ve önbellekler. |
| `translation-runtime` → `/app/.runtime` | İsteğe bağlı çeviri modeli ve kurulum dosyaları. |
| `translation-python` → `/app/.venv` | İsteğe bağlı çeviri ortamı. |

Compose bu volume adlarına proje adını ekler. `docker compose down` container’ı durdurup kaldırır; verileri korur. **`docker compose down -v` veri volume’lerini de siler**, dolayısıyla normal durdurma veya güncellemede kullanma.

Uygulama yeni volume’de boş defterle başlar. Mevcut kurulumundan geçmek için **Yedeği indir → Tam yedek → Sesleri de ekle** yoluyla ZIP al; Docker sürümünde **Yedekten geri yükle** ile yükle.

Container veya imaj kişisel kayıtları içermez. Docker build context’i kaynak dosyalarıyla sınırlıdır; `data/`, `.runtime/`, `.venv/`, `.env`, Git geçmişi ve yerel arşivler imaja kopyalanmaz. Container uygulamayı root kullanıcısı olmadan çalıştırır.

## İsteğe bağlı Türkçe çeviri

Yerel seviye listeleri, WordNet açıklamaları, okuma, notlar, sınavlar ve yedekleme hazırdır. İnternet sözlüğü sorguları bağlantı gerektirir. **Argos Türkçe çeviri paketi temel Docker imajında kurulu değildir.** Linux amd64 üzerinde ayrıca kur:

```sh
docker compose exec english-desk node --use-system-ca scripts/setup-translation.mjs
```

İlk kurulum internet ve ek disk alanı gerektirir. Model ve Python ortamı kalıcı volume’lerde tutulur. Doğrudan `docker run` ile kurduysan aynı işlem:

```sh
docker exec -it english-desk node --use-system-ca scripts/setup-translation.mjs
```

Kurulum tamamlanınca uygulamada **Kelimelerim → Eksikleri tamamla** seçeneğini kullanabilirsin. ARM cihazlarda otomatik çeviri kurucusu desteklenmez; temel çalışma alanları kullanılabilir.

## Durdurma ve güncelleme

Compose kurulumu:

```sh
docker compose down
# Yeniden başlat:
docker compose up -d --wait
# Kaynak kodunu ve imajı güncelle:
git pull
docker compose up -d --build --wait
```

Doğrudan container kurulumu:

```sh
docker stop english-desk
docker start english-desk
```

Yeni hazır imaj indirildiğinde `docker load` çalıştır, eski container’ı durdurup kaldır ve aynı volume seçenekleriyle yeniden oluştur. Named volume’ler korunur. Güncelleme öncesinde uygulamadan ZIP yedeği alabilirsin.

## Durum ve sorun giderme

```sh
docker compose ps
docker compose logs --tail=100 english-desk
```

Sağlık kontrolü `/api/health` adresini kullanır. Başlangıç başarılı olduğunda container **healthy** görünür. İmaj portu 8081’dir; yalnızca bilgisayardaki dış portu `.env` üzerinden değiştir.

- **Docker servisine bağlanamıyor:** Docker Desktop’ı veya Linux Docker servisini başlat.
- **Port zaten kullanılıyor:** Yukarıdaki port değiştirme adımını uygula.
- **Ekran açılıyor ama kayıt yapılamıyor:** Compose’un ayarladığı `127.0.0.1` veya `localhost` adresini kullan; farklı Host/Origin kayıt API’si tarafından reddedilir.
- **Eski kayıtlar görünmüyor:** Kullandığın kurulumun volume’ünü kontrol et veya ZIP yedeğini geri yükle.

Varsayılan port yayını `127.0.0.1` ile bilgisayarına sınırlıdır. Uygulamada hesap/giriş sistemi yoktur; bu kurulum kişisel yerel kullanım içindir.

## Geliştiriciler için doğrulama

```sh
docker compose config --quiet
docker build -t english-desk:ci .
npm ci
npm run test:docker -- --image english-desk:ci
```

Docker testi ayrı bir Compose proje adı, 18081 portu ve geçici volume’ler kullanır. Başlangıç, root olmadan çalışma, Host/Origin kontrolleri, ZIP ve ses geri yükleme, container yeniden oluşturulunca verilerin korunması, otomatik yedek ve ZIP indirme doğrulanır. Test sonunda yalnızca bu test projesinin volume’leri temizlenir.

GitHub’daki **Docker** workflow’u aynı kontrolleri otomatik çalıştırır. **Run workflow → publish_release** seçeneği, başarılı testten sonra doğrulanmış amd64 imajını GitHub Releases’e yükler. Çalışan bir Docker servisi olmadan container testleri çalıştırılamaz.
