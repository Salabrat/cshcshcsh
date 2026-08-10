# Bot Conflict Fix - README

## Problem Fixed
The "Terminated by other getupdates request" error has been resolved with improved error handling and bot management.

## What Was Changed

### 1. Enhanced Bot Startup (`streetshop.py`)
- Added comprehensive error handling for all startup operations
- Added retry mechanism for polling conflicts
- Better logging and status reporting
- Graceful shutdown handling
- Signal handlers for proper cleanup

### 2. New Bot Manager Utility (`bot_manager.py`)
A command-line utility to safely manage your bot instances.

## How to Use

### Method 1: Using the Bot Manager (Recommended)

```bash
# Start the bot safely
python bot_manager.py start

# Check if bot is running
python bot_manager.py status

# Stop the bot
python bot_manager.py stop

# Restart the bot
python bot_manager.py restart

# Get help
python bot_manager.py help
```

### Method 2: Direct Python Execution

```bash
# Just run the bot directly (now with improved error handling)
python streetshop.py
```

## Key Improvements

### 1. Conflict Detection & Resolution
- Automatically detects if another bot instance is running
- Provides clear error messages
- Offers retry mechanism with delays

### 2. Better Error Handling
- Graceful handling of API conflicts
- Comprehensive logging
- Proper resource cleanup

### 3. Safe Startup/Shutdown
- Signal handlers for clean shutdown
- Database connection management
- Storage cleanup

## Troubleshooting

### If you still get conflicts:

1. **Stop all instances first:**
   ```bash
   python bot_manager.py stop
   ```

2. **Wait a few seconds, then start:**
   ```bash
   python bot_manager.py start
   ```

3. **Check status:**
   ```bash
   python bot_manager.py status
   ```

### Manual Process Cleanup (if needed):

**Windows:**
```cmd
# Find Python processes
wmic process where "name='python.exe'" get ProcessId,CommandLine

# Kill specific process (replace XXXX with actual PID)
taskkill /f /pid XXXX
```

**Linux/Mac:**
```bash
# Find Python processes
pgrep -f streetshop.py

# Kill specific process (replace XXXX with actual PID)
kill -9 XXXX
```

## Error Prevention Tips

1. **Always use the bot manager** for starting/stopping
2. **Never run multiple instances** of the same bot simultaneously
3. **Wait a few seconds** between stop and start operations
4. **Check status** before starting if unsure

## Common Error Messages & Solutions

### "Terminated by other getupdates request"
- **Cause:** Multiple bot instances running
- **Solution:** Use `python bot_manager.py stop` then `python bot_manager.py start`

### "ConflictError" 
- **Cause:** API rate limiting or conflicts
- **Solution:** The bot will automatically retry with delays

### Connection errors
- **Cause:** Network issues or invalid bot token
- **Solution:** Check your internet connection and bot token in config.py

## Features Added

- ✅ Automatic conflict detection
- ✅ Retry mechanism for failed startups
- ✅ Comprehensive error logging
- ✅ Graceful shutdown handling
- ✅ Bot management utility
- ✅ Process monitoring
- ✅ Safe restart functionality

## Best Practices

1. Use `bot_manager.py start` instead of running `python streetshop.py` directly
2. Always stop the bot properly with `bot_manager.py stop`
3. Check bot status with `bot_manager.py status` if unsure
4. Wait a few seconds between stop and start operations
5. Monitor the console output for any error messages

Your bot should now run without the "Terminated by other getupdates request" error!