# 🚀 Руководство по деплою

## Варианты хостинга

### 1. GitHub Pages (Бесплатно, Рекомендуется)

#### Шаг 1: Создайте Git репозиторий
```bash
cd c:/Users/namename/Documents/SITEcpcompany
git init
git add .
git commit -m "Initial commit: C.P. Company clone"
```

#### Шаг 2: Создайте репозиторий на GitHub
1. Перейдите на https://github.com/new
2. Создайте новый репозиторий: `cpcompany-clone`
3. Не добавляйте README, .gitignore (уже есть)

#### Шаг 3: Push на GitHub
```bash
git remote add origin https://github.com/ВАШ_USERNAME/cpcompany-clone.git
git branch -M main
git push -u origin main
```

#### Шаг 4: Включите GitHub Pages
1. Перейдите в Settings → Pages
2. Source: Deploy from branch
3. Branch: main, folder: / (root)
4. Сохраните

✅ Сайт будет доступен: `https://ВАШ_USERNAME.github.io/cpcompany-clone/`

---

### 2. Netlify (Бесплатно, Drag & Drop)

#### Через веб-интерфейс:
1. Перейдите на https://app.netlify.com/drop
2. Перетащите всю папку `SITEcpcompany`
3. Сайт автоматически задеплоится

#### Через Netlify CLI:
```bash
npm install -g netlify-cli
cd c:/Users/namename/Documents/SITEcpcompany
netlify deploy --prod
```

✅ Получите URL: `https://random-name.netlify.app`

**Настройка custom domain:**
1. Site settings → Domain management
2. Add custom domain
3. Следуйте инструкциям

---

### 3. Vercel (Бесплатно, Автоматический деплой)

#### Через GitHub:
1. Перейдите на https://vercel.com/new
2. Import Git Repository
3. Выберите ваш репозиторий
4. Deploy

#### Через Vercel CLI:
```bash
npm install -g vercel
cd c:/Users/namename/Documents/SITEcpcompany
vercel
```

✅ URL: `https://cpcompany-clone.vercel.app`

---

### 4. Cloudflare Pages (Бесплатно, CDN)

1. Перейдите на https://pages.cloudflare.com
2. Create a project
3. Connect to Git или Upload assets
4. Deploy

**Преимущества:**
- Быстрый CDN
- Бесплатный SSL
- Unlimited bandwidth

---

### 5. Surge.sh (Бесплатно, Командная строка)

```bash
npm install -g surge
cd c:/Users/namename/Documents/SITEcpcompany
surge
```

Введите email и пароль → Получите URL

---

## 📦 Подготовка к продакшену

### 1. Оптимизация файлов

#### Минификация CSS
```bash
npm install -g cssnano postcss-cli
postcss styles.css -o styles.min.css --use cssnano
```

#### Минификация JavaScript
```bash
npm install -g terser
terser script.js -o script.min.js --compress --mangle
```

#### Обновите index.html
```html
<!-- Замените -->
<link rel="stylesheet" href="styles.css">
<script src="script.js"></script>

<!-- На -->
<link rel="stylesheet" href="styles.min.css">
<script src="script.min.js"></script>
```

### 2. Оптимизация изображений

#### Установите ImageOptim или используйте онлайн
- https://tinypng.com/
- https://squoosh.app/

#### Или через CLI
```bash
npm install -g imagemin-cli
imagemin images/* --out-dir=images/optimized
```

### 3. Добавьте robots.txt

```txt
User-agent: *
Allow: /
Sitemap: https://your-domain.com/sitemap.xml
```

### 4. Добавьте sitemap.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://your-domain.com/</loc>
    <lastmod>2025-01-01</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

### 5. Настройте .htaccess (если Apache)

```apache
# Включить кэширование
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>

# Включить сжатие
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css application/javascript
</IfModule>

# Force HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

## 🔒 Security Headers

### Netlify (_headers файл)
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com;
```

### Vercel (vercel.json)
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

## 📊 Analytics

### Google Analytics
Добавьте перед `</head>`:
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Yandex Metrica
```html
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
   ym(XXXXXX, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true
   });
</script>
```

## 🎯 SEO Optimization

### Добавьте Open Graph tags
```html
<meta property="og:type" content="website">
<meta property="og:url" content="https://your-domain.com/">
<meta property="og:title" content="C.P. Company - Italian Sportswear">
<meta property="og:description" content="Official online store of C.P. Company">
<meta property="og:image" content="https://your-domain.com/og-image.jpg">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content="https://your-domain.com/">
<meta name="twitter:title" content="C.P. Company">
<meta name="twitter:description" content="Italian Sportswear Brand">
<meta name="twitter:image" content="https://your-domain.com/twitter-image.jpg">
```

### Structured Data (Schema.org)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ClothingStore",
  "name": "C.P. Company",
  "url": "https://your-domain.com",
  "logo": "https://your-domain.com/logo.png",
  "description": "Italian Sportswear Brand"
}
</script>
```

## 🧪 Pre-Deploy Checklist

### Перед деплоем проверьте:
- [ ] Все ссылки работают
- [ ] Изображения загружаются
- [ ] Мобильная версия работает
- [ ] Формы отправляются
- [ ] JavaScript без ошибок (Console)
- [ ] CSS корректно применяется
- [ ] Favicon установлен
- [ ] Meta tags заполнены
- [ ] robots.txt создан
- [ ] sitemap.xml создан
- [ ] Analytics подключены
- [ ] SSL сертификат настроен
- [ ] Custom domain настроен (опционально)

## 🔍 Testing после деплоя

### 1. Lighthouse Audit
```bash
# В Chrome DevTools
F12 → Lighthouse → Generate Report
```

**Целевые показатели:**
- Performance: > 90
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 90

### 2. PageSpeed Insights
https://pagespeed.web.dev/

### 3. GTmetrix
https://gtmetrix.com/

### 4. WebPageTest
https://www.webpagetest.org/

### 5. Mobile-Friendly Test
https://search.google.com/test/mobile-friendly

## 🌍 Custom Domain

### Настройка DNS (пример для Netlify)

1. **A Record**
   ```
   Type: A
   Name: @
   Value: 75.2.60.5
   ```

2. **CNAME Record**
   ```
   Type: CNAME
   Name: www
   Value: your-site.netlify.app
   ```

### SSL Certificate
- GitHub Pages: Автоматически
- Netlify: Автоматически (Let's Encrypt)
- Vercel: Автоматически
- Cloudflare: Автоматически

## 🚀 CI/CD Pipeline

### GitHub Actions (.github/workflows/deploy.yml)
```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v1.2
        with:
          publish-dir: './'
          production-deploy: true
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 💰 Стоимость хостинга

| Платформа | Free Tier | Paid Plans |
|-----------|-----------|------------|
| **GitHub Pages** | ✅ Unlimited | - |
| **Netlify** | ✅ 100GB/month | $19/mo |
| **Vercel** | ✅ 100GB/month | $20/mo |
| **Cloudflare Pages** | ✅ Unlimited | $20/mo |
| **Surge.sh** | ✅ Basic | $30/mo |

**Рекомендация:** GitHub Pages для статики, Netlify для продакшена

## 📞 Поддержка

После деплоя:
1. Проверьте все функции
2. Настройте мониторинг (UptimeRobot)
3. Добавьте в Google Search Console
4. Создайте backup

---

**Готово к деплою! 🚀**

Выберите платформу и следуйте инструкциям выше.
