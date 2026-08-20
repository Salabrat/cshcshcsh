# 🔧 Решение проблемы "port 3002 already in use"

## ❌ Ошибка
```
Error: listen EADDRINUSE: address already in use :::3002
```

Порт 3002 уже занят старым процессом сервера.

## ✅ Решение 1: Остановить процесс автоматически

Команда уже выполнена выше - процессы на порту 3002 должны быть остановлены.

## ✅ Решение 2: Вручную через терминал

**Windows PowerShell:**
```powershell
Get-NetTCPConnection -LocalPort 3002 | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force
```

**Или через Task Manager:**
1. Откройте Диспетчер задач (Ctrl + Shift + Esc)
2. Найдите процесс `node.exe`
3. Завершите процесс

## ✅ Решение 3: Использовать другой порт

Если нужно запустить на другом порту, измените в `server.js`:
```javascript
const PORT = process.env.PORT || 3003; // Изменить на 3003 или другой
```

И в ngrok:
```bash
ngrok http 3003
```

## 🚀 После остановки процесса

Теперь можно запустить снова:
```bash
npm run ngrok
```

Или по отдельности:
```bash
npm start
```

## 💡 Проверка

После остановки проверьте, что порт свободен:
```powershell
Get-NetTCPConnection -LocalPort 3002
```

Если команда ничего не вернула - порт свободен, можно запускать сервер!
