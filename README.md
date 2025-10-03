# NobkTV Emoji Panel Extension

Bu proje, nobkTV sohbetinde özel emoji paneli ve otomatik emoji dönüştürme özellikleri ekler.

## Özellikler
- Sohbet mesajlarında anahtar kelimeleri otomatik olarak emojiye çevirir.
- Sağ altta açma/kapatma butonu (dex.png ile) ile emoji paneli açılır.
- Paneldeki emojiye tıklayınca ismi otomatik olarak mesaj kutusuna eklenir ve panel kapanır.
- Panel açıkken buton renkli, kapalıyken siyah beyaz görünür.

## Kurulum
1. Tüm dosyaları repoya klonlayın veya indirin.
2. `emoji/` klasöründe gerekli görsellerin olduğundan emin olun (ör: dex.png).
3. `manifest.json` ve `emoji.json` dosyalarını düzenleyin.
4. `content.js` dosyasını tarayıcı eklentisi olarak yükleyin veya doğrudan sayfada çalıştırın.

## Kullanım
- Sağ alttaki dex.png butonuna tıklayarak emoji panelini açın.
- Paneldeki bir emojiye tıklayınca, ismi otomatik olarak mesaj kutusuna eklenir ve panel kapanır.
- Sohbet mesajlarında anahtar kelime yazınca otomatik emojiye dönüşür.

## Geliştirici Notları
- Panel ve buton stilleri kolayca özelleştirilebilir.
- Yeni emoji eklemek için `emoji.json` ve `emoji/` klasörünü güncelleyin.

## Katkı
Pull request ve önerilere açıktır!

---

**Demo:**
![Panel Açma Butonu](emoji/dex.png)

---

### Tutorial

1. Projeyi klonlayın:
   ```sh
   git clone <repo-url>
   ```
2. Gerekli dosyaları ve görselleri ekleyin.
3. Tarayıcıda veya eklenti olarak çalıştırın.
4. Sağ alttaki butona tıklayın, paneli açın ve emoji seçin.
5. Sohbet kutusuna otomatik olarak emoji ismi eklenir.

Herhangi bir sorunda repodan issue açabilirsiniz.
