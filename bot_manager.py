#!/usr/bin/env python3
"""
Bot Manager - Utility for managing the Telegram bot instances
Helps prevent conflicts and provides safe start/stop operations
"""

import os
import sys
import time
import subprocess
import signal
from pathlib import Path

def find_python_processes():
    """Find all Python processes running the bot"""
    try:
        if os.name == 'nt':  # Windows
            result = subprocess.run([
                'wmic', 'process', 'where', 'name="python.exe"',
                'get', 'ProcessId,CommandLine'
            ], capture_output=True, text=True)
            
            processes = []
            lines = result.stdout.strip().split('\n')[1:]  # Skip header
            
            for line in lines:
                line = line.strip()
                if 'streetshop.py' in line and line:
                    # Extract PID from the end of the line
                    parts = line.split()
                    if parts:
                        try:
                            pid = int(parts[-1])
                            processes.append(pid)
                        except ValueError:
                            continue
            
            return processes
        else:  # Unix-like
            result = subprocess.run([
                'pgrep', '-f', 'streetshop.py'
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                return [int(pid) for pid in result.stdout.strip().split('\n') if pid]
            return []
            
    except Exception as e:
        print(f"Error finding processes: {e}")
        return []

def kill_bot_processes():
    """Kill all running bot instances"""
    processes = find_python_processes()
    
    if not processes:
        print("✅ No running bot instances found")
        return True
    
    print(f"🔍 Found {len(processes)} running bot instance(s)")
    
    killed_count = 0
    for pid in processes:
        try:
            if os.name == 'nt':  # Windows
                subprocess.run(['taskkill', '/f', '/pid', str(pid)], 
                             capture_output=True)
            else:  # Unix-like
                os.kill(pid, signal.SIGTERM)
                time.sleep(1)
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass  # Process already dead
            
            print(f"✅ Killed process {pid}")
            killed_count += 1
            
        except Exception as e:
            print(f"❌ Failed to kill process {pid}: {e}")
    
    # Wait a bit and verify
    time.sleep(2)
    remaining = find_python_processes()
    
    if remaining:
        print(f"⚠️ {len(remaining)} process(es) still running: {remaining}")
        return False
    else:
        print(f"✅ Successfully killed {killed_count} bot instance(s)")
        return True

def start_bot():
    """Start the bot safely"""
    print("🔍 Checking for existing bot instances...")
    
    # First, kill any existing instances
    if not kill_bot_processes():
        print("❌ Failed to stop all existing instances")
        return False
    
    print("🚀 Starting bot...")
    
    try:
        # Start the bot
        if os.name == 'nt':  # Windows
            subprocess.Popen([sys.executable, 'streetshop.py'], 
                           cwd=os.getcwd())
        else:  # Unix-like
            subprocess.Popen([sys.executable, 'streetshop.py'], 
                           cwd=os.getcwd())
        
        print("✅ Bot started successfully!")
        print("📝 Use 'python bot_manager.py stop' to stop the bot")
        return True
        
    except Exception as e:
        print(f"❌ Failed to start bot: {e}")
        return False

def stop_bot():
    """Stop all bot instances"""
    print("🛑 Stopping bot...")
    return kill_bot_processes()

def status_bot():
    """Show bot status"""
    processes = find_python_processes()
    
    if not processes:
        print("❌ Bot is not running")
    else:
        print(f"✅ Bot is running ({len(processes)} instance(s))")
        for pid in processes:
            print(f"   - Process ID: {pid}")

def restart_bot():
    """Restart the bot"""
    print("🔄 Restarting bot...")
    stop_bot()
    time.sleep(3)
    return start_bot()

def show_help():
    """Show help message"""
    print("""
Bot Manager - Telegram Bot Management Utility

Usage:
    python bot_manager.py [command]

Commands:
    start    - Start the bot (kills existing instances first)
    stop     - Stop all bot instances
    restart  - Restart the bot
    status   - Show bot status
    help     - Show this help message

Examples:
    python bot_manager.py start
    python bot_manager.py stop
    python bot_manager.py status
    python bot_manager.py restart

Note: This utility helps prevent the "Terminated by other getupdates request" error
by ensuring only one bot instance runs at a time.
""")

def main():
    """Main function"""
    if len(sys.argv) < 2:
        command = "help"
    else:
        command = sys.argv[1].lower()
    
    print("🤖 Telegram Bot Manager")
    print("=" * 50)
    
    if command == "start":
        start_bot()
    elif command == "stop":
        stop_bot()
    elif command == "restart":
        restart_bot()
    elif command == "status":
        status_bot()
    elif command == "help":
        show_help()
    else:
        print(f"❌ Unknown command: {command}")
        show_help()

if __name__ == "__main__":
    main()