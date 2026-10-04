Docker ile English Desk kurulumu için doğrulanmış Linux amd64 imajı.

Windows/macOS üzerinde x86_64 Docker Desktop veya Linux x86_64 Docker Engine kullanabilirsin. ARM cihazlarda kaynak kodundan derleme yolunu kullan.

1. `english-desk-linux-amd64.tar.gz` dosyasını indir.
2. `docker load -i english-desk-linux-amd64.tar.gz` çalıştır.
3. Aşağıdaki komutla başlat:

```sh
docker run -d --name english-desk --init --restart unless-stopped -p 127.0.0.1:8081:8081 -v english-desk-data:/app/data -v english-desk-translation:/app/.runtime -v english-desk-python:/app/.venv english-desk:docker
```

Uygulama: http://127.0.0.1:8081

Defter, sesler ve otomatik yedekler `english-desk-data` volume'ünde tutulur. Container'ı silmek bu volume'ü silmez. İmaj kişisel veri içermez; uygulama boş defterle başlar.

Türkçe çeviri paketi imajda hazır kurulmuş değildir. Linux amd64 imajında isteğe bağlı olarak kurabilirsin:

```sh
docker exec -it english-desk node --use-system-ca scripts/setup-translation.mjs
```

Kullanım, yedekleme ve kaynak kodundan Docker Compose ile kurulum için [Docker rehberine](https://github.com/Teknoloji-Filozoflari/English-Desk/blob/main/docs/DOCKER.md) bak.
