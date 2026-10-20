# Bağlam içinde kelimeler ve ifadeler

Hikâyede tek kelimeye dokunarak veya **Kelime/ifade kaydet** düğmesinden
ifadenin ilk ve son kelimesini seçerek kelime kartı açılır. **İfade seç** ve
**Cümleyi seç** önceki hikâye notu akışlarını korur.

Mevcut kelime, büyük/küçük harf ve boşluk farkları normalize edilerek bulunur.
Birden fazla türde aynı kelime varsa önce mevcut hikâyeyle ilişkili kart,
ardından ilk eşleşen kart açılır. Kart editöründe tür ve anlam değiştirilebilir.
Kaydetmeden kaynak ilişkisi eklenmez. Aynı kart başka hikâyeden kaydedildiğinde
ilk örneği, ek anlamları ve tekrar geçmişi korunur; yeni kaynak ayrıca eklenir.
İstenirse **Bu bağlamdaki anlam** alanı o cümleye özgü anlamı saklar.

Kelime kartındaki **Bağlamlar ve kişisel örnekler** bölümünde kaynak başlığı,
özgün cümle, anlam, varsa çeviri ve kaynak hikâyeye bağlantı bulunur. Kişisel
örnek, çeviri ve anlam eklenip düzenlenebilir. Kaynak cümleler anlık kopya olarak
saklanır: ana örneği veya hikâyeyi düzenlemek özgün cümleyi değiştirmez.
Hikâye silinirse yalnız bağlantısı kaldırılır; başlık, cümle ve anlam kalır.

Tür seçimi **Öbek fiil (phrasal verb)**, **Eşdizim (collocation)** ve genel
**İfade** seçeneklerini içerir. Seviye önceki kart alanını kullanır. Kelime
etiketleri virgülle girilir; en fazla 20 etiket, her biri 40 karakterdir.
Arama kelime, anlamlar, etiketler, örnekler ve kaynak başlığında çalışır;
mevcut seviye, tür, sıralama ve sayfalama filtreleri korunur.

**Kelime testleri → Boşluk doldurma** tüm kayıtlı uygun cümleleri listeler.
Hedef ifade bütün olarak gizlenir; alt kelime eşleşmeleri ve tahmini çekimler
kullanılmaz. Kullanıcı çalışma cümlesini seçebilir. Cevaptan sonra seçilen
cümleye ait anlam ve çeviri gösterilir. Kayıtlı bağlam anlamları İngilizceden
Türkçeye cevap değerlendirmesine de dahildir. Örnek eklemek, cümle seçmek veya
cevabı kontrol etmek takvimi ilerletmez. Önceki tekrar motoru ve
**1, 3, 7, 14, 30, 60 gün** takvimi korunur.

## Veri uyumu ve yedekler

`Word.contexts?` her örnek için kimlik, `story`/`personal` türü, hikâye kimliği ve
başlık kopyası, seçilen ifade, cümle, çeviri ve anlam içerir. `Word.tags?` isteğe
bağlıdır. En fazla 100 bağlam saklanır. Eski `example`, `examples`, `senses`,
`storyId` ve `storyIds` alanları korunur. Şema sürümü 1 kalır; yeni alanları
olmayan kayıtlar açılır. Eski bir hikâye kartının ana örneği gerektiğinde
`legacy:<wordId>` kimliğiyle bağlam olarak gösterilir; ilk düzenlemede korunur.
Uygulama açılışında zorunlu dosya dönüşümü yapılmaz.

JSON ve ZIP yedekleri yeni alanları taşır. Kelimeye özel yedekler bağlamların
hikâye referanslarını da içerir. Geri yüklemede hikâye kimlikleri mevcut eşleme
kurallarıyla onarılır. Kaynak hikâye bulunamazsa cümle kaybolmaz, bağlantı boşalır.
Önceki **mevcut kayıtlara ekle** davranışı korunur: çakışan kartın mevcut verisi
ve geçmişi önceliklidir; o kartın yedekteki sürümü atlanır. Kartın yedekteki
sürümünü tüm bağlamlarıyla almak için Kelimelerim bölümünü **değiştir** seçeneği
kullanılır. Diğer bölümler seçilmedikçe değiştirilmez.

## Doğrulama

`tests/word-context.test.mjs`: eski kayıt, özgün cümle koruma, çoklu kaynak ve
anlam, tekrarlı seçim, kişisel örnek düzenleme, tüm örneklerle boşluk doldurma,
hikâye silme, bozuk veri reddi, JSON/ZIP geri yükleme, kaynak kimliği eşleme,
birleştirme ve dosya katmanının yeniden açılması.

`tests/e2e/word-context.spec.mjs`: gerçek dosya API'siyle hikâyeden ifade seçme,
tür/etiket kaydı, kaynak bağlantıları, bağlamda arama, kişisel örnek düzenleme,
yenileme sonrası kalıcılık ve boşluk doldurmadan tekrar kaydı. Masaüstü ve
mobil tarayıcı görünümü kapsanır; native cihaz testi yapılmamıştır.

Faz 4 doğrulama sonucu: 147 birim/entegrasyon testi ve 90 tarayıcı senaryosu
başarılı. Son düzenlemelerden sonra dört bağlam senaryosu iki ekran boyutunda
yeniden geçti. `npm run typecheck` ve `npm run build:web` başarılı.
