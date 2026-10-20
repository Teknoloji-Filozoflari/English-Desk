# Günlük çalışma paneli

Uygulama açılışında **Bugün** paneli görünür. Hikâyeler, kelimeler, gramer ve
sınav ekranları kendi sekmelerinde korunur. Paneldeki işlemler aynı çalışma
ekranlarını açar; ayrı bir tekrar motoru yoktur.

- **Kalan tekrar:** Ezber takviminde günü gelen/geciken kelimeler ile daha önce
  cevaplanmış ve Tekrar et alanında yeniden zamanı gelen kelimelerin birleşimi.
  Aynı kelime iki akışta da bekliyorsa bir kez sayılır.
- **Tamamlanan tekrar:** Bugün kaydedilmiş bir tekrar cevabı bulunan ve hiçbir
  akışta şu anda beklemeyen kelimeler. Kartı veya anlamı açmak kayıt üretmez.
  Aynı kelime iki akışta da bekliyorsa iki adım da cevaplanmalıdır. Tekrar et
  alanındaki 10 dakikalık yeniden çalışma süresi dolarsa kelime yeniden kalanlara
  geçebilir; sayaçlar güncel durumu yansıtır.
- **Yeni öğrenilen:** İlk öğrenme günü bugün olan kelimeler. Ezber ve Tekrar et
  kayıtları aynı kelimeyi iki kez saydırmaz. İlk kez çalışılan kelimede Tekrar
  cevabı öğrenilmiş sayılmaz; Bildim veya Zorlandım ile kaydedildiğinde sayılır.
- **Hedef:** Varsayılan 5, kullanıcı tarafından 0–100 arasında değiştirilebilir.
  Hedef değişikliği tekrar tarihlerini veya geçmiş cevapları değiştirmez.
- **İlerleme:** `(tamamlanan tekrar + hedefe kadar yeni öğrenilen) /
(tamamlanan tekrar + kalan tekrar + yeni kelime hedefi)`. Plan boşsa %0.
- **Tahmini süre:** Kalan her tekrar adımı için 30 saniye ve hazır kelimelerden
  hedefi tamamlayacak her yeni kelime için 90 saniye. Gramer ve hikâye okuması
  bu tahmine dahil değildir; bu bir gerçek çalışma süresi kaydı değildir.

Eski Tekrar et kayıtlarında günlük cevap tarihi bulunmadığı için geçmiş günlere
ait tamamlanma veya ilk öğrenme sayısı tahmin edilmez. Bundan sonraki cevaplar
isteğe bağlı `Word.studyActivity` alanına gerekli günleri kaydeder. Ezberin
mevcut tarih geçmişi doğrudan kullanılır. `Notebook.studyPreferences` günlük
hedefi saklar. Eski kayıtların bu alanları içermesi zorunlu değildir.

Gün değişiminde sayaçlar cihazın yerel gününe göre yeniden hesaplanır. Hedef
kalır. Görüntülenen sayaçlar ayrıca saklanmaz; gerçek defter verilerinden türetilir.

Örnek işaretli hikâyeler, yalnızca bu hikâyelere bağlı kelimeler ve uygulamanın
yerleşik örnek sınavları kişisel panel istatistiklerine dahil edilmez. Testler
ayrı geçici defterlerle çalışır.

Yanlış sorular son **tamamlanmış** oturumlardaki cevaplara göre hesaplanır.
Aynı soru daha sonraki tamamlanmış bir tekrarda doğru cevaplandıysa bekleyenlerden
çıkar. Sınav geçmişi silinmez. Panel ve Yanlışlarım ekranı aynı hesabı kullanır.

Hedef ve kelime çalışma alanları tam/kelime JSON ve ZIP yedeklerine dahildir.
Mevcutlara ekle yöntemi mevcut hedefi korur; hedef yoksa yedekteki hedefi alır.
Kelimeleri değiştir yönteminde yedek hedef içeriyorsa kullanılır. Eski yedekte
hedef bulunmuyorsa kullanıcının mevcut hedefi korunur. Hikâye, gramer veya sınav
bölümünün tek başına geri yüklenmesi günlük hedefi değiştirmez.

## Faz 2 doğrulaması — 19 Ekim 2026

| Kontrol | Sonuç |
| --- | --- |
| `npm test` | 121 test geçti. |
| `npm run typecheck` | Geçti. |
| `npm run build:web` | Geçti. |
| Günlük panel tarayıcı testleri | Chrome masaüstü/mobil görünümünde 10 test geçti. |
| Mevcut ekranların tarayıcı testleri | Aynı web derlemesinde 48 test geçti. |

Testler kişisel defter yerine geçici dosyalar kullanır. Yeni bağımlılık
eklenmemiştir. 1–3–7–14–30–60 takvimi korunmuştur. Git ve `.git` klasörü
bulunmadığından Git diff doğrulanamamıştır. Android/iOS cihaz testi yapılmamıştır.
