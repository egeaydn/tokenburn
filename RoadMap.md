# AI Kodlama Araçları Harcama Takipçisi: Proje Yol Haritası

> Claude Code, Codex CLI gibi AI kodlama araçlarının yerel log verilerini okuyup tek bir yerde gösteren, terminalde çalışan bir CLI aracı. Veri makineden dışarı çıkmaz.

**Çalışma adı:** _(henüz seçilmedi, Faz 0'da belirlenecek)_
**Dil / Platform:** TypeScript, Node 20+, terminal (CLI)
**Dağıtım:** `npx aracadi` ile kurulumsuz kullanım

---

## 1. Temel Kararlar

- **Terminalde çalışacak, v1'de React yok.** Tablo basan, renkli çıktı veren sade bir CLI hem daha hızlı yazılır hem daha hızlı açılır. React (Ink ile) ancak canlı/interaktif arayüz istenirse sonraki sürümlerde gündeme gelir.
- **Fark yaratacak nokta:** Birden fazla aracı tek yerde toplamak ve harcamayı **proje bazında** göstermek ("hangi repoya ne kadar harcadım").
- **Gizlilik satış noktası:** Tüm işlem yerelde yapılır, hiçbir veri dışarı gitmez.
- **Rekabet notu:** Claude Code için bu işi yapan popüler bir araç zaten var (ccusage). Sadece "Claude Code harcaması" diye girmek kaybettirir; fark çok araçlı destek ve proje bazlı görünüm olmalı.

---

## 2. Mimari

Çekirdek bir **adapter yapısı** kullanılacak. Her araç için ayrı bir adapter, hepsi aynı ortak formatı üretir (zaman, araç, model, proje, input/output/cache token). Yeni araç eklemek tek dosya olur; bu da katkıcıları çeker.

```
src/
  cli.ts              → komutlar (daily, monthly, project, report)
  providers/
    types.ts          → Provider arayüzü
    claude-code.ts    → her araç için bir adapter
    codex.ts
  core/
    normalize.ts      → adapter çıktısını ortak formata çevirir
    pricing.ts        → model fiyatlandırması + maliyet hesabı
    aggregate.ts      → gün/ay/proje/model bazında toplama
  output/
    table.ts          → terminal tablosu
    json.ts           → --json çıktısı
    html.ts           → --html raporu
```

---

## 3. Kütüphaneler

| İş | Öneri | Not |
|---|---|---|
| CLI komutları | `commander` veya `citty` | commander en yaygın, bol örnek var |
| Renk | `picocolors` | küçük ve hızlı |
| Tablo | `cli-table3` | sade ve yeterli |
| Dosya tarama | `fast-glob` | JSONL dosyalarını bulmak için |
| Satır satır okuma | Node `readline` + `fs.createReadStream` | büyük loglarda bellek şişmez |
| Doğrulama | `zod` | log formatı değişince çökmesin, bozuk satırı atlasın |
| Build | `tsup` | tek dosyaya paketler, `npx` için ideal |
| Test | `vitest` | hızlı, TS ile sorunsuz |
| Lint / format | `biome` (veya eslint + prettier) | tek araçla halleder |
| Sürümleme | `changesets` | otomatik changelog ve release |
| HTML grafik | Chart.js (CDN veya gömülü) | React gerektirmez |
| Spinner / prompt (isteğe bağlı) | `ora`, `@clack/prompts` | şık görünüm |

Paket yöneticisi: `pnpm`. Hedef: Node 20+.

---

## 4. Yol Haritası

### Faz 0: Hazırlık (1 gün)
- [ ] GitHub'da benzer araçları ara (usage tracker, token cost, ccusage vb.)
- [ ] **Neyi farklı yaptığını tek cümleyle yaz.** Bu cümle README'nin ilk satırı olacak.
- [ ] İsim seç: kısa, yazması kolay, npm'de ve GitHub'da boş olsun
- [ ] Repo aç: MIT lisans, `.gitignore`
- [ ] TypeScript + tsup + vitest iskeletini kur
- [ ] GitHub Actions ile CI ekle

### Faz 1: Tek araçla çalışan çekirdek (hafta sonu)
- [ ] **Önce kendi makinendeki log dosyalarına bak** (Claude Code genelde `~/.claude/` altında JSONL tutar; sürüme göre değişebilir, kendi gözünle doğrula). Gerçek veriye bakmadan parser yazma.
- [ ] İlk adapter'ı yaz, `zod` ile satırları doğrula, bozuk satırı sessizce atla
- [ ] Token toplama ve maliyet hesabı
- [ ] Fiyat tablosunu koda gömme, ayrı bir JSON'da tut (LiteLLM'in herkese açık model fiyat listesi iyi bir başlangıç, güncelliğini kontrol et)
- [ ] Komutlar: `daily`, `monthly`
- [ ] Çıktı: renkli terminal tablosu
- [ ] Örnek log fixture'larıyla birim testleri

**Çıkış kriteri:** `npx aracadi daily` kendi verinde doğru sonucu basıyor.

### Faz 2: Farkı yaratan kısım (1-2 hafta)
- [ ] İkinci adapter (Codex CLI vb.) ve ortak formata normalleştirme
- [ ] **Proje bazlı görünüm:** "hangi repoya ne kadar harcadım"
- [ ] `--json` çıktısı
- [ ] Tarih filtreleri: `--since`, `--until`
- [ ] Araç filtresi: `--provider`
- [ ] Bilinmeyen model gelirse çökmek yerine "fiyat bilinmiyor" göster

### Faz 3: Paylaşılabilir çıktı (1 hafta)
- [ ] `--html` ile tek dosyalık rapor: günlük harcama grafiği, araç/model/proje dağılımı, toplam özet
- [ ] Şık bir tasarım (insanlar ekran görüntüsünü paylaşır, yıldızın büyük kısmı buradan gelir)
- [ ] Rapor tamamen yerelde üretilsin; README'de bunu vurgula

### Faz 4: Yayın hazırlığı (3-4 gün)
- [ ] README: tek cümle açıklama, **GIF veya ekran görüntüsü**, 3 satırlık kurulum, kullanım örnekleri, desteklenen araç tablosu, gizlilik notu
- [ ] npm'e yayınla
- [ ] Repo topic'lerini ve açıklamasını ekle
- [ ] `good first issue` etiketli 3-4 issue aç (ör. "X aracı için adapter yaz")
- [ ] `CONTRIBUTING.md` ve adapter yazma rehberi
- [ ] Issue şablonları, CI rozeti

### Faz 5: Tanıtım ve büyüme
- [ ] Show HN, r/ClaudeAI, r/programming ve ilgili subreddit'ler, dev.to
- [ ] X / LinkedIn'de rapor görseliyle paylaşım
- [ ] "Build in public" olarak süreci anlat (Instagram içerik planıyla birleştirilebilir)
- [ ] Gelen issue'lara hızlı cevap ver (ilk haftalar kritik)
- [ ] Sonraki sürümler: yeni adapter'lar, `--watch` canlı mod, isteğe bağlı Ink ile interaktif arayüz, bütçe uyarısı (`--budget`)

---

## 5. Dikkat Edilecekler

- **Log formatları değişir.** Bu yüzden `zod` ve "bilinmeyeni atla" yaklaşımı şart, aksi halde her güncellemede araç bozulur.
- **Cursor / Copilot** gibi araçlarda token verisi yerelde yoksa bunu README'de dürüstçe "desteklenmiyor" diye yaz, zorlama.
- **Fiyat, dosya yolu ve format ayrıntılarını kesin doğru kabul etme.** İlk iş gerçek dosyalara bakmak.
- İlk projede 100+ yıldız bile iyi bir başlangıçtır; binlerce yıldız doğru zaman, doğru niş ve iyi tanıtımla gelir.

---

## 6. Yıldız Getiren Şeyler (Kontrol Listesi)

- [ ] Net ve aranabilir isim
- [ ] README'de GIF/ekran görüntüsü
- [ ] Tek komutla deneme (`npx`)
- [ ] Topic etiketleri, açıklama, MIT lisans
- [ ] Düzenli commit, sürüm etiketleri, changelog
- [ ] Testler ve CI rozeti
- [ ] Katkıcılar için `CONTRIBUTING.md` ve `good first issue`'lar
- [ ] Paylaşılabilir HTML rapor çıktısı