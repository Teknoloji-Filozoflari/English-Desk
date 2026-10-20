# Tekrar verisi bütünlüğü

Ezber takvimi öğrenme tarihinden sonraki 1, 3, 7, 14, 30 ve 60. günleri kullanır.
Bu günler önceki tekrar tarihine eklenmez. Geç kalınan adımlar bekler; aynı yerel
günde en fazla bir adım tamamlanır. Altıncı tekrar planı tamamlar.

`addedOn`, `learnedOn` ve `reviews` içindeki günler `YYYY-MM-DD` takvim
etiketleridir. Cihazın yerel günü kayıt anında alınır. Gün ekleme ve saklanan
günlerin doğrulanması saat diliminden bağımsızdır; saat dilimi değiştirmek
geçmişte kaydedilen etiketleri değiştirmez. Güncel gün, cihazın yerel saat
dilimine göre belirlenir. Ekran yerel gece yarısında, uygulama yeniden öne
geldiğinde ve periyodik olarak yenilenir.

Arayüzden gelen cevaplar `src/notebook/services/repetition.ts` üzerinden geçer.
Gösterilen kartın tekrar durumu kayıt anındaki durumla eşleşmelidir. Eski bir
cevabın yeniden gönderilmesi sonraki adımı tamamlamaz. Geçersiz, erken veya
saat geri alındığı için geçmişte kalan cevaplar kayıt üretmez. Arayüzde ayrıca
eşzamanlı gönderimleri engelleyen kilit bulunur. Değişiklik yoksa `persist`
dosyaya tekrar yazmaz. Başarısız kayıtta mevcut veriler ve cevap görünümü korunur.

Eski `review` motorunun hesapları korunur: Tekrar 10 dakika, Zorlandım 1 gün,
Bildim ilk seferde 1 gün, sonrasında önceki aralığın yaklaşık 2,2 katıdır.
`review` ile `memorization` birbirinin geçmişini değiştirmez.

Eski kelimelerde bu iki alanın bulunması zorunlu değildir. Hatalı kayıtlar
geçerli eski kayıtlar gibi değerlendirilmez; doğrulama hatası görünür olur ve
mevcut dosyanın üzerine boş defter yazılmaz.

Tam ve kelime yedekleri iki tekrar alanını da taşır. Geri yüklemede mevcutlara
ekle yöntemi aynı kimlik veya kelime/tür eşleşmesinde mevcut kartı korur;
geçmişleri otomatik birleştirmez. Seçili bölümleri değiştir yöntemi seçilen
bölümün yedekteki halini yükler. Revizyon kontrolü eski bir pencerenin daha yeni
kaydı ezmesini engeller.

İlgili testler:

- `tests/memorization.test.mjs`: sabit takvim ve veri doğrulaması.
- `tests/memorization-timezone.test.mjs`: yerel gün, yaz saati ve saat dilimi geçişleri.
- `tests/repetition.test.mjs`: kayıt komutları ve yinelenen cevaplar.
- `tests/repetition-storage.test.mjs`: gerçek dosya deposu, yeniden başlatma,
  web depolama adaptörü, hata durumları ve JSON geri yükleme.
- `tests/backup-archive.test.mjs`: ZIP gidiş/dönüşü ve eski arşivler.
- `tests/e2e/memorization.spec.mjs`: tarayıcıda seçim, cevap, çift tıklama,
  başarısız kayıt, yenileme ve gece yarısı geçişi.
- `tests/e2e/word-review.spec.mjs`: eski tekrar ekranının üç cevap seçeneği,
  çift tıklama, başarısız kayıt ve yeniden açılış.

Dosya testleri geçici klasörler, tarayıcı testleri ayrı 8082 test sunucusu
kullanır. Kişisel `data/notebook.json` test verisi olarak kullanılmaz.

Playwright'ın test tarayıcısı indirilemiyorsa kurulu Chrome ile aynı testler
çalıştırılabilir. PowerShell'de:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

Bu değişken tanımlı değilken mevcut Chromium yapılandırması kullanılır.

## Faz 1 doğrulaması — 19 Ekim 2026

| Kontrol | Sonuç |
| --- | --- |
| `npm test` | 112 test geçti. |
| `npm run typecheck` | Geçti. |
| `npm run build:web` | Geçti. |
| Ezber tarayıcı testleri | Kurulu Chrome ile masaüstü/mobil görünümde 10 test geçti. |
| Defter, yedekleme, konu ve eski tekrar tarayıcı testleri | Aynı web derlemesinde 38 test geçti. |

Sabit takvim ve eski tekrar motorunun aralık hesapları korunmuştur. Yeni
bağımlılık veya veri alanı eklenmemiştir. Git komutu ve `.git` klasörü
bulunmadığından Git diff doğrulanamamıştır. Android/iOS cihaz testi yapılmamıştır;
mobil tarayıcı testleri cihaz testinin yerine geçmez.
