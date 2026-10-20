# Aktif hatırlama ve kelime testleri

**Kelimelerim → Kelime testleri** mevcut kartları kullanır. Klasik kart,
İngilizceden Türkçeye, Türkçeden İngilizceye, yazılı cevap ve boşluk doldurma
modları vardır. Yazılı cevapta iki yön de seçilebilir.

Klasik ve yönlü kartlarda kullanıcı cevabı görmeden hatırlamaya çalışır ve kartı
açınca kendisini değerlendirir. Yazılı ve boşluk doldurma modlarında önce cevap
yazılır, sonra kontrol edilir. Kontrol etmek tek başına tekrar kaydı oluşturmaz.
Geribildirim ve kayıtlı bilgiler, sonraki karta geçilene kadar açık kalır.

Kartın arka yüzü mevcut anlamı, açıklamayı, örneği, çeviriyi, ek anlamları,
eş/zıt anlamlıları ve varsa fiil hallerini kullanır. Eksik bilgi üretilmez.
Aynı arka yüz eski Tekrar et ekranında da kullanılır.

## Cevap değerlendirme

- Unicode NFC, baştaki/sondaki ve tekrarlanan boşluklar, dilin harf büyüklüğü
  kuralları normalize edilir. Türkçede `I/ı` ve `İ/i` ayrımı korunur.
- İngilizceden Türkçeye ana anlam ve kayıtlı diğer anlamlardan biri yeterlidir.
  Anlamlar ayrı kart veya ayrı tekrar takvimi oluşturmaz.
  Virgül, noktalı virgül ve satır sonuyla ayrılmış kayıtlı karşılıklar alternatif
  liste olarak değerlendirilir; parantez veya eğik çizgi içeren parçalar
  otomatik doğru yerine belirsiz kabul edilir.
- Türkçeden İngilizceye hedef kelime/ifadenin kendisi beklenir. Kayıtlı İngilizce
  eş anlamlılar otomatik doğru sayılmaz; bağlamı değerlendirmen istenir.
- Birleşik açıklamalardan alınan belirsiz karşılıklar öz değerlendirmeye sunulur.
- Yaklaşık yazım, alt dize, keyfi kelime silme, Türkçe harfleri sadeleştirme veya
  olumsuzluğu kaldırma kullanılmaz. Boş cevap kontrol edilemez.
- Boşluk doldurmada yalnızca kayıtlı cümle kullanılır. Hedefin tamamı sözcük
  sınırlarıyla aranır, tüm geçişleri gizlenir. Cümlenin çekimli bir biçimini tahmin
  eden yeni içerik üretilmez. Uygun cümlesi olmayan kartlar bu modda gösterilmez.
  Burada hedefin yerine başka bir eş anlamlı yazmak otomatik kabul edilmez.

## Tekrar kaydı

Ezber listesine eklenmiş kartlarda yalnızca mevcut öğrenme veya günü gelmiş
tekrar adımı işlenir. Yanlış cevap ezber tarihini/adımını ilerletmez; kelime
beklemeye devam eder. Yeni turla tekrar çalışılabilir. Doğru veya zorlanarak
hatırlanan cevap mevcut adımı bir kez kaydeder. **1–3–7–14–30–60 takvimi korunur.**

Ezber listesi dışındaki kelimeler mevcut Tekrar et motorunu kullanır:
Hatırlamadım/yanlış = 10 dakika, Zorlandım = 1 gün, Hatırladım = mevcut büyüyen
aralık. İki motor aynı cevapla birlikte ilerletilmez. Gelecek tarihli veya
tamamlanmış Ezber kartı sessizce başka motora aktarılmaz.

Kartın içerik ve tekrar durumu, kayıt öncesinde tekrar karşılaştırılır. Çift
tıklama kilidi ve bu durum karşılaştırması aynı cevabın farklı bir adımı
tüketmesini engeller. Kayıt başarısızsa geribildirim ve cevap korunur; tekrar
denenebilir. Günlük panel, kayıtlı tekrar ve öğrenme alanlarından güncellenir.

Yeni veri alanı veya bağımlılık eklenmemiştir. Mevcut JSON/ZIP yedekleri ve
depolama katmanı kullanılır. Tur sayacı yalnızca işlenen kartları sayar;
başarılı tekrar sayısı gibi sunulmaz.

Değerlendirme `src/word-practice.ts`, tekrar kayıt yönlendirmesi
`src/notebook/services/practice.ts`, ortak kart arkası
`src/notebook/components/WordCardBack.tsx` ve modların ekranı
`src/notebook/screens/WordPracticeScreen.tsx` içindedir. Testler
`tests/word-practice.test.mjs` ve `tests/e2e/word-practice.spec.mjs` dosyalarındadır.

## Faz 3 doğrulaması — 19 Ekim 2026

| Kontrol | Sonuç |
| --- | --- |
| `npm test` | 136 test geçti. |
| `npm run typecheck` | Geçti. |
| `npm run build:web` | Geçti. |
| Yeni kelime testlerinin tarayıcı senaryoları | Chrome masaüstü/mobil görünümünde 28 test geçti. |
| Tüm tarayıcı testleri | Yeni senaryolar dahil 86 test geçti. |

Kontroller gerçek dosya kayıt API’si ve geçici test defterleriyle yapıldı;
kişisel defter kullanılmadı. Önceden bulunan Git/.git eksikliği nedeniyle Git
diff doğrulanamadı. Android/iOS cihaz testi yapılmadı; mobil sonuçlar tarayıcı
görünümüne aittir. Faz 3 sonrasında başka geliştirme fazına geçilmedi.
