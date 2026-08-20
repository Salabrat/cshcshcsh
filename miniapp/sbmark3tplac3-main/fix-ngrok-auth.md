# 🔧 Исправление авторизации ngrok

## ❌ Ошибка
Вы написали: `add-authotoken` (без "h")
Правильно: `add-authtoken` (с "h")

## ✅ Правильная команда

Выполните команду **с "h"**:

```bash
ngrok config add-authtoken 2z2oFaYHjRnRCZy48tm29Wem46T_52Mi8qsZBi6jgVfDjRuXW
```

Обратите внимание: `add-authtoken` (с "h" между "aut" и "token")

## 📋 Полная последовательность

1. **Авторизуйтесь с правильной командой:**
```bash
ngrok config add-authtoken 2z2oFaYHjRnRCZy48tm29Wem46T_52Mi8qsZBi6jgVfDjRuXW
```

2. **Вы должны увидеть:**
```
Authtoken saved to configuration file: C:\Users\...\AppData\Local\ngrok\ngrok.yml
```

3. **Затем запустите:**
```bash
npm run ngrok
```

## ✅ Проверка

После авторизации проверьте:
```bash
ngrok config check
```

Если увидите что-то вроде:
```
Valid configuration file at: C:\Users\...\AppData\Local\ngrok\ngrok.yml
```
То всё настроено правильно!
