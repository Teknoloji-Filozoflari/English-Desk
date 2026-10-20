# Faz 6 — Öğrenme istatistikleri ve ilerleme

## Ekran ve kullanım

**Bugün → İlerlemem · İstatistikleri aç** mevcut günlük panelin rapor görünümünü
açar. **Bugünkü plana dön** ile hedef ve çalışma kısayollarına dönülür. Ayrı
bir üst menü veya ekran sistemi oluşturulmadı. Grafikler mevcut React Native
`View` ve `Text` bileşenleriyle çizilir; bağımlılık eklenmedi.

- Toplam kelime/ifade, ilk öğrenme günü bulunan öğe, ilk öğrenmeden sonraki
  başarılı tekrarı bulunan öğe ve henüz öğrenme kaydı olmayan öğe ayrıdır.
- Bugünkü/haftalık tamamlanmış tekrar cevapları ve bunların başarılı olanları
  ayrı gösterilir. Bir kelimenin ilk öğrenmesi tekrar sayılmaz. Gramer ve yanlış
  soru cevapları ilgili tarihteki çalışmalara dahildir.
- Günlük yeni kelime hedefi mevcut panelden; haftalık başarılı tekrar hedefi
  rapordan değişir. Haftalık hedef varsayılan 35, sınırı 0–1000'dir; 0 hedefi
  kapatır. Birini değiştirmek diğerini silmez.
- Ayrıntılı cevap geçmişinden toplam başarı, cevap anahtarıyla doğrulanan gramer
  ve yanlış soru cevapları, ayrıca kelime sonuçları/kural özdeğerlendirmeleri
  gösterilir. Son 14 günlük çubuklarda oran ve cevap sayısı birlikte görünür.
  Son 7 gün ile önceki 7 günün değişimi yüzde puan olarak hesaplanır. Bir dönemde
  cevap yoksa karşılaştırma veya başarı oranı üretilmez.
- En az iki kayıtlı başarısız kelime cevabı olanlar, hata sayısına ve son hata
  gününe göre sıralanır. Düğme doğrudan o kelimenin kartını açar.
- Gramer konu başlıklarında toplam cevap, hata ve hata oranı gösterilir.
  Zorlanılan notun düğmesi mevcut gramer ekranındaki ilgili konuya gider. Not
  silinmişse geçmiş kalır ve eksik kaynak açıkça belirtilir.
- Tamamlanan kişisel sınav sayısı, doğru/toplam soru oranı ve kaydedilmiş
  oturum süreleri gösterilir. Boş cevaplar toplam soru sayısına dahildir.
  Yarım oturumlar sınav sonucuna eklenmez, ölçülen süreleri süre toplamına girer.

## Ölçümün sınırları

İlk öğrenme tarihi kalıcı öğrenmenin kanıtı değildir. İçe aktarma tek başına
öğrenme veya tekrar başarısı oluşturmaz. Eski `review.repetitions` ve `interval`
değerlerinden cevap geçmişi veya başarı oranı türetilmez.

Eski ezber planlarındaki açık `reviews` günleri başarılı tekrar kanıtıdır;
tamamlanma sayısında kullanılabilir. Ancak eski yanlış cevaplar kaydedilmediği
için bu günler ayrıntılı başarı oranının payına/paydasına alınmaz. Aynı günün
yeni ayrıntılı başarılı ezber cevabı varsa eski gün ayrıca sayılmaz.

Kelime çalışma sonucu kullanıcı kaydettiğinde oluşur. Klasik, yönlü ve eski
kartlarda bu bir hatırlama özdeğerlendirmesidir; yazılı/boşluk doldurmanın kontrol
sonucu da kullanıcının kaydettiği sonuç olarak tutulur. Kelime geçmişinde
çalışma modu/cevap metni bulunmadığı için bu kayıtlar “cevap anahtarıyla
doğrulanan” alt grubuna tahminen eklenmez. Gramer kural hatırlama da
özdeğerlendirmedir. Rapor zekâ, kalıcı dil seviyesi veya resmî sınav puanı ölçmez.

Süre raporu mevcut `ExamAttempt.elapsed` alanını kullanır. Kelime, gramer ve
haftalık mini sınav kronometresi geçmişi yoktur; onlar için süre üretilmez.
Günlük panelin tahmini süresi ölçülmüş süreye eklenmez. Eski sınavların
tamamlanma tarihi yoksa listede başlangıç tarihi kullanılır.

## Tarihler, tekilleştirme ve kayıt

Gün cihazın yerel takvim günü; hafta pazartesi–pazar aralığıdır. Günlük görünüm
mevcut `useStudyClock` ile gece yarısı/uygulamaya dönüşte yeniden hesaplanır.
Kaydedilen gün etiketleri UTC zamanına dönüştürülerek başka güne kaydırılmaz.
Gelecek günler ve henüz gerçekleşmemiş zaman damgalı cevaplar rapora girmez.

Kelime sayımı, mevcut yedek birleştirme kuralıyla aynı normalize edilmiş
kelime+kelime türü anahtarını kullanır. Aynı yazılışın farklı türleri ayrı kalır;
aynı kartın farklı hikâye bağlantıları veya içe aktarılmış kopyaları toplamı
artırmaz. Çok kelimeli sözcükler veya ifade/öbek fiil/collocation türleri ifade
sayısına dahildir. Örnek hikâyelere özel kartlar ve örnek sınavlar hariçtir.

Yinelenen kelime cevapları olay anahtarıyla; gramer ve yanlış sorular içerik,
zaman, cevap ve sonuçla tekilleştirilir. Haftalık cevaplar kategori geçmişinde
zaten bulunduğu için oturum dizisinden ikinci kez eklenmez. Aynı kişisel sınavın
aynı başlangıç zamanı/içerik/moduyla gelen farklı kontrol noktalarında bitmiş
kopya, ardından en uzun ölçülmüş kontrol noktası önceliklidir. Böylece yedekten
gelen eski yarım oturum süresi yeni tamamlanmış süreye eklenmez. Farklı zamanda
gerçekten yeniden başlatılan sınavlar ayrı oturumdur. Kaynak oturum kopyaları
tekilleştirilirken çözülen yanlış soruların bağlantıları da rapor içinde eşlenir.
Raporlama kaynağı değiştirmez veya kayıt silmez.

`Word.answerHistory?` yeni isteğe bağlı alanıdır. Olay kimliği, yerel gün,
`again`/`hard`/`good` sonucu, ilk öğrenme/tekrar ve motor bilgisi saklanır.
Bu alanı olmayan eski kartlar açılır; açılışta zorunlu dosya dönüşümü yapılmaz.
Kelime testlerinde ezber başarısızlığı artık geçmişe kaydedilir; önceki gibi
ezber tarihi ve adımı ilerlemez. Aynı gösterilmiş cevabın yeniden işlenmesi,
kartın geçmişini de içeren mevcut durum kontrolüyle reddedilir.

`StudyPreferences.weeklyReviewGoal?` kelime hedefiyle birlikte saklanır. JSON/ZIP
tam ve kelime bölümü yedekleri yeni geçmiş ve hedef alanlarını taşır. Geçersiz
tarih/sonuç/kimlik veya yinelenen olay içeren kayıtlar yazılmadan reddedilir.
Mevcut kayıtlara ekle, önceki mevcut-kayıt-önceliği davranışını korur.

## Test kapsamı

`tests/progress.test.mjs`: boş/içe aktarılmış veri, ilk öğrenme–başarılı tekrar
ayrımı, gerçek kelime başarı/hataları, yinelenen kayıt ve kontrol noktaları,
örnek içerik hariç tutma, günlük/haftalık sınırlar, oran ve boş dönemler,
haftalık cevapların tek sayılması, gramer kısayol kaynakları, ölçülmüş süreler,
hedef sınırları, geçersiz geçmiş reddi, JSON/ZIP ve dosyayı yeniden açma.
İstanbul gece yarısı, Berlin yaz saati geçişi, artık gün ve yıl geçişi ayrı
saat dilimi süreçlerinde sınanır.

`tests/e2e/progress.spec.mjs`: gerçek dosya API'sinden istatistikler, kelime ve
gramer kısayolları, bağımsız hedeflerin yeniden yüklemede korunması, yinelenen
içe aktarma kopyaları, gerçek kelime tekrarının rapora yansıması, başarısız
kayıttan sonra yeniden deneme, gece yarısı ve boş veri. Masaüstü Chrome ve
mobil tarayıcı görünümü kapsanır; native cihaz testi yapılmamıştır.

Faz 6 sonuçları: 192 birim/entegrasyon testi ve 118 tarayıcı senaryosu başarılı.
Son rapor sınır durumları düzeltildikten sonra 12 istatistik senaryosu yeniden
geçti. TypeScript, Prettier kontrolü ve son web derlemesi başarılı. Testler
geçici defterde çalıştırıldı; kişisel veri alanına test kaydı eklenmedi.
