# FAZ 8 — Mevcut arayüzün iyileştirilmesi

## İnceleme ve korunan tasarım

Uygulamanın mevcut tasarım sistemi incelendikten sonra hedefli düzeltmeler yapıldı.
`src/theme.ts`, marka işareti, yazı tipi aileleri ve yazı boyutları değiştirilmedi.
Yeni bileşen/ikon/grafik kütüphanesi veya renk paleti eklenmedi.

| Mevcut özellik                | Korunan tanım                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Sayfa / kart zemini           | `background: #F5F2EC`, `surface: #FFFEFA`                                                              |
| Metin / ikincil metin / sınır | `ink: #252B35`, `muted: #686D74`, `line: #E2DED6`                                                      |
| Vurgu                         | `accent: #A84427`, `accentSoft: #F7E5DB`                                                               |
| Gezinme                       | `sidebar: #252D38`, `sidebarMuted: #B9BEC6`                                                            |
| Ek renkler                    | Amber, purple ve A1–C2 seviye renkleri aynen korundu                                                   |
| Tipografi                     | Marka ve okuma başlıklarında Georgia / Android serif; diğer metinlerde platformun varsayılan ailesi    |
| Ölçek                         | Ana tanıtım başlığı 40 / dar ekranda 30; h1 28, h2 22; içerik 14–17; okuma metni 22 / satır aralığı 42 |
| Ortak bileşenler              | `Button`, `Field`, `Blank`, `StudyHeader`; ortak kart, form, modal ve gezinme stilleri                 |

Mevcut uygulama açık içerik zemini ve koyu gezinme alanını birlikte kullanıyor.
Ayrı açık/koyu tema anahtarı, sistem temasına göre renk değiştirme veya kaydedilmiş
tema tercihi bulunmuyor. Bu davranış korundu; yeni bir tema seçimi eklenmedi.

## Somut sorunlar ve küçük düzeltmeler

| Alan                         | Sorun / inceleme                                                                           | Düzeltme ve doğrulama                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kelime koleksiyonu           | 320 px genişlikte “Eksik bilgileri tamamla” ve “+ Kelime ekle” ekran dışına taşıyordu      | İşlem satırına kapsayıcı genişlik sınırı; ortak butonlarda uzun etiketlerin sığması ve satıra yayılması                                                                                               |
| Hikâye kütüphanesi           | İç içe filtre satırındaki “Okundu” kontrolü 320 px genişlikte taşıyordu                    | Mevcut filtre satırına `maxWidth: 100%`; aynı filtreler ve sıralama korundu                                                                                                                           |
| Gramer / sınav alt menüleri  | Sabit gezinme kapsayıcısı uzayan konu listesini kaydıramıyordu; mobil alt menü tek satırdı | Mevcut sıralamayla kaydırılabilir gezinme, mobil alt menüde satır sarma; mobil gezinme yüksekliği en fazla ekranın yarısı. 20 kişisel konu ve 480 px ekran yüksekliğiyle son konuya erişim doğrulandı |
| Klavye kullanımı             | React Native Web Pressable kontrollerinde odak görünürlüğü ortak biçimde tanımlanmamıştı   | Sadece `:focus-visible` durumunda mevcut accent rengi; koyu gezinmede mevcut amber rengi. Tab / Shift+Tab, Enter ile açma ve form odağı test edildi                                                   |
| Kelime çalışma kartı         | Uzun cevap düğmelerinin dar kapsayıcılara güvenilir biçimde sığması gerekiyordu            | Mevcut `Button` üzerinden genişlik sınırı ve metin sarma; üç cevap düğmesinin erişilebilirliği ve en az 44 px yüksekliği doğrulandı                                                                   |
| Modal / form                 | Ortak alt işlem satırı satır sarmıyordu; kapatma düğmesi dar başlıkta küçülebiliyordu      | Alt satır sarılabilir ve küçülmez; kapatma düğmesi 44 px kalır. 320×480 kelime düzenleyicide kaydetme ve kapatma erişimi doğrulandı                                                                   |
| Sınavlar                     | Ayrı mevcut `Action` bileşeni aynı uzun etiket riskini taşıyordu                           | Bileşen korunarak ortak butonla aynı genişlik ve metin sarma koruması uygulandı                                                                                                                       |
| Günlük panel / istatistikler | Mevcut kart, metrik, boş durum ve hedef formu incelendi                                    | Ekranlar yeniden tasarlanmadı. Uzun kayıt başlıkları, dar ekran, ortak işlem kontrolleri ve mevcut gerçek veri akışları test edildi                                                                   |

Yedek düğmelerinin 40 px ve masaüstü alt menülerin 42 px olan asgari yüksekliği
44 px yapıldı. İçeriğin ana kaydırma kapsayıcısının küçülebilmesi açıkça tanımlandı.
Başlık metinleri, sekmeler, ekran sırası, alanlar ve çalışma/cevap kaydetme davranışları
korundu. Yükleniyor, boş, hata ve başarı bileşenlerinin mevcut yapıları incelendi;
gereksiz yeni bir durum bileşeni sistemi oluşturulmadı.

## Doğrulama

- `npm run typecheck`
- `npm test`: 216 birim / entegrasyon testi.
- `npm run build:web`: Expo web dışa aktarımı.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: masaüstü ve mobil tarayıcı projelerinde 150 test geçti (10 yeni arayüz kontrolü dahil).
- `tests/e2e/ui-layout.spec.mjs`: ana ekran, kelimeler, gramer, sınavlar,
  hikâyeler ve mevcut istatistik panelinde yatay kontrol taşması; 320×640 dar
  düzen, 320×480 modal, 1280×480 / 320×480 uzun menü, uzun kayıt başlıkları,
  kelime cevap kontrolleri ve klavye odağı. Test çıktısında ekran görüntüleri üretilir.
- Önceki fazların tekrar, gerçek dosya kaydı, yedekleme/geri yükleme, aktarım,
  gramer, sınav ve istatistik testleri aynı izole test sunucusunda çalıştırılır.

Kontroller sentetik kayıtlarla geçici dizinde çalışır; kişisel veri dizinine yazmaz.
Mobil doğrulama tarayıcı emülasyonudur; fiziksel Android/iOS cihaz testi yapılmadı.
