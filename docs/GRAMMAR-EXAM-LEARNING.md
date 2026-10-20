# Faz 5 — Gramer ve sınav yanlışları

## Kullanım

**Gramer → Gramer tekrarı çalış** kişisel notlarından çalışma kartları oluşturur.
Her dolu not için **Kuralı hatırla** kartı hazırdır: başlık gösterilir, kullanıcı
kuralı hatırlayıp açar ve kendi başarısını değerlendirir.

**Gramer alıştırması hazırla** ile kaynak not seçilir. **Uygun örneği seç** için
soru, her satıra bir seçenek, doğru seçenek ve açıklama; **Cümle tamamla** için
`_____` içeren cümle, doğru biçim ve açıklama kaydedilir. Alıştırmalar aynı
ekrandan düzenlenir. Serbest metinden tahmini bir cevap anahtarı üretilmez.
Kaynak not, cevap sonrasında açıklamayla birlikte gösterilir. Ana notu olağan
düzenleyicide düzenlemek alıştırmaları silmez.

**Sınavlar → Yanlışlarım** tamamlanan kişisel sınavların yanlış ve boş sorularını
gerçek bir çözüm havuzunda sunar. **Yanlışları tekrar et** ile şıklı veya yazılı
cevap verilir; doğru cevap ve kayıtlı açıklama incelenir; sonraki soruya geçerken
sonuç kaydedilir. Doğru cevap havuzdan çıkar, yanlış cevap yeniden çalışılabilir.
**İncele** kaynak sınavın orijinal sonucunu açar. Örnek sınavlar havuza girmez.
Günlük panelin yanlış sayacı bu ayrı tekrar kayıtlarını da dikkate alır.

Konu örüntüleri sınavın mevcut alt başlığı ve bölümünden hesaplanır. Toplam
sınav hataları (boşlar dahil), bekleyen soru sayısı ve tekrarların doğru/yanlış
sayıları ayrıdır. Gramer ekranında da kayıtlı konu başlıklarına göre hata
oranları görünür; kural hatırlama özdeğerlendirmedir.

**Sınavlar → Haftalık karma** her yerel pazartesi başlayan hafta için, gramer
kartları ve bekleyen sınav yanlışlarından en fazla 10 kart oluşturur. İki havuz
birbirine geçirilir; kaynak sırası haftaya göre döner. Yalnız tek havuzda içerik
varsa o içerik kullanılır; olmayan içerik üretilmez. Seçilen kartların kopyaları
ve işlenen cevaplar kalıcıdır. Uygulama yeniden açıldığında sıradaki sorudan
devam edilir; önceki haftanın yarım oturumuna geçmişten dönülebilir. Bir hafta
için tekrar tekrar yeni sınav oluşturulmaz. Sonuç resmî sınav puanı değildir.

## Zamanlama ve kayıt bütünlüğü

- Kelime takvimi ve kelime geçmişi değiştirilmez.
- Gramerde her not/mod/alıştırma ayrı karttır. Başarılı günlerden oluşan seri,
  ortak `MEMORIZATION_DAYS` değerleriyle (1, 3, 7, 14, 30, 60) son başarı gününe
  eklenerek bir sonraki günü hesaplar. Altıncı adımdan sonra 60 gün sürer.
  Yanlış cevap seriyi keser ve kartı yeniden çalışmaya açık tutar. Aynı gündeki
  normal ve haftalık başarılar, seride tek başarılı gün sayılır. Bu, kelimelerin
  ilk ezber tarihine bağlı takviminden ayrı bir gramer planıdır.
- Kontrol veya cevabı açma kayıt oluşturmaz. Kullanıcının kaydetmesi gerekir.
  Başarısız dosya kaydında geribildirim korunur. Olay kimliği, kart/güncel geçmiş
  kontrolü, haftalık soru sırası ve UI kilidi yinelenen işlemleri engeller.
- Gramerde kaynak kural ya da alıştırma değişirse eski soru yeni içerik adına
  puanlanmaz. Önceki kayıt içerik kopyasıyla korunur; değişen kart yeni içerik
  olarak çalışılır. Silinen notun geçmişi silinmez.
- Sınav sorusu kimliği test kimliğiyle birlikte değerlendirilir. Soru metni,
  seçenek veya anahtar değişirse eski sonuç kendi soru kopyasında kalır.
  Tekrar başarısı yalnız o kaynak oturumun sorusunu çözer. Daha sonraki asıl
  sınavda aynı soru tekrar yanlışsa havuza geri döner. Eski haftalık oturumdan
  gelen başarı bu yeni sınav hatasını kapatmaz.
- Yeni asıl sınav tamamlamalarında isteğe bağlı `ExamAttempt.completedAt`
  saklanır. Eski kayıtlarda sıralama için mevcut `created` alanı kullanılır.

## Veri modeli ve yedekler

`Grammar.exercises?` düzenlenebilir alıştırmaları saklar. `Notebook.learning?`
içinde `grammarHistory`, `mistakeHistory` ve `weekly` ayrı listelerdir. Her cevap
olayı kendi türündeki kart kopyasını, cevabı, sonucu, gerçek zamanı ve yerel gün
etiketini taşır. Haftalık cevapların `sessionId` alanı vardır. Haftalık cevap
hem oturumda hem doğru türdeki geçmiş listesinde tek kaydetmeyle saklanır.
Asıl `exams.attempts` sonuçlarına veya `words` kayıtlarına eklenmez.

Şema sürümü 1 kalır; yeni alanlar isteğe bağlıdır. Eski defterler açılışta
dönüştürülmez. Yeni alanlar okunurken tür, seçenek/anahtar, tarih, yinelenen
kimlik, kategori ve haftalık cevap sırası doğrulanır.

JSON ve ZIP tam yedekleri alıştırmaları, geçmişleri ve yarım haftalık oturumları
korur. Gramer seçili yedek gramer geçmişini, sınav seçili yedek yanlış soru
geçmişini taşır. **Haftalık karma oturumlar iki bölümü de içerebildiği için
yedeklerken Gramer ve Sınavlar birlikte seçilmelidir.** Yalnız bir bölüm geri
yüklendiğinde diğer bölümün geçmişi ve mevcut haftalık oturum kopyaları korunur.
Eski bir yedekle bölüm değiştirildiğinde o bölümün bulunmayan yeni geçmiş alanı
boşaltılır; seçilmeyen bölüm değişmez.

Mevcut kayıtlara ekleme önceki kayıt önceliğini korur. Aynı içerikteki not veya
oturum farklı kimlikle mevcutsa tekrar bağlantıları eşleşen kayda taşınır.
Aynı kimlik altında farklı içerik varsa eski içerik kopyası tarihçe olarak kalır;
başka sorunun veya kuralın başarısı sayılmaz. Metni aynı olan ayrı soruların
ve alıştırmaların kimlikleri korunur.

## Doğrulama

`tests/learning.test.mjs`: üç gramer modu için başarı/hata, tekrar takvimi,
saat geri alma, yinelenen olay ve eski soru reddi; yanlış/boş soru çözme,
yeni asıl sınav hatası, örnek ve yarım sınav hariç tutma; konu örüntüleri;
karma oturum devamı ve kategorilere kayıt; eski veri ve hatalı veri kontrolü;
JSON/ZIP, bölüm seçimi, birleştirme kimlik eşleme ve dosyayı yeniden açma.

`tests/e2e/learning.spec.mjs`: gerçek dosya API'siyle üç gramer modu,
alıştırma oluşturma/düzenleme, şıklı ve yazılı yanlış soruları çözme, günlük
sayaç, çift tıklama, kayıt hatasından sonra yeniden deneme, yarım haftalık
sınavı yenileme sonrası sürdürme, bitirme, yeni hafta ve boş veri.
Masaüstü Chrome ve mobil tarayıcı görünümü kullanılır; native cihaz testi
yapılmamıştır.

Faz 5 sonuçları: 171 birim/entegrasyon testi ve 106 tarayıcı senaryosu başarılı.
`npm run typecheck`, `npm run build:web` ve değişen kaynakların Prettier
kontrolü başarılı. Testler geçici dosya alanında çalıştırıldı; kişisel deftere
test verisi yazılmadı.
