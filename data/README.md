# Yerel uygulama verileri

Uygulama çalışırken kişisel defter `data/notebook.json` dosyasına, otomatik yedekler
`data/backups/` klasörüne, hikâye sesleri `data/story-audio/` klasörüne ve indirilen sözlük cevapları `data/dictionary-cache/` klasörüne yazılır.

Kişisel defter, yedekler ve sözlük önbelleği Git tarafından özellikle yok sayılır ve GitHub'a gönderilmez. Temiz bir kurulumda uygulama, `src/sample.ts` içindeki boş defterle yeni bir `notebook.json` oluşturur.

Kişisel kayıtları başka bilgisayara taşımak için uygulamanın ZIP yedekleme özelliğini kullan veya
uygulama kapalıyken `notebook.json` dosyasını güvenli bir konuma kopyala.
Web sürümünde tam ZIP yedeği oluştururken hikâye seslerini dahil et. Eski JSON ve native cihaz yedekleri MP3 içermez; bu durumda `story-audio/` klasörünü de taşı.
