# Faz 7 — CSV/TSV ve Anki metin aktarımı

## Nereden kullanılır?

**Kelimelerim → CSV / TSV aktarımı** penceresi hem içe hem dışa aktarımı içerir.
Mevcut **JSON/ZIP yedekle** akışı korunmuştur. CSV/TSV kelime metni taşır;
uygulamanın tamamını yedeklemek için kullanılmaz.

## İçe aktarma

1. UTF-8 kodlanmış `.csv`, `.tsv` veya `.txt` seç. En fazla 5 MB, 10.000 kelime
   satırı ve 64 sütun desteklenir. UTF-16, eski Windows kod sayfaları, Excel
   `.xlsx` ve Anki `.apkg` bu işlemde desteklenmez.
2. İlk beş mantıksal satırın ham hücre önizlemesini incele. Çok uzun hücrelerin
   ekrandaki ilk 500 karakteri gösterilir; dosyadaki metin kesilmez.
3. Ayıracı gerekirse değiştir: virgül, sekme veya noktalı virgül. Otomatik
   algılama bir öneridir. **İlk satır sütun başlığı** seçimi elle değiştirilebilir.
4. Kelime, anlam, örnek cümle, etiket, seviye, kelime türü ve cümle çevirisi
   sütunlarını eşleştir. Türkçe/İngilizce yaygın başlıklar başlangıç önerisidir;
   tanınmayan başlıklar da elle eşleştirilebilir. Aynı sütun iki alana atanmaz.
   Kelime sütunu zorunludur; diğer alanlar alınmayabilir veya boş kalabilir.
5. **Aktarım önizlemesini oluştur** ile bütün satırların sonucunu hesapla.
   Eklenecek, tamamlanacak, atlanacak ve geçersiz satır sayıları ayrı gösterilir.
   Her satırın nedeni ve alınacak alanları sayfalı olarak incelenebilir.
6. Yalnız **Önizlemeyi onayla ve içe aktar** kayıt yapar. Önizlemeyi kapatmak,
   dosya seçmek veya sütun değiştirmek defteri değiştirmez. Eşleştirme, başlık,
   ayıraç, etiket veya yinelenen kayıt kuralı değişirse önizleme yeniden gerekir.

Kelime en fazla 500, anlam/örnek/çeviri 10.000 ve tür 100 karakter olabilir.
Seviye boş veya A1, A2, B1, B2, C1, C2'dir; küçük harf seviyeleri normalize
edilir. Kelime/anlam/türün çevre boşlukları temizlenir; örnek ve çevirinin
içindeki satır sonları ve tırnaklar korunur. Boş anlamlı bir kelime eklenebilir;
öğrenilmiş veya tekrar edilmiş sayılmaz. Otomatik sözlük çağrısı yapılmaz.

Boş satırlar atlanır. Eksik hücreler boş kabul edilir. Fazla hücreler otomatik
kesilmez: sütun eşleştirmesinde seçilebilir. Hatalı seviye veya alan uzunluğu
gibi satır hataları nedenleriyle gösterilir; onay yalnız geçerli satırları alır.
Kapanmamış tırnak, bozuk UTF-8, aşırı boyut/sütun/satır veya geçersiz eşleştirme
durumunda dosya/önizleme reddedilir. UTF-8 BOM, Türkçe harfler, emoji, CRLF/LF/CR
kayıt sonları, tırnak içinde ayıraç ve çok satırlı alan desteklenir. İç tırnak
`""` şeklinde kaçırılır. Tırnaksız, satır başındaki `#` açıklama kabul edilir;
kelime gerçekten `#` ile başlıyorsa alanı tırnak içine al.

## Yinelenen kayıtlar ve koruma

- Kelime; çevre boşlukları, harf büyüklüğü, iç boşluklar ve apostrof farkı
  normalize edilerek karşılaştırılır. Tür eşlenmişse tür de karşılaştırılır;
  bilinen Türkçe/İngilizce tür adları eşleştirilir. Bilinmeyen farklı türler
  birbirine karıştırılmaz. Dosyada tür yoksa aynı kelimeye ait tek kart bulunması
  gerekir; birden fazla tür/kart varsa satır belirsiz olarak atlanır.
- Varsayılan **Eşleşen kartı atla** hiçbir mevcut kart alanını değiştirmez.
- İsteğe bağlı **Yalnız boş alanları ve etiketleri tamamla**, yalnız boş ana
  anlam/örnek/çeviri/seviye/türü doldurur ve yeni etiketleri mevcutlara ekler.
  Hikâyeden miras alınan seviye boş sayılmaz. Dolu alanlar değiştirilmez.
  Dolu anlamın yerine dosyadaki farklı anlam yazılmaz; o anlamı eklemek için
  karttaki mevcut çoklu anlam düzenleyicisini kullan.
- Aynı yeni veya mevcut kartın dosyada birden fazla geçmesi durumunda ilk
  geçerli satır esas alınır. Önizleme sayıları satır bazındadır.
- Hikâye ilişkileri, özgün bağlamlar, kişisel örnekler, ek anlamlar, eş/zıt
  anlamlar ve iki tekrar motorunun geçmişi korunur. Aktarım silme veya toplu
  üzerine yazma seçeneği sunmaz.
- Koleksiyon önizlemeden sonra değişirse eski plan uygulanmaz. Dosya kaydı
  başarısızsa defter ve tekrar geçmişi korunur; hata gösterilir. UI kilidi ve
  mevcut dosya revizyon kontrolü çift tıklama/eşzamanlı oturum üzerine yazmasını
  engeller. Uygulama belleğindeki önizlemenin sunucudaki revizyonu eskimişse
  uygulamayı yenileyip güncel verilerle dosyayı yeniden seçmek gerekir.

## Dışa aktarma

**CSV hazırla**, **TSV hazırla** veya **Anki TSV hazırla** bir metin önizlemesi
oluşturur; ardından **Hazırlanan kelime dosyasını kaydet** webde indirir,
native sürümde mevcut dosya paylaşım menüsünü kullanır. Koleksiyon hazırlama
sonrasında değişirse dosyayı yeniden hazırlamak gerekir.

Tüm kartlar, yedi ana alanıyla dışa aktarılır: `Word`, `Meaning`, `Example`,
`Tags`, `Level`, `Type`, `Sentence translation`. Dışa aktarma UTF-8 BOM ve CRLF
kayıt sonları kullanır; hücrede ayıraç, tırnak, satır sonu veya baştaki `#`
gerektiğinde çift tırnakla kaçırılır. Dosya en fazla 5 MB olabilir. Standart
CSV/TSV'de etiket hücresi JSON dizisidir; böylece `past simple` gibi boşluklu veya
ayraç içeren etiketler korunur. İçe aktarmadaki **Virgül/noktalı virgül veya JSON
etiketleri** bunu geri okur; elle yazılmış listelerde virgül, noktalı virgül ve
satır sonu da ayracı olabilir.

Bu metin dosyaları ana alanları taşır. Ek anlamlar, ek örnekler, hikâye kimlikleri
ve bağlamları, sesler, gramer/sınav verisi, çalışma hedefleri ve tekrar geçmişi
bu tablonun parçası değildir. Bunlar için JSON/ZIP yedekleri kullanılmalıdır.

## Anki uyumluluğunun kapsamı

Bu özellik **metin alanı alışverişidir; tam Anki paket aktarımı değildir**.
`.apkg` okuyucu/yazıcı, SQLite koleksiyonu, medya arşivi, deste/not modeli,
kart şablonu, GUID tabanlı güncelleme, cloze şablonu veya Anki zamanlayıcı
dönüşümü uygulanmamıştır. Uygulamadaki 1/3/7/14/30/60 gün planı aktarılmaz.

Anki TSV çıktısı `#separator:Tab`, `#html:false` ve `#columns:` başlıklarını
içerir. Anki'nin metin içe aktarma ekranında alanları ve etiket sütununu seçmek
gerekebilir. Etiketler boşlukla ayrılır; uygulamada boşluk içeren bir etiket
çıktıda alt çizgiye çevrilir ve önizlemede uyarılır. Uygulama etiketleri değişmez.

İçe aktarmada `#separator:` (Comma, Semicolon, Tab veya bunların karakterleri),
`#columns:`, genel `#tags:` ve HTML hakkında uyarı için `#html:` tanınır. Bu
başlıkları içeren dosyalarda Anki etiket ayıracı önerilir; kullanıcı elle
değiştirebilir. Diğer açıklama/Anki yönergeleri kelimeye dönüşmez, uygulanmaz.
Özel sütunları, örneğin `#tags column:` için etiketi manuel eşleştir. HTML ve
`[sound:...]` gibi medya referansları çalıştırılmaz; cloze metni dönüştürülmez.

Kapsam [Anki'nin resmî metin aktarımı belgesindeki](https://docs.ankiweb.net/manual/importing/text-files)
UTF-8, alan eşleştirmesi, ayraç, tırnak, çok satırlı alan ve dosya başlığı
kurallarıyla karşılaştırılmıştır. Anki uygulamasının kendisinde canlı test
yapılmamıştır; çıktı ve geri okuma otomatik testlerle doğrulanmıştır.

## Testler

`tests/word-transfer.test.mjs`: UTF-8/BOM ve bozuk kodlama, üç ayıraç,
CRLF/LF/CR, tırnak ve boş hücre, Anki metin başlıkları, Türkçe/İngilizce ve
manuel eşleştirme, yinelenen kart/türler, yalnız boş alan doldurma, miras seviye,
geçersiz satır ve eski önizleme reddi, CSV/TSV/Anki metin çıktısı, 10.000 satır,
dosyayı yeniden açma ve JSON/ZIP yedeklerinin kayıpsız korunması.

`tests/e2e/word-transfer.spec.mjs`: gerçek dosya API'siyle onay öncesi yazmama,
manuel sütun seçimi, boş alan tamamlama, iptal, çift tıklama, başarısız kayıt ve
yeniden deneme, eşzamanlı dış düzenlemeyi koruma, bozuk dosya/APKG reddi,
Anki metnini alma ve üç indirme biçiminin bytes üzerinden doğrulanması.
Masaüstü Chrome ve mobil tarayıcı görünümü kapsanır; native cihaz testi
yapılmamıştır.

Faz 7 doğrulama sonucu: 216 birim/entegrasyon testi ve 140 tarayıcı senaryosu
başarılı. `npm run typecheck`, `npm run build:web` ve değişen kaynakların
Prettier kontrolü başarılı. Testler geçici defterde çalıştırıldı; kişisel
kayıtlara test verisi eklenmedi. Yeni bağımlılık eklenmedi.
