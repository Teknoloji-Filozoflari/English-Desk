# FAZ 9 — Platform uyumluluğu ve senkronizasyon değerlendirmesi

## Sonuç ve kapsam

Çalışan yerel veri akışları korundu. Bu fazda bulut hesabı, uzak veri deposu,
otomatik birleştirme, cihazlar arasında veri gönderimi veya silme eklenmedi.
Mevcut manuel yedek geri yükleme önizlemesi ve kullanıcı onayı devam ediyor.

Android/iOS JavaScript derleme denetimi `npm run check:native` ile tekrarlanabilir
hale getirildi ve CI'a eklendi. Geniş native ekranlardaki kayıt açıklaması da
“proje dosyası” yerine gerçek cihaz depolamasını anlatıyor. Renkler ve tema değişmedi.

## Gerçek platform kapsamı

| Özellik                                  | Yerel web                                                                                  | Android / iOS kaynak uygulaması                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Çalıştırma                               | Node.js 24+ yerel sunucu ve tarayıcı                                                       | Expo / React Native                                                                  |
| Kalıcı veri                              | `data/notebook.json`, yerel `/api/notebook`                                                | AsyncStorage, `english-desk-native-v1` anahtarı                                      |
| Kelime, ezber, gramer, sınav, istatistik | Ortak veri modeli ve çalışma motorları                                                     | Aynı ortak model ve motorlar; JavaScript derlemesi doğrulandı                        |
| Kelime dosyaları                         | CSV / TSV / Anki metin dosyası, tarayıcı seçici ve indirme                                 | Aynı metin biçimleri, Expo dosya seçici ve paylaşım menüsü                           |
| Tam / seçili yedek                       | ZIP dışa aktarımı; JSON / ZIP geri yükleme; sesler isteğe bağlı                            | JSON paylaşımı ve JSON geri yükleme; ZIP arşivi ve ses dosyası aktarımı uygulanmamış |
| Hikâye içe aktarma                       | PDF, TXT, Markdown; PDF okuyucu dosyaları yerel                                            | TXT / Markdown; PDF desteklenmiyor ve arayüz bunu açıklıyor                          |
| Hikâye sesi                              | Yerel MP3 ve zamanlamalar                                                                  | Oynatıcı uygulanmamış; web sürümüne yönlendiren açıklama mevcut                      |
| Otomatik sözlük                          | Yerel API; bazı zenginleştirme kaynakları internet veya kurulmuş çeviri servisi gerektirir | Otomatik sözlük işlemleri desteklenmiyor; elle kayıt ve çalışma devam eder           |
| Bulut / cihazlar arası senkronizasyon    | Yok                                                                                        | Yok                                                                                  |

Platform ayrımları `.web.ts` / `.web.tsx` modülleri ve gerektiğinde `Platform.OS`
üzerinden yapılır. Depolama, yedekleme, dosya seçimi, PDF, ses ve web klavye
odak stilleri incelendi. Native derlemelerde web'e özel odak bileşeni yerine
native karşılığı seçilir.

## Yerel kayıt ve çevrimdışı kullanım

Web'de **internetsiz kullanım ile yerel sunucunun kapalı olması farklıdır**:

- Kurulmuş bağımlılıklar, derlenmiş arayüz ve çalışan yerel sunucuyla kayıtlı
  hikâyeler, kelimeler ve çalışma özellikleri internet gerektirmez.
- Sunucu kapalıysa web uygulaması dosyaya okuyup yazamaz. Sunucusuz PWA,
  service worker veya tarayıcıda bekleyen çevrimdışı yazma kuyruğu yoktur.
- İlk bağımlılık kurulumu / container imajı hazırlama internet gerektirebilir.
  Otomatik sözlük kaynakları erişilemezken mevcut içerik korunur; elle kayıt
  çalışır. Bütün sözlük özellikleri çevrimdışı çalışıyormuş gibi sunulmaz.
- Native yerel çalışma katmanı AsyncStorage kullanır; web sunucusuna bağlanmaz.
  Cihazdaki kalıcılık, dosya izinleri, paylaşım menüsü ve arka plandan dönüş
  davranışlarının fiziksel cihaz doğrulaması ayrıca gereklidir.

Web depolamasında JSON doğrulaması, revizyon karşılaştırması, sıralı işlemler,
geçici dosyaya yazma ve yeniden adlandırma mevcut. Önceki geçerli dosyanın
`data/backups/` kopyası alınır. Farklı pencerenin eski revizyonla yazması 409 ile
reddedilir; kullanıcı yenileyerek devam eder. Bu koruma mevcut yerel sunucu
örneği içindir; ayrı makineler veya aynı veri klasörüne yazan birden fazla sunucu
için dağıtık kilit ya da senkronizasyon protokolü değildir.

`useNotebook` başarılı kalıcı yazmadan sonra ekran verisini değiştirir.
Okuma hatası düzenlemeyi kapatır; bozuk veya erişilemeyen kayıt sessizce boş
defterle değiştirilmez. Web dosyası varsa eski localStorage verisi devreye
girmez; yerel sunucu hatasında da bu eski veriye geri düşülmez.

Native katman da okumada/yazmada `validateNotebook` kullanır ve eski anahtarı
korur. Web'deki dosya revizyonu, otomatik önceki dosya kopyası ve çok pencere
korumasının AsyncStorage'da eşdeğeri bulunmuyor. Uygulama düzeyindeki işlem
kilidi, cihazlar arası çakışma koruması olarak değerlendirilmemelidir.

**Kurtarma sınırı:** Kod incelemesine göre web'de `notebook.json` dosyasının
kendisi okunamayacak kadar bozulmuşsa, yedek geri yükleme de mevcut dosya ve
revizyonu okuduğundan uygulama içinden bu dosyayı otomatik onaramaz. Bu durum,
geçerli bir deftere yedek geri yüklemekten farklıdır. Orijinal bozuk dosya ve
yedekler korunarak ayrı bir dosya kurtarma adımı gerekir; bu fazda bozuk dosyanın
üzerine zorla yazan bir kurtarma yolu eklenmedi. Native cihaz depolama arızası
için de fiziksel cihaz kurtarma testi yapılmadı.

## Yedekleme ve aktarım değerlendirmesi

Mevcut `backup-core` bölüm seçimi, eski JSON biçimleri, mevcutlara ekleme,
yalnız seçili bölümleri değiştirme, kimlik/kaynak bağlantıları ve çalışma
geçmişini koruma mantığını ortak kullanır. Eksik ses dosyaları geri yükleme
planında bildirilir. Native JSON yedeği MP3 dosyasını içermez.

Kelime CSV/TSV aktarımı tam yedek değildir: çalışma geçmişi, sınavlar ve hikâye
sesleri bu standart kelime dosyalarında taşınmaz. Bunlar için mevcut JSON/ZIP
yedeği gerekir. Anki `.apkg` desteği bulunmuyor. Önizleme, sütun eşleştirmesi,
yinelenen kayıt kontrolü ve son kullanıcı onayı korundu.

Yedekler uygulama tarafından şifrelenmez; bu dosyalar kişisel verinin bir
kopyasıdır. Yerel sunucu varsayılan olarak loopback adresinde çalışır; Docker
portu da varsayılan olarak `127.0.0.1` üzerinden açılır. Host/Origin denetimi
hesap kimlik doğrulaması değildir. Mevcut sunucu doğrudan çok kullanıcılı bir
bulut API'si olarak değerlendirilmemelidir.

## İsteğe bağlı senkronizasyon için mimari karar

Mevcut kullanımda yerel çalışma ve kullanıcı onaylı yedek aktarımı yeterli.
Bu fazda otomatik senkronizasyon gerektiren bir hesap/sunucu gereksinimi
tanımlanmadı. Güvenli senkronizasyonu devreye alacak aşağıdaki parçalar henüz
uygulanmadığından otomatik veri birleştirme yapılmadı.

| Gerekli parça                  | Uygulanmadan önce çözülmesi gereken konu                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kimlik ve yetki                | Hesap/cihaz kaydı, oturum iptali, kullanıcıya ait kayıtlara sunucuda erişim kontrolü; native ve web için uygun token saklama                                        |
| Yerel işlem günlüğü            | Çevrimdışı değişiklikleri kalıcı outbox'ta tutma; sunucu onayı gelmeden temizlememe; işlem kimliğiyle güvenli yeniden gönderme                                      |
| Sürümler ve çakışmalar         | Kayıt bazında sunucu sürümü ve önkoşullu yazma; eşzamanlı içerik düzenlemesinde her iki sürümü saklama ve kullanıcıya seçim sunma                                   |
| Çalışma geçmişi                | Kelime, gramer ve sınav olaylarını ayrı tutma; olay kimliklerini tekilleştirme; aynı plan adımının iki cihazda cevaplanmasının takvimi iki kez ilerletmesini önleme |
| Silinen kayıtlar               | Sürüm içeren tombstone ve yeterli saklama süresi; uzun süre çevrimdışı kalan cihazın silinmiş kelimeyi tekrar oluşturmasını önleme                                  |
| Kaynak bağlantıları ve sesler  | Hikâye/kelime bağlantılarını, çoklu anlamları ve ek dosyaları ayrı ve doğrulanabilir aktarım işlemleriyle koruma                                                    |
| Güvenlik ve kurtarma           | TLS, hesap izolasyonu, sınırlar, erişim kayıtları; ilk eşitleme öncesi yerel yedek; kısmi hatada geri alınabilir işlemler                                           |
| Sürüm geçişi ve kabul testleri | Eski istemci/yeni şema, bağlantı kesintisi, çift gönderim, saat farkı, iki cihaz, silme/düzenleme çakışması ve yarım medya aktarımı senaryoları                     |

Mevcut `planRestore(..., mode: "merge")` bir kullanıcı onaylı yedek geri yükleme
politikasıdır; iki cihazın değişikliklerini uzlaştıran bir senkronizasyon motoru
değildir. Örneğin bir cihazdaki silme, diğerinin eski tam yedeğiyle anlaşılmaz;
iki cihazın aynı kelimeye ait farklı cevap geçmişi de otomatik olarak güvenle
birleştirilemez. Cihaz saatine bakıp “son yazan kazanır” demek veri kaybını
önlemez. Yeni bir senkronizasyon takvim alanlarını doğrudan seçmek yerine kabul
edilen çalışma olayları ve mevcut 1–3–7–14–30–60 kurallarıyla tutarlı olmalıdır.

Bu tablo gelecek uygulama için öneridir; yukarıdaki özellikler mevcut değildir.

## Derleme, paketler ve doğrulama sınırları

- `app.json`: Expo SDK 57, web/Android/iOS platformları, açık tema ve tablet
  desteği; yapılandırma `expo config --type public` ile okundu.
- `npm run check:native`: Android ve iOS Metro JavaScript çıktıları üretildi.
  Bu denetim bilinçli olarak `--no-bytecode` kullanır; Hermes çalıştırması,
  release derlemesi, imzalama veya kurulabilir paket doğrulaması değildir.
  Çıktılar git dışında tutulan `native-bundles/` klasöründedir.
- `npm run build:web`: web dışa aktarımı başarılı.
- `npm run typecheck` ve `npm test`: tip kontrolü ve 216 birim/entegrasyon testi.
- Yeni `platform-safety.spec.mjs`: masaüstü/mobilde dış servisler kapalıyken
  elle kayıt, cevap işleme, CSV ve ZIP indirme; yerel API kaybında veri koruma;
  iki gerçek pencerenin eski revizyonla yazmayı reddetmesi ve yenilemeyle kurtarma.
  Mevcut tüm tarayıcı akışlarıyla birlikte 156 test geçti (6 yeni kontrol dahil).

Android package / iOS bundle identifier, EAS profilleri ve imzalama ayarları
tanımlı değil. APK/AAB/IPA üretilmedi; fiziksel cihaz/emülatör testi yapılmadı.
Windows/macOS masaüstü uygulama sarmalayıcısı veya kurulum paketi yok; masaüstü
kullanım yerel web uygulamasıdır. Dockerfile/Compose ve loopback/volume ayarları
incelendi; bu ortamda Docker CLI bulunamadığından yeni container imajı derlenmedi
ve container çalışma testi yapılmadı.

Testler sentetik veriler ve ayrı geçici kayıt klasörü kullanır; kişisel defter
dosyasını kullanmaz. CI yapılandırması güncellendi; uzak CI bu oturumda çalıştırılmadı.
Tarayıcı kontrolleri Windows üzerinde Chrome ve Pixel 7 mobil emülasyonunda
yapıldı; Safari ve Firefox bu oturumda test edilmedi.
