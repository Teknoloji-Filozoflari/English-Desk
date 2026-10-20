# FAZ 10 — Son kalite kontrolü ve teslim

Tarih: **20 Ekim 2026 — Europe/Istanbul**. Proje sürümü: `0.1.0`.

## Teslim kapsamı

Faz 1–9'un ortak veri modeli, çalışma motorları, arayüz ve dosya kayıt akışları
birlikte değerlendirildi. Tam koşuda görülen Windows dosya değiştirme hatasına
hedefli bir düzeltme uygulandı. Veri şeması, tekrar takvimi, renkler ve yazı
tipleri değiştirilmedi. Test beklentileri düşürülmedi ve test kaldırılmadı.
Yeni teslim ve dosya kilidi testleri önceki senaryolara eklenmiştir.

Bu rapordaki sonuçlar Windows üzerinde Node.js 24.11.0, TypeScript 6 ve
kurulu Chrome ve Playwright 1.63.0 ile alınmıştır. Mobil uçtan uca testler Pixel 7 emülasyonudur;
320 px genişlik ve 480 px ekran yüksekliği senaryoları da ayrıca kapsanır.
Yeni teslim senaryosu 20–21 Ekim 2026 İstanbul saatine sabitlenmiştir; eski
testlerin kendi sabit tarihleri korunmuştur.

**Veri kaynağı:** Sayaçlar ve istatistikler sabit arayüz metinlerinden veya
taklit edilmiş sonuç API'sinden okunmadı. Sentetik çalışma kayıtları gerçek
`/api/notebook` üzerinden geçici dosya deposuna yazıldı; arayüzdeki sonuçlar,
kaydedilen cevaplar ve indirilen yedek içerikleri karşılaştırıldı. Kullanıcının
kişisel defteri test verisi olarak okunmadı veya değiştirilmedi. Sözlük gibi
harici servisler gerektiğinde kontrollü yanıtlarla sınırlandırıldı.

## Tamamlanan özellikler ve birlikte çalışma kontrolü

| Faz / alan                            | Teslim edilen davranış                                                                                           | Kanıt / kontrol                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 · Veri bütünlüğü                    | Ezber günü ve 1, 3, 7, 14, 30, 60 günlük takvim; günde tek başarılı adım; eski kayıt uyumluluğu                  | `memorization`, `memorization-timezone`, `repetition`, `repetition-storage` testleri; çift cevap, gecikme, saat dilimi ve yeniden başlatma |
| 2 · Günlük çalışma                    | Bekleyen/tamamlanan tekrar, yeni kelime hedefi, süre tahmini ve gerçek çalışma ekranlarına bağlantılar           | `daily-study` testleri; kayıt öncesi/sonrası sayaç, gece yarısı ve hedefin yeniden açılması                                                |
| 3 · Aktif hatırlama                   | Klasik kart, İngilizce→Türkçe, Türkçe→İngilizce, yazılı cevap, boşluk doldurma                                   | `word-practice` testleri; beş modda başarı/yanlış, açıklama, belirsiz cevap, çift kayıt ve başarısız yazmayı yeniden deneme                |
| 4 · Bağlam ve ifadeler                | Özgün kaynak cümleleri, kişisel örnekler, çoklu anlam, phrasal verb/collocation ve etiketler                     | `word-context` testleri; birden çok kaynak, kişisel örnek düzenleme, bağlamdan çalışma ve yedek korunması                                  |
| 5 · Gramer ve sınav yanlışları        | Kural hatırlama, örnek seçme, cümle tamamlama; yanlış soruları yeniden çözme; haftalık karma                     | `learning` testleri; ayrı geçmişler, asıl sınav sonucunun değişmemesi, devam/yeniden açılış ve hata durumları                              |
| 6 · İstatistikler                     | İlk öğrenme ve başarılı tekrar ayrımı, günlük/haftalık geçmiş, başarı oranları, zorlanılan içerikler ve hedefler | `progress` testleri; yinelenen içe aktarmaların etkisi, eski geçmiş, tarih sınırları ve çalışan içerik kısayolları                         |
| 7 · Kelime aktarımı                   | CSV/TSV, Anki metin TSV'si, önizleme ve sütun eşleştirmesi; onaylı ekleme/boş alan tamamlama                     | `word-transfer` testleri; UTF-8/Türkçe, satır sonu/tırnak, tekrarlar, bozuk dosya, indirme ve JSON/ZIP gidiş-dönüşü                        |
| 8 · Tema korunarak UI                 | Dar ekran satırları, kaydırılabilir gezinme, klavye odağı, erişilebilir işlem boyutları                          | `ui-layout` testleri ve ekran görüntüleri; Bugün, kelimeler, gramer, sınavlar, hikâyeler ve istatistik paneli                              |
| 9 · Platform ve veri güvenliği        | Yerel web/native ayrımı; dış servis kesintisi ve iki pencere çakışması koruması; native JS derleme kontrolü      | `platform-safety`, `server-config` ve dosya deposu testleri; web/Android/iOS derlemeleri                                                   |
| 10 · Fazları birleştiren teslim testi | CSV'den gelen kelimenin ezberlenmesi, ertesi gün cevaplanması, canlı raporu ve yeni oturumdaki tam ZIP yedeği    | Yeni `tests/e2e/delivery.spec.mjs`, masaüstü ve mobil                                                                                      |

Ezber takvimi ilk öğrenme gününe bağlıdır. Gecikmiş tekrar kaydedilen gerçek günü
tutar ve ilk öğrenme gününe göre planı kaydırmaz. **Ezber dışındaki mevcut Tekrar
et motoru** kendi aralıklarını kullanmaya devam eder: yanlış cevap yaklaşık
10 dakika, zorlanma 1 gün, başarılı cevap mevcut aralığa göre ilerler. Bu iki
takvim final kontrolünde birbirine dönüştürülmedi.

## Yeni birleşik senaryonun gözlenen değerleri

Tek bir `remember / hatırlamak` kaydı CSV ile arayüzden içe alındı:

| Aşama                                              | Beklenen ve doğrulanan durum                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Aktarım önizlemesi                                 | Onaydan önce depoda 0 kelime                                                                                   |
| 20 Ekim öğrenme kaydı                              | `learnedOn: 2026-10-20`, günlük yeni öğrenilen `1 / 1`                                                         |
| 21 Ekim, cevap öncesi                              | Kalan tekrar 1; kart çevrilince `reviews` hâlâ boş                                                             |
| Cevabı kaydetme                                    | `reviews: [2026-10-21]`; başlangıç tarihi değişmedi                                                            |
| Eski sayfa kapatılıp boş tarayıcı bağlamı açılınca | Kalan 0, tamamlanan 1, yeni öğrenilen `0 / 1`                                                                  |
| İstatistikler                                      | İlk öğrenme kaydı olan 1, başarılı tekrarı bulunan 1, bugün kaydedilen tekrar 1                                |
| Tam ZIP                                            | İndirilen arşivde kelime, tekrar geçmişi ve hedefler dosya deposuyla eşit; dışa aktarma revizyonu değiştirmedi |

Tarayıcı bağlamının yenilenmesi eski React durumu ve localStorage'a dayanmadan
dosyadan yüklemeyi doğrular. Ayrıca `repetition-storage.test.mjs` kaydı ayrı bir
Node işlemi açarak yeniden okur; altı ezber günü ve eski tekrar bilgisi korunur.
Bu kontroller fiziksel telefon uygulamasını kapatıp açma testi değildir.

## Bulunan ve düzeltilen hata

İlk tam tarayıcı koşusunda 157 test geçti, 1 test başarısız oldu.
`word-context.spec.mjs` kişisel örnekten boşluk doldurma cevabını kaydederken
Windows dosya sistemi `.notebook-....tmp → notebook.json` yeniden adlandırmasını
`EPERM` ile reddetti. Arayüz kaydetme hatasını gösterdi, eski kayıt korundu,
fakat cevap kaydedilemedi. Beklenti değiştirilmedi veya test kaldırılmadı.

`scripts/notebook-store.mjs` aynı atomik yeniden adlandırmayı yalnız Windows'ta
`EPERM`, `EACCES`, `EBUSY` hataları için en fazla altı kez dener. Beş bekleme
20/40/80/160/320 ms, toplam 620 ms'dir; dosya sistemi işlem süreleri ayrıca
eklenir. Hedef dosya silinmez veya boşaltılmaz. Doğrulama, revizyon kontrolü,
işlem sırası ve önceki kayıt yedeği korunur. Kalıcı hata aynı şekilde kullanıcıya
iletilir ve başarısız işlemin geçici dosyası temizlenmeye çalışılır.

Yeni `store-replacement.test.mjs` gerçek geçici dosyalarla geçici kilit sonrası
tek kayıt/tek yedek, sınırlı kalıcı hata, aynı depoda sonraki yazma, eski revizyon
reddi, temizleme ve Windows dışındaki hataları doğrular. Beş yeni birim testi
eklenmiştir. Kilidi hangi harici sürecin oluşturduğu tespit edilmedi; gözlenen
`EPERM` durumu üzerinden düzeltme yapılmıştır.

İlk başarısız koşunun log, JSON sonuç, hata bağlamı ve trace dosyaları
`.tools/phase10/initial-failure/` altında ayrıca saklanır. Düzeltmeden sonraki
tam koşunun sonucu aşağıda ayrı raporlanır.

Ara doğrulama koşusunda web derlemesi testlerle aynı anda çalıştırıldığı için
iki masaüstü sayfa yüklemesi `Not found` aldı (156 geçti, 2 başarısız).
Bu, doğrulama sırasındaki derleme/test çakışmasıydı; temiz sonuç sayılmadı ve
beklentiler değiştirilmedi. Log ve sonuçlar `.tools/phase10/rebuild-overlap/`
altında saklandı. Son tam koşu bitmiş ve sabit web çıktıları üzerinde, eşzamanlı
derleme olmadan yeniden çalıştırıldı.

## Bu fazın test sonuçları

| Komut / kontrol        | Sonuç                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| `npm run typecheck`    | Başarılı; TypeScript hatası yok                                                 |
| `npm test`             | 221 test geçti; 0 hata, 0 atlama, 0 iptal                                       |
| `npm run build:web`    | Başarılı; `dist/` üretildi                                                      |
| `npm run check:native` | Android ve iOS JavaScript derlemeleri başarılı; `native-bundles/` üretildi      |
| Yeni teslim senaryosu  | Masaüstü ve mobilde 2 test geçti                                                |
| Tüm uçtan uca testler  | 158 geçti: 79 masaüstü + 79 mobil; 0 hata, 0 atlama, 0 kararsız (flaky); 4,6 dk |

Son tam koşuda otomatik yeniden deneme kullanılmadı; başarısız, atlanan ve kararsız (flaky) test sayıları sıfırdır. Değişen kaynak ve belgelerin Prettier kontrolü de geçti.

Web çıktısı: `_expo/static/js/web/index-86c7feb3a808961252ebd06d3b2864df.js`.
Android çıktısı: `_expo/static/js/android/index-d3fe20ada1b567179f52924193d74592.js`.
iOS çıktısı: `_expo/static/js/ios/index-9d53e7bf46baa7f230ed1c847759da51.js`.
Bunlar bu çalıştırmanın çıktılarıdır; kaynak değişince adları değişebilir.

Yerel ham çıktı dosyaları (Git dışında):

- `.tools/phase10/typecheck.log`, `unit.log`, `build-web.log`, `native.log`.
- `.tools/phase10/e2e.log` ve makine tarafından okunabilir `e2e.json`.
- `playwright-report/index.html`; `test-results/` içindeki dar ekran, günlük
  panel, çalışma kartı ve yeni teslim senaryosunun ekran görüntüleri.

Test sunucusu 8082 portunda her çalışmada ayrı geçici klasör kullanır. Üretim
`data/` klasörüyle aynı depo kullanılmaz. Bu oturumda kişisel `notebook.json`
bulunmadığı da kontrol edildi; `data/` altında yalnız mevcut `README.md` vardı.

Windows'ta Playwright yardımcı sunucusunun kapanışı beklemede kaldığından her
koşuda tüm testlerin sonuçları yazıldıktan sonra yalnız o koşunun bilinen test
sunucusu işlemi kapatıldı ve Playwright'ın nihai özeti/çıkış kodu alındı.
Testler sürerken sunucu sonlandırılmadı; test başarısızlığı gizlenmedi.
Bu test altyapısı kapanış sorunu otomatik olarak çözülmedi.

## Değişen dosyalar

Bu **Faz 10** kapsamında değiştirilen/eklenen dosyalar:

| Dosya                              | Değişiklik                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/delivery.spec.mjs`      | CSV→ezber→ertesi gün cevap→canlı rapor→yeni oturum→ZIP doğrulayan yeni senaryo                                                              |
| `README.md`                        | Kullanım başlıklarının ayrılması; çevrimdışı/yerel sunucu, çakışma ve kurtarma sınırları; native kontrol komutu ve teslim raporu bağlantısı |
| `docs/DELIVERY-REPORT.md`          | Bu rapor, kapsam, sonuçlar, dosya envanteri ve sınırlamalar                                                                                 |
| `scripts/notebook-store.mjs`       | Windows geçici dosya kilitleri için sınırlı atomik değiştirme denemesi ve başarısız işlem geçici dosyası temizliği                          |
| `tests/store-replacement.test.mjs` | Geçici/kalıcı kilit ve veri koruma için beş yeni birim testi                                                                                |

Çalıştırılan araçların ürettiği `dist/`, `native-bundles/`, `.expo/`,
`test-results/`, `playwright-report/` ve `.tools/phase10/` kaynak kod değişikliği
değildir; yeniden üretilebilir yerel çıktılardır. Paket veya bağımlılık eklenmedi.

Önceki fazların başlıca uygulama dosyaları (izlenebilirlik envanteri):

| Alan                            | İlgili dosyalar                                                                                                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model / kayıt / tekrar          | `src/model.ts`, `src/memorization.ts`, `src/review.ts`, `src/storage.ts`, `src/storage.web.ts`, `src/notebook/services/repetition.ts`, `scripts/notebook-store.mjs`                                                                                       |
| Günlük panel / rapor            | `src/daily-study.ts`, `src/progress.ts`, `src/word-history.ts`, `src/study-clock.ts`, `src/notebook/screens/DailyStudyScreen.tsx`, `src/notebook/components/ProgressPanel.tsx`, `src/notebook/hooks/useStudyClock.ts`                                     |
| Kelime modları ve bağlam        | `src/word-practice.ts`, `src/word-context.ts`, `src/notebook/services/practice.ts`, `src/notebook/screens/WordPracticeScreen.tsx`, `src/notebook/components/WordCardBack.tsx`, `WordContextsPanel.tsx`, `WordDetailsModal.tsx`, `EditorModal.tsx`         |
| Gramer / sınav çalışması        | `src/learning.ts`, `src/ExamDesk.tsx`, `src/notebook/screens/GrammarPracticeScreen.tsx`, `ExamLearningScreen.tsx`, `src/notebook/components/LearningRound.tsx`                                                                                            |
| Aktarım / yedek                 | `src/word-transfer.ts`, `src/word-transfer-file.ts`, `src/word-transfer-file.web.ts`, `src/backup-core.ts`, `src/backup.ts`, `src/backup.web.ts`, `scripts/backup-api.mjs`, `scripts/backup-archive.mjs`, `src/notebook/components/WordTransferModal.tsx` |
| Tema korunarak UI / bağlantılar | `src/notebook/NotebookApp.tsx`, `src/notebook/styles.ts`, `src/notebook/components/Navigation.tsx`, `FocusStyles.tsx`, `FocusStyles.web.tsx`, `src/notebook/screens/WordsScreen.tsx`, `GrammarScreen.tsx`, `src/CollectionBrowser.tsx`                    |
| Otomatik kontroller / belgeler  | `package.json`, `.github/workflows/ci.yml`, `tests/*.test.mjs`, `tests/e2e/*.spec.mjs`, faz raporları                                                                                                                                                     |

Önceki faz belgeleri: [tekrar](REPETITION-INTEGRITY.md), [günlük panel](DAILY-STUDY.md),
[kelime modları](WORD-PRACTICE.md), [bağlam](CONTEXT-LEARNING.md),
[gramer/sınav](GRAMMAR-EXAM-LEARNING.md), [istatistikler](LEARNING-PROGRESS.md),
[aktarım](WORD-TRANSFER.md), [UI](UI-POLISH.md), [platformlar](PLATFORMS-AND-SYNC.md).
Önceki raporlardaki sayılar o fazın tarihsel test sonuçlarıdır.

Bu çalışma klasöründe `.git` ve kullanılabilir Git komutu bulunmadığından önceki
fazlar için commit bazlı eksiksiz diff veya commit SHA raporlanamıyor. Yukarıdaki
önceki faz tablosu ilgili dosya envanteridir; doğrulanmış bir Git değişiklik
listesi iddiası taşımaz. Faz 10'un doğrudan yapılan değişiklikleri ayrı listelendi.

## Bilinen hatalar, desteklenmeyen ve yapılmamış işler

1. **Bozuk web kayıt dosyasını uygulama içinden kurtarma:** `notebook.json`
   okunamazsa geri yükleme de mevcut dosyanın revizyonunu okuyamaz. Otomatik
   onarım uygulanmadı. Orijinal dosya ve otomatik yedekler korunarak ayrı dosya
   kurtarma gerekir; geçerli bir deftere JSON/ZIP geri yükleme testleri geçmiştir.
2. **Platform doğrulaması:** Android/iOS yalnız JavaScript derleme düzeyinde
   doğrulandı. Fiziksel cihaz, native dosya seçici/paylaşımı, AsyncStorage
   kalıcılığı, izinler, arka plandan dönüş ve Hermes çalıştırması test edilmedi.
   APK/AAB/IPA, imzalama veya masaüstü kurulum paketi hazırlanmadı.
3. **Tarayıcı / container kapsamı:** Chrome masaüstü ve mobil emülasyon test
   edildi. Safari, Firefox ve Docker çalışma testi bu oturumda yapılmadı.
   Güncellenmiş uzak GitHub CI bu oturumdan çalıştırılmadı.
4. **Çevrimdışı sınırı:** Web dosya kaydı için yerel sunucu gerekir. Sunucusuz
   PWA veya çevrimdışı yazma kuyruğu yok. İlk kurulum ve bazı sözlük kaynakları
   internet gerektirir; tüm dış sözlük/çeviri servisleri canlı olarak sınanmadı.
5. **Native özellik farkları:** JSON yedekleme var; ZIP/ses dosyası aktarımı,
   PDF içe aktarma ve hikâye ses oynatıcısı native'de uygulanmadı. Otomatik
   sözlük yerel web ile sınırlı. Native kayıt katmanında web dosya deposunun
   revizyon ve otomatik önceki dosya kopyası mekanizmaları bulunmuyor.
6. **Senkronizasyon ve veri güvenliği:** Bulut hesabı, otomatik eşitleme, kalıcı
   outbox ve tombstone yok. Manuel yedek birleştirme cihaz senkronizasyonu
   değildir. Yedekler şifrelenmez. Host/Origin denetimi hesap kimlik doğrulaması
   yerine geçmez; aynı veri klasörüne birden fazla sunucunun eşzamanlı yazması
   dağıtık kilitle korunmuyor.
7. **Aktarım sınırları:** Anki `.apkg` desteklenmez; Anki masaüstü uygulamasında
   canlı içe aktarma yapılmadı. CSV/TSV çalışma geçmişini veya sesleri taşımaz;
   tam kayıt taşımak için JSON/ZIP gerekir.
8. **Ölçüm sınırları:** Kelime/kural kartlarında özdeğerlendirme öğrenme kanıtı
   olarak sunulmaz. Eski kayıtlarda olmayan cevap geçmişi üretilmez. Kelime ve
   gramer çalışma süreleri ölçülmüş gibi gösterilmez; günlük panel süre tahminidir.
9. **Görsel kontrol sınırı:** Tema tokenları ve tipografik kimlik korunuyor;
   ekran görüntüleri ve yerleşim testleri incelendi. Tam piksel karşılaştırma,
   ekran okuyucuyla manuel deneme veya kapsamlı erişilebilirlik sertifikasyonu
   yapılmadı.

Bu liste teslimin sınırlarını belirtir; desteklenmeyen işler tamamlanmış gibi
raporlanmamıştır. Son kalite kontrolü, mevcut yerel kullanım akışları içindir.
