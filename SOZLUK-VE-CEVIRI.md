# Kelime kartları, kaynaklar ve yerel çeviri

Kelime eklerken yalnızca İngilizce kelimeyi yazıp Kaydet'e basabilirsin. Boş bilgiler tamamlanır. Kaydın eş/zıt anlam alanlarından her kelime için bir kart oluşur; var olan kartlar tekrar eklenmez. Otomatik kartlar yeni kartlar üretmez. Eski kartlar için **Kelimelerim > Eksikleri tamamla**, tek kart için **Sözlükten tamamla** kullanılır. İşlem durdurulduğunda tamamlanan kayıtlar korunur. İnternet yoksa mevcut eş/zıt anlamlardan boş kartlar oluşturulur; sözlük bilgileri daha sonra tamamlanabilir.

- Free Dictionary API ilk uygun kelime türünün İngilizce açıklamasını ve varsa örnek cümlesini sağlar. Datamuse yalnızca açıklama bulunamadığında yedek olarak çağrılır; eş/zıt anlam istekleri yapılmaz. Yeni ilişkili kartlar yalnızca kullanıcının formda yazdığı kelimelerden oluşur.
- Free Dictionary API yanıt vermezse CEFR listelerindeki kelimeler için yaklaşık 1 MB'lık Princeton WordNet 3.0 çevrimdışı açıklama paketi kullanılır. Pakette 8.411 kelime/tür eşleşmesi vardır. Türkçe karşılık bu pakette yoktur; kuruluysa Argos yerel olarak çevirir. Kelime türü belirsizse yanlış anlam seçmemek için WordNet eşleşmesi yapılmayabilir.
- Türkçe anlam alanı seçilen İngilizce sözlük açıklamasının çevirisidir; kısa bir Türkçe sözlük maddesi olduğu iddia edilmez. Örnek cümle yoksa uydurulmaz.
- CEFR eşleştirmesi kelime ve kelime türüne göre yapılır. Belirsiz/eksik eşleşmeler **Seviye bekleyen kelimeler** altında kalır. Çekimli kelimeler için gelişigüzel kök tahmini yapılmaz. Seviyeler bağlamın her anlamını ayrı ayrı değerlendirmez.
- Dolu alanlar korunur. Yeniden otomatik bulmak istediğin alanı düzenleyicide temizle. Bir kelimenin birden çok anlamını ayrı kartlar halinde saklama henüz desteklenmez.
- API hataları kartları silmez. Süresi dolmuş başarılı önbellek, servis erişilemezse kullanılabilir; bulunamayan kelime sonuçları yalnızca bir gün önbellekte tutulur. Kartlar ve kaynak bilgileri `data/notebook.json` içinde kalır; bu kişisel dosya Git tarafından yok sayılır, başka bilgisayara taşırken ayrıca yedeklenmelidir. Geçici sözlük/çeviri önbelleği `data/dictionary-cache/` içindedir ve Git'e alınmaz.

## Türkçe çeviri kurulumu

Başlatıcı Python 3.11 ortamını, sabitlenmiş Argos paketlerini ve İngilizce → Türkçe 1.5 modelini proje klasörüne otomatik kurar. İlk kurulum internet ve birkaç yüz MB indirme/disk alanı gerektirir. Daha sonra çeviri CPU üzerinde yerelde çalışır. Başka PC'de başlatıcı o sisteme uygun kurulumu yeniden yapar; `.venv` ve `.runtime` klasörlerini taşıman gerekmez.

Uygulamayı Windows'ta **Baslat.cmd**, Linux'ta **sh Baslat.sh** ile aç. Çeviri servisi gerektiğinde otomatik başlar. **Durdur** yeni kart işlemlerini keser; başlamış yerel çeviri arka planda tamamlanabilir. İlk model yüklemesi sonraki çevirilerden daha yavaştır.

Diğer işletim sistemlerinde Python 3.11 ile `.venv` oluştur, `scripts/translation-requirements.txt` paketlerini kur, yukarıdaki Argos modelini resmi paket indeksinden indir ve `.venv/bin/python scripts/translate_worker.py --install MODEL_DOSYASI` çalıştır. Bu yol henüz bu projede cihaz üzerinde test edilmedi. React Native Android/iOS ekranları çalışmaya devam eder; otomatik sözlük servisi bu sürümde yerel web uygulamasına bağlıdır.

## Kaynaklar ve lisanslar

- Datamuse: https://www.datamuse.com/api/ — sorgular için yalnızca kelime gönderilir. API anahtarı gerekiyorsa sunucuyu `DATAMUSE_API_KEY` ortam değişkeniyle başlat; anahtarı Git'e ekleme. 1 Ocak 2027 için duyurulan anahtar zorunluluğu desteklenir.
- Free Dictionary API: https://dictionaryapi.dev/ — yanıtın sağladığı kaynak URL'leri ve lisans bilgisi kartın kaynak alanında saklanır.
- Princeton WordNet 3.0: https://wordnet.princeton.edu/license-and-commercial-use — resmî `WNdb-3.0.tar.gz` içinden yalnızca CEFR listelerindeki uygun kelimelerin ilk açıklamaları ayıklandı. Veri `resources/offline-wordnet.json`, lisans `resources/WORDNET-LICENSE.txt` içindedir. Veriyi yeniden üretmek için resmî arşivin `dict/` dizinini çıkarıp `node scripts/build-offline-wordnet.mjs <dict-klasörü>` çalıştır.
- CEFR-J 1.5 ve Octanove C1/C2 1.0: https://github.com/openlanguageprofiles/olp-en-cefrj — kaynak revizyonu `d4e45b75b38f27b30dfc5c44d8c571aec7e7092f`. Özgün CSV'ler `resources/cefr/` içinde değiştirilmeden saklanır. CEFR-J: Yukio Tono, Tokyo University of Foreign Studies, Tono Laboratory; kaynak gösterilerek ücretsiz kullanım. Octanove: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Bu lisans bilgileri yeniden dağıtımda korunmalıdır; özgün README aynı dizindedir.
- Argos Translate: https://github.com/argosopentech/argos-translate — açık kaynak yerel çeviri. Model: https://argos-net.com/v1/translate-en_tr-1_5.argosmodel (resmi Argos paket indeksi). Model/paket lisansları indirmelerin içinde korunur.
- uv kurulum aracı: https://github.com/astral-sh/uv — resmi Windows x64 sürümü. Kurucu indirilen uv arşivi ve çeviri modeli için SHA-256 kontrolü yapar.

Özel cümlelerin veya hikâyelerin tamamı dış çeviri servislerine gönderilmez. Sözlük servisleri kelime sorgusunu alır. Yerel çeviri bu bilgisayarda yapılır; yalnızca ilk kurulumda gerekli dil paketleri indirilir.

Free Dictionary API açıklama vermez veya erişilemezse önce yerel WordNet, onda da eşleşme yoksa Datamuse'un tam kelime ve kelime türü eşleşen açıklaması denenir. API istekleri dört saniyede zaman aşımına uğrar; uygun geçici hatalarda bir kez tekrarlanır. İstek sınırında servis kısa süre beklemeye alınır. Hata ve bulunamayan alanlar ayrı gösterilir. Cümle ayırma, Argos modelinin eski Stanza dosyaları yerine spaCy İngilizce kurallarıyla çevrimdışı yapılır.

## Kelime kartı görünümü

Listelerde yalnızca kelime adı görünür. Kelimeye tıklayınca kaydırılabilir ayrıntı penceresi açılır; anlamlar, örnek cümleler ve düzenleme işlemleri burada yer alır. Seviye kaynağı kapalı başlayan Kaynaklar bölümüne taşınmıştır.

## Güncel kart oluşturma kuralı

Sözlük yanıtları artık eş/zıt anlam alanlarına aktarılmaz. Yalnızca kelime ekleme/düzenleme formuna kullanıcının yazdığı eş ve zıt anlamlılar, Kaydet sırasında kartlara dönüşür. Alanlar boşsa ek kart oluşmaz. Sözlükten tamamla ve Eksikleri tamamla işlemleri yeni kart üretmez; açıklama, çeviri ve seviye gibi eksikleri tamamlar. Önceden oluşturulmuş kartlar otomatik silinmez.

## Ortak otomatik başlatıcı

Windows'ta Baslat.cmd, Linux x64/glibc üzerinde sh Baslat.sh kullanın. Node.js 24+ yoksa başlatıcı resmî arşivden indirip doğrular. Eksik proje ve çeviri bağımlılıklarını otomatik hazırlar; başarılı kurulum sonraki açılışlarda tekrarlanmaz. Ayrıntılar YENI-PC-KURULUM.txt içindedir. Ayrı Ceviri-Kur.cmd adımı normal başlangıçta gerekli değildir.
# Genişletilmiş yerel sözlük

WordNet 3.0 paketi 154.115 kelime/tür kaydı içerir (17.373.302 bayt, yaklaşık 16,6 MiB). İngilizce açıklama ve varsa örnek cümle yerelden okunur. Türkçe karşılıklar bu pakette bulunmaz; Wiktionary sonuçları ayrı dosya önbelleğinde birikir. Tam paketi yeniden üretmek için `node scripts/build-offline-wordnet.mjs <dict-klasörü> --full` kullanılır. Veri Princeton WordNet 3.0 arşivinden türetilmiştir; `resources/WORDNET-LICENSE.txt` geçerlidir.

# Türkçe anlam kalitesi

Kelime anlamında önce English Wiktionary'nin İngilizce bölümünde, seçilen kelime türüne ait Türkçe çeviri tabloları kullanılır. Sonuçlar `data/dictionary-cache` altında saklanır. Kaynak bağlantısı ve CC BY-SA 4.0 bilgisi kartın kaynaklarına eklenir. Tablo bulunamazsa Argos açıklama çevirisi denenir; İngilizce metne çok benzeyen sonuç Türkçe anlam olarak kaydedilmez. Bu kontrol tüm kötü çevirileri tespit edemez.

Karttaki “Türkçe anlamı yenile” düğmesi mevcut ilk anlamı Wiktionary karşılığıyla değiştirir; sözlük karşılığı bulunamazsa mevcut alan korunur. Çok anlamlı kelimelerde karşılıklar cümle bağlamına göre otomatik seçilmez; kullanıcının kontrolü gerekir. Örnek cümle çevirisi hâlâ Argos kullanır ve elle düzenlenebilir.

