# database.py
import asyncio
import random
import string

import aiosqlite
from datetime import datetime

from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from config import cfg
from models import db_lock, bot  # Импортируем из models.py

class Database:
    def __init__(self):
        self.conn = None
        self.db_path = "database.db"

    @staticmethod
    async def check_expired_payments():
        while True:
            try:
                # Получаем глобальный экземпляр базы данных
                from database import db
                async with db_lock:
                    cursor = await db.conn.execute('''
                        SELECT code, user_id, strftime('%Y-%m-%d %H:%M:%S', expires_at) as expires_at 
                        FROM payments 
                        WHERE status = 'pending' AND expires_at IS NOT NULL
                    ''')
                    payments = await cursor.fetchall()

                now = datetime.now()
                for payment in payments:
                    if not payment[2]:  # Пропускаем если expires_at NULL
                        continue

                    try:
                        expires_at = datetime.strptime(payment[2], "%Y-%m-%d %H:%M:%S")
                    except (ValueError, TypeError):
                        continue  # Пропускаем если неверный формат даты
                    if now > expires_at:
                        async with db_lock:
                            cursor = await db.conn.execute('''
                                SELECT status FROM payments WHERE code = ?
                            ''', (payment[0],))
                            current_status = await cursor.fetchone()

                            if current_status and current_status[0] == 'pending':
                                await db.conn.execute('''
                                    UPDATE payments SET status = 'expired' WHERE code = ?
                                ''', (payment[0],))
                                await db.conn.commit()

                                try:
                                    keyboard = InlineKeyboardMarkup(row_width=1)
                                    keyboard.add(
                                        InlineKeyboardButton(
                                            "↩️ Вернуться к пополнению",
                                            callback_data="back_to_payment"
                                        ),
                                        InlineKeyboardButton(
                                            "💬 Написать в поддержку",
                                            url=f"https://t.me/{cfg.SUPPORT_ID}"
                                        ),
                                        InlineKeyboardButton(
                                            "🤖 Поддержка по СПАМу",
                                            url="https://t.me/SuppPayBot"
                                        )
                                    )

                                    await bot.send_message(
                                        chat_id=payment[1],
                                        text=cfg.PAYMENT_EXPIRED_TEXT.format(code=payment[0]),
                                        reply_markup=keyboard,
                                        parse_mode="HTML"
                                    )
                                except Exception as e:
                                    print(f"Ошибка при отправке уведомления об истечении платежа: {e}")
            except Exception as e:
                print(f"Ошибка при проверке истекших платежей: {e}")

            await asyncio.sleep(60)

    async def ensure_user_exists(self, user_id: int, username: str = None) -> bool:
        """Создает пользователя если не существует"""
        try:
            # Сначала проверяем существование
            cursor = await self.conn.execute(
                "SELECT 1 FROM users WHERE user_id = ?",
                (user_id,)
            )
            exists = await cursor.fetchone()

            if not exists:
                # Создаем нового пользователя
                await self.conn.execute('''
                    INSERT INTO users 
                    (user_id, username, registration_date, balance)
                    VALUES (?, ?, datetime('now'), 0)
                ''', (user_id, username))
                await self.conn.commit()
                return True
            return False

        except Exception as e:
            print(f"Ошибка создания пользователя: {e}")
            await self.conn.rollback()
            return False

    async def get_user_registration_date(self, user_id: int):
        """Получает дату регистрации пользователя"""
        cursor = await self.conn.execute('''
            SELECT registration_date FROM users WHERE user_id = ?
        ''', (user_id,))
        result = await cursor.fetchone()
        if result and result[0]:
            return datetime.strptime(result[0], "%Y-%m-%d %H:%M:%S")
        return None

    async def update_user_balance(self, user_id: int, amount: int):
        """Обновляет баланс пользователя"""
        await self.conn.execute('''
            UPDATE users 
            SET balance = balance + ? 
            WHERE user_id = ?
        ''', (amount, user_id))
        await self.conn.commit()

    async def get_user_balance(self, user_id: int):
        """Получает баланс пользователя"""
        cursor = await self.conn.execute('''
            SELECT balance FROM users WHERE user_id = ?
        ''', (user_id,))
        result = await cursor.fetchone()
        return result[0] if result else 0

    async def update_payment_expire_time(self, code: str, expires_at: str):
        """Обновляем время истечения платежа"""
        await self.conn.execute('''
            UPDATE payments 
            SET expires_at = ?
            WHERE code = ?
        ''', (expires_at, code))
        await self.conn.commit()

    async def update_payment_method(self, code: str, method: str):
        """Обновляем метод оплаты"""
        await self.conn.execute('''
            UPDATE payments 
            SET method = ?
            WHERE code = ?
        ''', (method, code))
        await self.conn.commit()

    async def connect(self):
        """Устанавливаем соединение с SQLite"""
        self.conn = await aiosqlite.connect(self.db_path)
        await self._create_tables()
        await self.update_database_structure()  # Добавляем недостающие колонки в существующие таблицы
        await self.init_default_payment_details()  # Инициализируем дефолтные реквизиты
        await self.init_default_bot_settings()  # Инициализируем дефолтные настройки бота
        await self.init_default_payment_methods()  # Инициализируем дефолтные методы оплаты
        await self.init_default_button_names()  # Инициализируем дефолтные названия кнопок

    async def _create_tables(self):
        """Создаем таблицы если их нет"""
        # Таблица пользователей
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                username TEXT,
                registration_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                balance INTEGER DEFAULT 0,
                partner_balance INTEGER DEFAULT 0,
                purchases INTEGER DEFAULT 0,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Таблица платежей (обновленная версия)
        await self.conn.execute('''
                CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id BIGINT NOT NULL,
                    amount INTEGER NOT NULL,
                    code TEXT NOT NULL UNIQUE,
                    status TEXT DEFAULT 'pending',
                    method TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    completed_at TIMESTAMP,  
                    FOREIGN KEY (user_id) REFERENCES users(user_id)
                )
            ''')

        # Таблица для хранения токенов
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS api_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_name TEXT NOT NULL UNIQUE,
                token_value TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Таблица для хранения промокодов
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS promo_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                discount INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Таблица обращений в поддержку
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id BIGINT NOT NULL,
                topic TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                reply TEXT,
                operator_id BIGINT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        # Таблица транзакций (история операций с балансом)
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id BIGINT NOT NULL,
                amount INTEGER NOT NULL,
                operation_type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'payment', etc.
                description TEXT,
                payment_id INTEGER,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (payment_id) REFERENCES payments(id)
            )
        ''')

        # Создаем индексы для ускорения запросов
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)
        ''')
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_payments_code ON payments(code)
        ''')
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)
        ''')
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id)
        ''')
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)
        ''')
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)
        ''')

        # Таблица для хранения реквизитов оплаты
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS payment_details (
                method TEXT PRIMARY KEY,
                details TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Таблица для хранения настроек бота
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS bot_settings (
                setting_name TEXT PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Таблица для хранения статуса методов оплаты (включены/отключены)
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS payment_methods (
                method_id TEXT PRIMARY KEY,
                method_name TEXT NOT NULL,
                is_enabled BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Таблица для хранения расположения методов оплаты
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS payment_method_layout (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                method_id TEXT NOT NULL,
                row_number INTEGER NOT NULL,
                position_in_row INTEGER NOT NULL,
                FOREIGN KEY (method_id) REFERENCES payment_methods(method_id)
            )
        ''')

        # Таблица для хранения названий кнопок главного меню
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS button_names (
                button_key TEXT PRIMARY KEY,
                button_name TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Таблица для элементов каталога (темы, категории, подкатегории, товары)
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS catalog_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_id INTEGER DEFAULT NULL, -- Для построения иерархии (id родительского элемента)
                type TEXT NOT NULL, -- 'theme', 'category', 'subcategory', 'product'
                name TEXT NOT NULL, -- Человекочитаемое название (для админа)
                sticker_id TEXT,
                photo_id TEXT,
                description TEXT,
                preview_link TEXT, -- Ссылка, вставляемая невидимо в начало описания
                position INTEGER DEFAULT 0, -- Порядок сортировки
                row_width INTEGER DEFAULT 1, -- Ширина ряда кнопки (1 или 2)
                is_grid_3x6 BOOLEAN DEFAULT FALSE, -- Использует ли элемент сетку 3x6
                search_button_name TEXT, -- Название кнопки поиска (например "🔎найти страну")
                back_button_text TEXT, -- Текст для кнопки "назад" (например "к выбору VPN")
                is_visible BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES catalog_items (id)
            )
        ''')

        # Таблица для цен товаров
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS product_prices (
                product_id INTEGER PRIMARY KEY,
                price INTEGER NOT NULL, -- Цена в копейках/центах
                currency TEXT DEFAULT 'RUB',
                expiration_days TEXT, -- Дни действия в формате "30,60,90" (может быть NULL)
                FOREIGN KEY (product_id) REFERENCES catalog_items(id)
            )
        ''')

        # Таблица для файлов товаров (поддержка множественных файлов)
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS product_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                file_id TEXT NOT NULL,
                file_type TEXT NOT NULL, -- 'document', 'photo', etc.
                file_name TEXT,
                position INTEGER DEFAULT 0, -- Порядок файлов
                day_period INTEGER DEFAULT NULL, -- Период действия в днях (30, 60, 90 и т.д.)
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES catalog_items(id)
            )
        ''')
        
        # Добавляем колонку day_period если её нет (для существующих баз данных)
        try:
            await self.conn.execute('''
                ALTER TABLE product_files ADD COLUMN day_period INTEGER DEFAULT NULL
            ''')
            await self.conn.commit()
        except Exception:
            # Колонка уже существует
            pass

        # Таблица для заказов товаров
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id BIGINT NOT NULL,
                product_id INTEGER NOT NULL,
                code TEXT NOT NULL UNIQUE,
                quantity INTEGER DEFAULT 1,
                price INTEGER NOT NULL, -- Цена на момент заказа в копейках
                selected_days INTEGER, -- Количество дней действия (для товаров с ограниченным сроком)
                status TEXT DEFAULT 'pending', -- pending, paid, completed, cancelled
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                expiration_notified BOOLEAN DEFAULT FALSE, -- Флаг отправки уведомления об истечении
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (product_id) REFERENCES catalog_items(id)
            )
        ''')

        # Миграция: добавляем колонку expiration_days если её нет
        try:
            await self.conn.execute('''
                ALTER TABLE product_prices ADD COLUMN expiration_days TEXT
            ''')
            await self.conn.commit()
        except Exception:
            # Колонка уже существует или другая ошибка - игнорируем
            pass
        
        # Миграция: добавляем колонку selected_days в orders если её нет
        try:
            await self.conn.execute('''
                ALTER TABLE orders ADD COLUMN selected_days INTEGER
            ''')
            await self.conn.commit()
        except Exception:
            # Колонка уже существует или другая ошибка - игнорируем
            pass
            
        # Миграция: добавляем колонку expiration_notified в orders если её нет
        try:
            await self.conn.execute('''
                ALTER TABLE orders ADD COLUMN expiration_notified BOOLEAN DEFAULT FALSE
            ''')
            await self.conn.commit()
        except Exception:
            # Колонка уже существует или другая ошибка - игнорируем
            pass

        # Индексы для каталога
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_catalog_parent_id ON catalog_items(parent_id)
        ''')
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_product_files_product_id ON product_files(product_id)
        ''')
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_catalog_type ON catalog_items(type)
        ''')
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_catalog_position ON catalog_items(position)
        ''')

        # Индексы для заказов
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)
        ''')
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(code)
        ''')
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
        ''')

        # Таблица для администраторов
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS admins (
                user_id BIGINT PRIMARY KEY,
                username TEXT,
                added_by BIGINT,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (added_by) REFERENCES users(user_id)
            )
        ''')
        
        # Индекс для быстрого поиска администраторов
        await self.conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id)
        ''')

        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS promo_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                discount INTEGER NOT NULL
            )
        ''')

        # Создаем таблицы для промокодов товаров
        await self.create_product_promo_tables()
        
        # Создаем таблицы для системы бонусов
        await self.create_bonus_system_tables()

        await self.conn.commit()

    async def update_database_structure(self):
        """Добавляет недостающие колонки в существующие таблицы"""
        try:
            # Проверяем существование колонки в payments
            cursor = await self.conn.execute("PRAGMA table_info(payments)")
            columns = await cursor.fetchall()
            column_names = [col[1] for col in columns]

            if 'completed_at' not in column_names:
                await self.conn.execute('ALTER TABLE payments ADD COLUMN completed_at TIMESTAMP')
                await self.conn.commit()
                print("База данных успешно обновлена")
            
            # Добавляем поля для CryptoBot
            if 'invoice_id' not in column_names:
                await self.conn.execute('ALTER TABLE payments ADD COLUMN invoice_id TEXT')
                print("Добавлена колонка invoice_id")
            
            if 'crypto_asset' not in column_names:
                await self.conn.execute('ALTER TABLE payments ADD COLUMN crypto_asset TEXT')
                print("Добавлена колонка crypto_asset")
                
            if 'crypto_amount' not in column_names:
                await self.conn.execute('ALTER TABLE payments ADD COLUMN crypto_amount REAL')
                print("Добавлена колонка crypto_amount")
            
            # Добавляем поля для BitPAPA
            if 'bitpapa_payment_id' not in column_names:
                await self.conn.execute('ALTER TABLE payments ADD COLUMN bitpapa_payment_id TEXT')
                print("Добавлена колонка bitpapa_payment_id")
            
            if 'bitpapa_payment_url' not in column_names:
                await self.conn.execute('ALTER TABLE payments ADD COLUMN bitpapa_payment_url TEXT')
                print("Добавлена колонка bitpapa_payment_url")
                
            if 'bitpapa_status' not in column_names:
                await self.conn.execute('ALTER TABLE payments ADD COLUMN bitpapa_status TEXT')
                print("Добавлена колонка bitpapa_status")
            
            # Проверяем существование файловых колонок в catalog_items
            cursor = await self.conn.execute("PRAGMA table_info(catalog_items)")
            columns = await cursor.fetchall()
            catalog_column_names = [col[1] for col in columns]
            
            # Добавляем колонки для файлов если их нет
            if 'file_id' not in catalog_column_names:
                await self.conn.execute('ALTER TABLE catalog_items ADD COLUMN file_id TEXT')
                print("Добавлена колонка file_id")
            
            if 'file_type' not in catalog_column_names:
                await self.conn.execute('ALTER TABLE catalog_items ADD COLUMN file_type TEXT')
                print("Добавлена колонка file_type")
            
            if 'file_name' not in catalog_column_names:
                await self.conn.execute('ALTER TABLE catalog_items ADD COLUMN file_name TEXT')
                print("Добавлена колонка file_name")
            
            # Добавляем колонки для 3x6 сетки если их нет
            if 'is_grid_3x6' not in catalog_column_names:
                await self.conn.execute('ALTER TABLE catalog_items ADD COLUMN is_grid_3x6 BOOLEAN DEFAULT FALSE')
                print("Добавлена колонка is_grid_3x6")
            
            if 'search_button_name' not in catalog_column_names:
                await self.conn.execute('ALTER TABLE catalog_items ADD COLUMN search_button_name TEXT')
                print("Добавлена колонка search_button_name")
            
            if 'back_button_text' not in catalog_column_names:
                await self.conn.execute('ALTER TABLE catalog_items ADD COLUMN back_button_text TEXT')
                print("Добавлена колонка back_button_text")
                
            # Проверяем существование колонок в orders
            cursor = await self.conn.execute("PRAGMA table_info(orders)")
            orders_columns = await cursor.fetchall()
            orders_column_names = [col[1] for col in orders_columns]
            
            if 'payment_method' not in orders_column_names:
                await self.conn.execute('ALTER TABLE orders ADD COLUMN payment_method TEXT')
                print("Добавлена колонка payment_method в orders")
            
            if 'invoice_id' not in orders_column_names:
                await self.conn.execute('ALTER TABLE orders ADD COLUMN invoice_id TEXT')
                print("Добавлена колонка invoice_id в orders")
            
            await self.conn.commit()
            
        except Exception as e:
            print(f"Ошибка при обновлении БД: {e}")

    async def create_payment(self, user_id: int, amount: int, code: str, expires_at: str = None):
        """Создаем новую платежную запись с проверкой уникальности кода"""
        try:
            # Проверяем, существует ли уже такой код
            cursor = await self.conn.execute('''
                SELECT 1 FROM payments WHERE code = ?
            ''', (code,))
            exists = await cursor.fetchone()

            if exists:
                raise ValueError("Код платежа уже существует")

            if expires_at is None:
                cursor = await self.conn.execute('''
                   INSERT INTO payments (user_id, amount, code)
                   VALUES (?, ?, ?)
                   RETURNING id
                ''', (user_id, amount, code))
            else:
                cursor = await self.conn.execute('''
                   INSERT INTO payments (user_id, amount, code, expires_at)
                   VALUES (?, ?, ?, ?)
                   RETURNING id
                ''', (user_id, amount, code, expires_at))

            row = await cursor.fetchone()
            await self.conn.commit()
            return row[0] if row else None
        except Exception as e:
            await self.conn.rollback()
            raise e

    # Обновленный метод get_payment
    async def get_payment(self, code: str):
        cursor = await self.conn.execute('''
            SELECT id, user_id, amount, code, status, method, 
                   strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at,
                   CASE WHEN expires_at IS NOT NULL 
                        THEN strftime('%Y-%m-%d %H:%M:%S', expires_at) 
                        ELSE NULL END as expires_at
            FROM payments 
            WHERE code = ?
        ''', (code,))
        return await cursor.fetchone()

    async def cancel_payment(self, code: str):
        """Отменяем платеж"""
        await self.conn.execute('''
           UPDATE payments 
           SET status = 'canceled'
           WHERE code = ?
           ''', (code,))
        await self.conn.commit()

    async def create_ticket(self, user_id, topic, message):
        """Создаем новое обращение"""
        cursor = await self.conn.execute('''
        INSERT INTO tickets (user_id, topic, message, created_at)
        VALUES (?, ?, ?, datetime('now'))
        RETURNING id
        ''', (user_id, topic, message))

        row = await cursor.fetchone()
        await self.conn.commit()
        return row[0] if row else None

    async def get_user_tickets(self, user_id):
        """Получаем все обращения пользователя"""
        cursor = await self.conn.execute('''
        SELECT id, topic, message, status, reply, 
               strftime('%d.%m.%Y %H:%M', created_at) as created_at
        FROM tickets 
        WHERE user_id = ?
        ORDER BY created_at DESC
        ''', (user_id,))

        return await cursor.fetchall()

    async def get_user_info(self, user_id):
        """Получаем информацию о пользователе"""
        cursor = await self.conn.execute('''
        SELECT username FROM users WHERE user_id = ?
        ''', (user_id,))
        return await cursor.fetchone()

    async def get_ticket(self, ticket_id, user_id=None):
        """Получаем конкретное обращение"""
        query = '''
        SELECT id, user_id, topic, message, status, reply, 
               strftime('%d.%m.%Y %H:%M', created_at) as created_at,
               strftime('%d.%m.%Y %H:%M', updated_at) as updated_at
        FROM tickets 
        WHERE id = ?
        '''
        params = [ticket_id]

        if user_id:
            query += ' AND user_id = ?'
            params.append(user_id)

        cursor = await self.conn.execute(query, params)
        return await cursor.fetchone()

    async def update_ticket(self, ticket_id, reply_text, operator_name):
        """Обновляем обращение при ответе"""
        full_reply = f"👤 Оператор: {operator_name}\n💬 Ответ:\n{reply_text}"
        await self.conn.execute('''
        UPDATE tickets 
        SET reply = ?, status = 'Отвечен', updated_at = datetime('now')
        WHERE id = ?
        ''', (full_reply, ticket_id))
        await self.conn.commit()

    # Методы для работы с каталогом
    async def get_catalog_themes(self):
        """Получает все темы (элементы верхнего уровня)"""
        cursor = await self.conn.execute('''
            SELECT id, type, name, description, sticker_id, photo_id, preview_link, row_width, position, is_grid_3x6
            FROM catalog_items 
            WHERE parent_id IS NULL AND type = 'theme' AND is_visible = TRUE
            ORDER BY position ASC, id ASC
        ''')
        return await cursor.fetchall()

    async def get_catalog_children(self, parent_id: int):
        """Получает дочерние элементы каталога"""
        cursor = await self.conn.execute('''
            SELECT id, type, name, description, sticker_id, photo_id, preview_link, row_width, position, is_grid_3x6
            FROM catalog_items 
            WHERE parent_id = ? AND is_visible = TRUE
            ORDER BY position ASC, id ASC
        ''', (parent_id,))
        return await cursor.fetchall()

    async def get_catalog_item(self, item_id: int):
        """Получает элемент каталога по ID"""
        cursor = await self.conn.execute('''
            SELECT id, parent_id, type, name, description, sticker_id, photo_id, preview_link, row_width, position, 
                   file_id, file_type, file_name, is_grid_3x6, search_button_name, back_button_text
            FROM catalog_items 
            WHERE id = ?
        ''', (item_id,))
        return await cursor.fetchone()

    async def get_product_price(self, product_id: int):
        """Получает цену товара"""
        cursor = await self.conn.execute('''
            SELECT price, currency
            FROM product_prices 
            WHERE product_id = ?
        ''', (product_id,))
        return await cursor.fetchone()

    async def add_catalog_item(self, parent_id: int = None, item_type: str = None, 
                              name: str = None, description: str = None,
                              sticker_id: str = None, photo_id: str = None, 
                              preview_link: str = None, 
                              row_width: int = 1, position: int = 0,
                              is_grid_3x6: bool = False, search_button_name: str = None,
                              back_button_text: str = None):
        """Добавляет новый элемент каталога"""
        cursor = await self.conn.execute('''
            INSERT INTO catalog_items (parent_id, type, name, description, sticker_id, photo_id, preview_link, 
                                     row_width, position, is_grid_3x6, search_button_name, back_button_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        ''', (parent_id, item_type, name, description, sticker_id, photo_id, preview_link, 
              row_width, position, is_grid_3x6, search_button_name, back_button_text))
        
        row = await cursor.fetchone()
        await self.conn.commit()
        return row[0] if row else None

    async def add_product_price(self, product_id: int, price: int, currency: str = 'RUB', expiration_days: str = None):
        """Добавляет цену для товара с возможными днями действия"""
        await self.conn.execute('''
            INSERT OR REPLACE INTO product_prices (product_id, price, currency, expiration_days)
            VALUES (?, ?, ?, ?)
        ''', (product_id, price, currency, expiration_days))
        await self.conn.commit()

    async def set_product_price(self, product_id: int, price: int, currency: str = 'RUB', expiration_days: str = None):
        """Устанавливает/обновляет цену товара (обертка над add_product_price)"""
        await self.add_product_price(product_id, price, currency, expiration_days)

    async def get_product_price_with_days(self, product_id: int):
        """Получает цену и дни действия для товара"""
        cursor = await self.conn.execute('''
            SELECT price, currency, expiration_days FROM product_prices WHERE product_id = ?
        ''', (product_id,))
        return await cursor.fetchone()

    async def add_product_file(self, product_id: int, file_id: str, file_type: str, file_name: str = None, day_period: int = None):
        """Добавляет файл к товару"""
        # Получаем следующую позицию для файла
        cursor = await self.conn.execute('''
            SELECT COALESCE(MAX(position), -1) + 1 FROM product_files WHERE product_id = ?
        ''', (product_id,))
        position = (await cursor.fetchone())[0]
        
        await self.conn.execute('''
            INSERT INTO product_files (product_id, file_id, file_type, file_name, position, day_period)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (product_id, file_id, file_type, file_name, position, day_period))
        await self.conn.commit()

    async def get_product_files(self, product_id: int, day_period: int = None):
        """Получает все файлы товара или файлы для определенного периода дней"""
        if day_period is not None:
            cursor = await self.conn.execute('''
                SELECT id, file_id, file_type, file_name, position, day_period
                FROM product_files 
                WHERE product_id = ? AND day_period = ?
                ORDER BY position
            ''', (product_id, day_period))
        else:
            cursor = await self.conn.execute('''
                SELECT id, file_id, file_type, file_name, position, day_period
                FROM product_files 
                WHERE product_id = ?
                ORDER BY position
            ''', (product_id,))
        return await cursor.fetchall()

    async def update_product_name(self, product_id: int, name: str):
        """Обновляет название товара"""
        await self.conn.execute('''
            UPDATE catalog_items SET name = ? WHERE id = ?
        ''', (name, product_id))
        await self.conn.commit()

    async def update_product_description(self, product_id: int, description: str):
        """Обновляет описание товара"""
        await self.conn.execute('''
            UPDATE catalog_items SET description = ? WHERE id = ?
        ''', (description, product_id))
        await self.conn.commit()

    async def update_product_preview_link(self, product_id: int, preview_link: str):
        """Обновляет превью‑ссылку товара"""
        await self.conn.execute('''
            UPDATE catalog_items SET preview_link = ? WHERE id = ?
        ''', (preview_link, product_id))
        await self.conn.commit()

    async def update_product_photo_id(self, product_id: int, photo_id: str):
        """Обновляет photo_id товара"""
        await self.conn.execute('''
            UPDATE catalog_items SET photo_id = ? WHERE id = ?
        ''', (photo_id, product_id))
        await self.conn.commit()

    async def update_product_row_width(self, product_id: int, row_width: int):
        """Обновляет выравнивание товара (row_width)"""
        await self.conn.execute('''
            UPDATE catalog_items SET row_width = ? WHERE id = ?
        ''', (row_width, product_id))
        await self.conn.commit()

    # Методы для обновления элементов каталога (категорий, тем, подкатегорий)
    async def update_catalog_item_name(self, item_id: int, name: str):
        """Обновляет название элемента каталога"""
        await self.conn.execute('''
            UPDATE catalog_items SET name = ? WHERE id = ?
        ''', (name, item_id))
        await self.conn.commit()

    async def update_catalog_item_description(self, item_id: int, description: str):
        """Обновляет описание элемента каталога"""
        await self.conn.execute('''
            UPDATE catalog_items SET description = ? WHERE id = ?
        ''', (description, item_id))
        await self.conn.commit()

    async def update_catalog_item_sticker_id(self, item_id: int, sticker_id: str):
        """Обновляет sticker_id элемента каталога"""
        await self.conn.execute('''
            UPDATE catalog_items SET sticker_id = ? WHERE id = ?
        ''', (sticker_id, item_id))
        await self.conn.commit()

    async def update_catalog_item_photo_id(self, item_id: int, photo_id: str):
        """Обновляет photo_id элемента каталога"""
        await self.conn.execute('''
            UPDATE catalog_items SET photo_id = ? WHERE id = ?
        ''', (photo_id, item_id))
        await self.conn.commit()

    async def update_catalog_item_preview_link(self, item_id: int, preview_link: str):
        """Обновляет preview_link элемента каталога"""
        await self.conn.execute('''
            UPDATE catalog_items SET preview_link = ? WHERE id = ?
        ''', (preview_link, item_id))
        await self.conn.commit()

    async def update_catalog_item_row_width(self, item_id: int, row_width: int):
        """Обновляет row_width элемента каталога"""
        await self.conn.execute('''
            UPDATE catalog_items SET row_width = ? WHERE id = ?
        ''', (row_width, item_id))
        await self.conn.commit()

    async def delete_product(self, product_id: int):
        """Удаляет товар и связанные данные"""
        try:
            await self.conn.execute('DELETE FROM product_files WHERE product_id = ?', (product_id,))
            await self.conn.execute('DELETE FROM product_prices WHERE product_id = ?', (product_id,))
            await self.conn.execute('DELETE FROM catalog_items WHERE id = ?', (product_id,))
            await self.conn.commit()
            return True
        except Exception as e:
            await self.conn.rollback()
            print(f"Ошибка удаления товара {product_id}: {e}")
            return False

    async def delete_catalog_item(self, item_id: int):
        """Удаляет элемент каталога (тему, категорию, подкатегорию)"""
        try:
            # Получаем тип элемента
            cursor = await self.conn.execute('SELECT type FROM catalog_items WHERE id = ?', (item_id,))
            item_data = await cursor.fetchone()
            if not item_data:
                return False
                
            item_type = item_data[0]
            
            # Если это товар, удаляем связанные данные
            if item_type == 'product':
                await self.conn.execute('DELETE FROM product_files WHERE product_id = ?', (item_id,))
                await self.conn.execute('DELETE FROM product_prices WHERE product_id = ?', (item_id,))
            
            # Удаляем сам элемент
            await self.conn.execute('DELETE FROM catalog_items WHERE id = ?', (item_id,))
            await self.conn.commit()
            return True
        except Exception as e:
            await self.conn.rollback()
            print(f"Ошибка удаления элемента каталога {item_id}: {e}")
            return False

    async def get_product_files_count(self, product_id: int):
        """Получает количество файлов у товара"""
        cursor = await self.conn.execute('''
            SELECT COUNT(*) FROM product_files WHERE product_id = ?
        ''', (product_id,))
        result = await cursor.fetchone()
        return result[0] if result else 0

    async def get_product_files_count_by_days(self, product_id: int, day_period: int):
        """Получает количество файлов у товара для определенного периода дней"""
        cursor = await self.conn.execute('''
            SELECT COUNT(*) FROM product_files WHERE product_id = ? AND day_period = ?
        ''', (product_id, day_period))
        result = await cursor.fetchone()
        return result[0] if result else 0

    async def delete_product_file(self, file_id: int):
        """Удаляет файл товара"""
        await self.conn.execute('''
            DELETE FROM product_files WHERE id = ?
        ''', (file_id,))
        await self.conn.commit()

    async def get_catalog_parent_path(self, item_id: int):
        """Получает путь к родительскому элементу (для кнопки 'Назад')"""
        cursor = await self.conn.execute('''
            SELECT parent_id FROM catalog_items WHERE id = ?
        ''', (item_id,))
        result = await cursor.fetchone()
        return result[0] if result else None

    # Методы для работы с заказами
    async def create_order(self, user_id: int, product_id: int, code: str, price: int, quantity: int = 1, expires_at: str = None, selected_days: int = None):
        """Создает новый заказ"""
        try:
            cursor = await self.conn.execute('''
                INSERT INTO orders (user_id, product_id, code, price, quantity, expires_at, selected_days)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id
            ''', (user_id, product_id, code, price, quantity, expires_at, selected_days))
            
            row = await cursor.fetchone()
            await self.conn.commit()
            return row[0] if row else None
        except Exception as e:
            await self.conn.rollback()
            raise e

    async def get_order(self, code: str):
        """Получает заказ по коду"""
        cursor = await self.conn.execute('''
            SELECT o.id, o.user_id, o.product_id, o.code, o.quantity, o.price, o.status,
                   strftime('%Y-%m-%d %H:%M:%S', o.expires_at) as expires_at,
                   strftime('%Y-%m-%d %H:%M:%S', o.created_at) as created_at,
                   c.name as product_name, o.selected_days, o.payment_method
            FROM orders o
            JOIN catalog_items c ON o.product_id = c.id
            WHERE o.code = ?
        ''', (code,))
        return await cursor.fetchone()

    async def get_product_category_path(self, product_id: int):
        """Получает путь категорий для товара"""
        cursor = await self.conn.execute('''
            WITH RECURSIVE category_path(id, name, parent_id, level) AS (
                SELECT id, name, parent_id, 0
                FROM catalog_items 
                WHERE id = ?
                
                UNION ALL
                
                SELECT c.id, c.name, c.parent_id, cp.level + 1
                FROM catalog_items c
                JOIN category_path cp ON c.id = cp.parent_id
            )
            SELECT name FROM category_path 
            WHERE parent_id IS NOT NULL
            ORDER BY level DESC
            LIMIT 1
        ''', (product_id,))
        result = await cursor.fetchone()
        return result[0] if result else "Неизвестная категория"
    
    async def get_product_category_with_type(self, product_id: int):
        """Получает категорию товара с её типом (тема/категория)"""
        cursor = await self.conn.execute('''
            WITH RECURSIVE category_path(id, name, parent_id, level, type) AS (
                -- Начинаем с родителя продукта, а не с самого продукта
                SELECT p.id, p.name, p.parent_id, 0, p.type
                FROM catalog_items product
                JOIN catalog_items p ON product.parent_id = p.id
                WHERE product.id = ?
                
                UNION ALL
                
                SELECT c.id, c.name, c.parent_id, cp.level + 1, c.type
                FROM catalog_items c
                JOIN category_path cp ON c.id = cp.parent_id
            )
            SELECT name, type FROM category_path 
            ORDER BY level ASC
            LIMIT 1
        ''', (product_id,))
        result = await cursor.fetchone()
        if result:
            name, category_type = result
            # Always use "💼 Категория:" prefix regardless of whether it's from theme or category
            return f"💼 Категория: {name}"
        return "💼 Категория: Неизвестная категория"

    async def update_order_status(self, code: str, status: str):
        """Обновляет статус заказа"""
        await self.conn.execute('''
            UPDATE orders 
            SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END
            WHERE code = ?
        ''', (status, status, code))
        await self.conn.commit()

    async def cancel_order(self, code: str):
        """Отменяет заказ"""
        await self.update_order_status(code, 'cancelled')
    
    async def restore_order(self, code: str):
        """Восстанавливает отмененный заказ"""
        await self.update_order_status(code, 'pending')

    async def update_order_payment_method(self, code: str, method: str):
        """Обновляет метод оплаты заказа"""
        await self.conn.execute('''
            UPDATE orders 
            SET payment_method = ?
            WHERE code = ?
        ''', (method, code))
        await self.conn.commit()

    async def set_order_invoice_id(self, code: str, invoice_id: str):
        """Устанавливает invoice_id для заказа"""
        await self.conn.execute('''
            UPDATE orders 
            SET invoice_id = ?
            WHERE code = ?
        ''', (invoice_id, code))
        await self.conn.commit()

    # Методы для работы с реквизитами оплаты
    async def get_payment_details(self, method: str):
        """Получает реквизиты для определенного метода оплаты"""
        cursor = await self.conn.execute(
            "SELECT details FROM payment_details WHERE method = ?",
            (method,)
        )
        result = await cursor.fetchone()
        return result[0] if result else None

    async def set_payment_details(self, method: str, details: str):
        """Устанавливает реквизиты для метода оплаты"""
        await self.conn.execute('''
            INSERT OR REPLACE INTO payment_details (method, details, updated_at)
            VALUES (?, ?, datetime('now'))
        ''', (method, details))
        await self.conn.commit()

    async def get_all_payment_details(self):
        """Получает все реквизиты оплаты"""
        cursor = await self.conn.execute(
            "SELECT method, details FROM payment_details"
        )
        results = await cursor.fetchall()
        return dict(results) if results else {}

    # Методы для работы с методами оплаты (включены/отключены)
    async def init_default_payment_methods(self):
        """Инициализирует дефолтные методы оплаты если их нет в базе"""
        default_methods = [
            ("sbp_phone", "📱 СБП по номеру", True),
            ("card", "💳 Банковская карта", True),
            ("crypto", "₿ Криптовалюта", True),
            ("stars", "⭐ Telegram Stars", True),
            ("cryptobot", "🤖 CryptoBot", True),
            ("bitpapa", "🌐 BitPapa", True),
            ("skins", "🎮 Скинами", False)
        ]
        
        for method_id, method_name, is_enabled in default_methods:
            # Проверяем, существует ли уже такой метод
            cursor = await self.conn.execute(
                "SELECT 1 FROM payment_methods WHERE method_id = ?", 
                (method_id,)
            )
            exists = await cursor.fetchone()
            
            if not exists:
                await self.conn.execute('''
                    INSERT INTO payment_methods (method_id, method_name, is_enabled)
                    VALUES (?, ?, ?)
                ''', (method_id, method_name, is_enabled))
        
        # Инициализируем дефолтное расположение методов оплаты
        await self.init_default_payment_layout()
        await self.conn.commit()
    
    async def init_default_payment_layout(self):
        """Инициализирует дефолтное расположение методов оплаты"""
        # Проверяем, есть ли уже расположение
        cursor = await self.conn.execute("SELECT COUNT(*) FROM payment_method_layout")
        count = await cursor.fetchone()
        
        if count[0] == 0:
            # Добавляем дефолтное расположение
            default_layout = [
                ("sbp_phone", 1, 1),  # СБП по номеру - 1 ряд, 1 позиция
                ("card", 1, 2),       # Карта - 1 ряд, 2 позиция
                ("crypto", 2, 1),     # Криптовалюта - 2 ряд, 1 позиция
                ("stars", 2, 2),      # Stars - 2 ряд, 2 позиция
                ("cryptobot", 3, 1),  # CryptoBot - 3 ряд, 1 позиция
                ("bitpapa", 3, 2),    # BitPapa - 3 ряд, 2 позиция
                ("skins", 3, 3)       # Скинами - 3 ряд, 3 позиция
            ]
            
            for method_id, row_number, position_in_row in default_layout:
                await self.conn.execute('''
                    INSERT INTO payment_method_layout (method_id, row_number, position_in_row)
                    VALUES (?, ?, ?)
                ''', (method_id, row_number, position_in_row))
    
    async def get_all_payment_methods(self):
        """Получает все методы оплаты с их статусом"""
        cursor = await self.conn.execute('''
            SELECT method_id, method_name, is_enabled 
            FROM payment_methods 
            ORDER BY method_name
        ''')
        results = await cursor.fetchall()
        return [(method_id, method_name, bool(is_enabled)) for method_id, method_name, is_enabled in results] if results else []
    
    async def get_payment_methods_with_layout(self):
        """Получает все методы оплаты с их статусом и расположением"""
        cursor = await self.conn.execute('''
            SELECT pm.method_id, pm.method_name, pm.is_enabled, 
                   COALESCE(pml.row_number, 0) as row_number, 
                   COALESCE(pml.position_in_row, 0) as position_in_row
            FROM payment_methods pm
            LEFT JOIN payment_method_layout pml ON pm.method_id = pml.method_id
            ORDER BY pml.row_number, pml.position_in_row
        ''')
        results = await cursor.fetchall()
        return [(method_id, method_name, bool(is_enabled), row_number, position_in_row) 
                for method_id, method_name, is_enabled, row_number, position_in_row in results] if results else []
    
    async def update_payment_method_layout(self, method_id: str, row_number: int, position_in_row: int):
        """Обновляет расположение метода оплаты"""
        # Удаляем старое расположение
        await self.conn.execute('''
            DELETE FROM payment_method_layout WHERE method_id = ?
        ''', (method_id,))
        
        # Добавляем новое расположение
        await self.conn.execute('''
            INSERT INTO payment_method_layout (method_id, row_number, position_in_row)
            VALUES (?, ?, ?)
        ''', (method_id, row_number, position_in_row))
        
        await self.conn.commit()
    
    async def get_payment_layout(self):
        """Получает текущее расположение всех методов оплаты"""
        cursor = await self.conn.execute('''
            SELECT method_id, row_number, position_in_row
            FROM payment_method_layout
            ORDER BY row_number, position_in_row
        ''')
        results = await cursor.fetchall()
        return {method_id: (row, pos) for method_id, row, pos in results} if results else {}
    
    async def toggle_payment_method(self, method_id: str, is_enabled: bool):
        """Включает или отключает метод оплаты"""
        await self.conn.execute('''
            UPDATE payment_methods 
            SET is_enabled = ?, updated_at = datetime('now')
            WHERE method_id = ?
        ''', (is_enabled, method_id))
        await self.conn.commit()
    
    async def is_payment_method_enabled(self, method_id: str):
        """Проверяет, включен ли метод оплаты"""
        cursor = await self.conn.execute('''
            SELECT is_enabled FROM payment_methods WHERE method_id = ?
        ''', (method_id,))
        result = await cursor.fetchone()
        return bool(result[0]) if result else True  # По умолчанию включено

    async def init_default_payment_details(self):
        """Инициализирует дефолтные реквизиты если их нет в базе"""
        from config import cfg
        default_details = {
            "sbp_phone": "+79266490693 Т-Банк",
            "card": "2200 7020 0936 0848",
            "crypto": "bc1q69mv44ckgrlxe6x0g83awj6qdekdd3laktytyr",
            "stars_url": "https://duckduckgo.com/?q=%D0%B7%D0%BD%D0%B0%D0%BA++%D1%80%D1%83%D0%B1%D0%BB%D1%8C&ia=web",
            "cryptobot_url": "https://duckduckgo.com/?q=%D0%B7%D0%BD%D0%B0%D0%BA++%D1%80%D1%83%D0%B1%D0%BB%D1%8C&ia=web",
            "stars_provider_token": cfg.STARS_PROVIDER_TOKEN  # Добавляем Stars provider token
        }
        
        for method, details in default_details.items():
            existing = await self.get_payment_details(method)
            if not existing:
                await self.set_payment_details(method, details)

    async def init_default_bot_settings(self):
        """Инициализирует дефолтные настройки бота если их нет в базе"""
        from config import cfg
        default_settings = {
            "welcome_sticker_id": None,  # По умолчанию нет стикера
            "welcome_photo_id": None,  # Используется файл cfg.IMAGE_PATH
            "welcome_text": cfg.WELCOME_TEXT
        }
        
        for setting_name, setting_value in default_settings.items():
            existing = await self.get_bot_setting(setting_name)
            if existing is None:
                await self.set_bot_setting(setting_name, setting_value)

    # Методы для работы с настройками бота
    async def get_bot_setting(self, setting_name: str):
        """Получает настройку бота"""
        cursor = await self.conn.execute(
            "SELECT setting_value FROM bot_settings WHERE setting_name = ?",
            (setting_name,)
        )
        result = await cursor.fetchone()
        return result[0] if result else None

    async def set_bot_setting(self, setting_name: str, setting_value):
        """Устанавливает настройку бота"""
        # Преобразуем None в пустую строку для очистки настроек
        if setting_value is None:
            setting_value = ""
        await self.conn.execute('''
            INSERT OR REPLACE INTO bot_settings (setting_name, setting_value, updated_at)
            VALUES (?, ?, datetime('now'))
        ''', (setting_name, str(setting_value)))
        await self.conn.commit()

    async def get_welcome_settings(self):
        """Получает все настройки приветственного сообщения"""
        welcome_settings = {
            "sticker_id": await self.get_bot_setting("welcome_sticker_id"),
            "photo_id": await self.get_bot_setting("welcome_photo_id"),
            "text": await self.get_bot_setting("welcome_text")
        }
        return welcome_settings

    # Методы для работы с CryptoBot
    async def set_payment_invoice_id(self, code: str, invoice_id: str):
        """Устанавливает invoice_id для платежа"""
        await self.conn.execute('''
            UPDATE payments 
            SET invoice_id = ?
            WHERE code = ?
        ''', (invoice_id, code))
        await self.conn.commit()

    async def set_payment_crypto_details(self, code: str, asset: str, crypto_amount: float):
        """Устанавливает детали криптоплатежа"""
        await self.conn.execute('''
            UPDATE payments 
            SET crypto_asset = ?, crypto_amount = ?
            WHERE code = ?
        ''', (asset, crypto_amount, code))
        await self.conn.commit()

    async def get_payment_by_invoice_id(self, invoice_id: str):
        """Получает платеж по invoice_id"""
        cursor = await self.conn.execute('''
            SELECT id, user_id, amount, code, status, method, 
                   strftime('%Y-%m-%d %H:%M:%S', created_at) as created_at,
                   CASE WHEN expires_at IS NOT NULL 
                        THEN strftime('%Y-%m-%d %H:%M:%S', expires_at) 
                        ELSE NULL END as expires_at,
                   invoice_id, crypto_asset, crypto_amount
            FROM payments 
            WHERE invoice_id = ?
        ''', (invoice_id,))
        return await cursor.fetchone()

    # Методы для работы с администраторами
    async def add_admin(self, user_id: int, username: str = None, added_by: int = None):
        """Добавляет нового администратора"""
        try:
            await self.conn.execute('''
                INSERT OR REPLACE INTO admins (user_id, username, added_by, added_at)
                VALUES (?, ?, ?, datetime('now'))
            ''', (user_id, username, added_by))
            await self.conn.commit()
            return True
        except Exception as e:
            print(f"Ошибка при добавлении администратора: {e}")
            await self.conn.rollback()
            return False

    async def remove_admin(self, user_id: int):
        """Удаляет администратора"""
        try:
            cursor = await self.conn.execute('''
                DELETE FROM admins WHERE user_id = ?
            ''', (user_id,))
            await self.conn.commit()
            return cursor.rowcount > 0  # Возвращаем True если что-то было удалено
        except Exception as e:
            print(f"Ошибка при удалении администратора: {e}")
            await self.conn.rollback()
            return False

    async def is_admin(self, user_id: int):
        """Проверяет, является ли пользователь администратором"""
        # Проверяем главного админа из конфигурации
        from config import cfg
        if user_id == cfg.ADMIN_ID:
            return True
            
        # Проверяем в базе данных
        cursor = await self.conn.execute('''
            SELECT 1 FROM admins WHERE user_id = ?
        ''', (user_id,))
        result = await cursor.fetchone()
        return result is not None

    async def get_all_admins(self):
        """Получает список всех администраторов"""
        cursor = await self.conn.execute('''
            SELECT user_id, username, added_by, strftime('%d.%m.%Y %H:%M', added_at) as added_at
            FROM admins
            ORDER BY added_at ASC
        ''')
        admins = await cursor.fetchall()
        
        # Добавляем главного админа из конфигурации
        from config import cfg
        result = [(cfg.ADMIN_ID, 'Главный админ', None, 'По умолчанию')]
        result.extend(admins)
        return result

    async def get_all_users(self):
        """Получает список всех пользователей для рассылки"""
        cursor = await self.conn.execute('''
            SELECT user_id, username
            FROM users
            ORDER BY registration_date ASC
        ''')
        return await cursor.fetchall()

    async def search_catalog_items(self, parent_id: int, search_query: str):
        """Поиск по элементам каталога (рекурсивно)"""
        # Поиск в текущей категории
        cursor = await self.conn.execute('''
            SELECT id, type, name, description, sticker_id, photo_id, preview_link, row_width, position, is_grid_3x6,
                   search_button_name, back_button_text
            FROM catalog_items 
            WHERE parent_id = ? AND is_visible = TRUE 
            AND (name LIKE ? OR description LIKE ?)
            ORDER BY position ASC, id ASC
        ''', (parent_id, f'%{search_query}%', f'%{search_query}%'))
        direct_results = await cursor.fetchall()
        
        # Поиск в подкатегориях (рекурсивно)
        cursor = await self.conn.execute('''
            WITH RECURSIVE subcategories AS (
                -- Начальные подкатегории
                SELECT id FROM catalog_items 
                WHERE parent_id = ? AND type IN ('category', 'subcategory') AND is_visible = TRUE
                
                UNION ALL
                
                -- Рекурсивно получаем все вложенные категории
                SELECT c.id FROM catalog_items c
                INNER JOIN subcategories s ON c.parent_id = s.id
                WHERE c.type IN ('category', 'subcategory') AND c.is_visible = TRUE
            )
            SELECT c.id, c.type, c.name, c.description, c.sticker_id, c.photo_id, c.preview_link, 
                   c.row_width, c.position, c.is_grid_3x6, c.search_button_name, c.back_button_text
            FROM catalog_items c
            WHERE c.parent_id IN (SELECT id FROM subcategories) 
            AND c.is_visible = TRUE 
            AND (c.name LIKE ? OR c.description LIKE ?)
            ORDER BY c.position ASC, c.id ASC
        ''', (parent_id, f'%{search_query}%', f'%{search_query}%'))
        nested_results = await cursor.fetchall()
        
        # Объединяем результаты
        all_results = list(direct_results) + list(nested_results)
        
        # Удаляем дубликаты по ID
        seen_ids = set()
        unique_results = []
        for item in all_results:
            if item[0] not in seen_ids:
                seen_ids.add(item[0])
                unique_results.append(item)
        
        return unique_results

    async def search_catalog_items_global(self, search_query: str):
        """Глобальный поиск по всем элементам каталога (для 3x6 сетки)"""
        cursor = await self.conn.execute('''
            SELECT id, type, name, description, sticker_id, photo_id, preview_link, row_width, position, is_grid_3x6,
                   search_button_name, back_button_text
            FROM catalog_items 
            WHERE is_visible = TRUE 
            AND (name LIKE ? OR description LIKE ?)
            ORDER BY 
                CASE type 
                    WHEN 'theme' THEN 1
                    WHEN 'category' THEN 2
                    WHEN 'subcategory' THEN 3
                    WHEN 'product' THEN 4
                    ELSE 5
                END,
                position ASC, id ASC
        ''', (f'%{search_query}%', f'%{search_query}%'))
        return await cursor.fetchall()

    async def update_catalog_item_grid_settings(self, item_id: int, is_grid_3x6: bool, 
                                              search_button_name: str = None, back_button_text: str = None):
        """Обновляет настройки сетки 3x6 для элемента"""
        await self.conn.execute('''
            UPDATE catalog_items 
            SET is_grid_3x6 = ?, search_button_name = ?, back_button_text = ?
            WHERE id = ?
        ''', (is_grid_3x6, search_button_name, back_button_text, item_id))
        await self.conn.commit()

    async def close(self):
        """Закрываем соединение"""
        if self.conn:
            await self.conn.close()

    async def add_promo_code(self, code: str, discount: int):
        await self.conn.execute("INSERT OR REPLACE INTO promo_codes (code, discount) VALUES (?, ?)", (code, discount))
        await self.conn.commit()

    async def get_promo_code(self, code: str):
        cursor = await self.conn.execute("SELECT code, discount FROM promo_codes WHERE code = ?", (code,))
        return await cursor.fetchone()
        
    async def create_product_promo_tables(self):
        """Создает таблицы для промокодов товаров"""
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS product_promo_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL,
                discount INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                used INTEGER DEFAULT 0,
                UNIQUE(product_id, user_id)
            )
        ''')
        await self.conn.commit()
        
    async def add_product_promo_code(self, code: str, discount: int, product_id: int, user_id: int):
        """Добавляет промокод для конкретного товара и пользователя"""
        await self.conn.execute('''
            INSERT OR REPLACE INTO product_promo_codes 
            (code, discount, product_id, user_id, used) 
            VALUES (?, ?, ?, ?, 0)
        ''', (code, discount, product_id, user_id))
        await self.conn.commit()
        
    async def create_bonus_system_tables(self):
        """Создает таблицы для системы бонусов"""
        # Добавляем колонку tickets в таблицу users если её нет
        try:
            await self.conn.execute('''
                ALTER TABLE users ADD COLUMN tickets INTEGER DEFAULT 0
            ''')
            await self.conn.commit()
        except Exception:
            # Колонка уже существует
            pass
        
        # Таблица разделов бонусов
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS bonus_sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                photo_id TEXT,
                parent_id INTEGER,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES bonus_sections(id)
            )
        ''')
        
        # Миграция: добавляем parent_id если его нет
        try:
            await self.conn.execute('''
                ALTER TABLE bonus_sections ADD COLUMN parent_id INTEGER
            ''')
            await self.conn.commit()
        except Exception:
            # Колонка уже существует
            pass
        
        # Таблица заданий для бонусов
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS bonus_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section_id INTEGER NOT NULL,
                task_type TEXT NOT NULL, -- 'purchase', 'referral', 'product', 'tag'
                name TEXT NOT NULL,
                description TEXT,
                reward_tickets INTEGER NOT NULL,
                task_data TEXT, -- JSON для дополнительных параметров
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (section_id) REFERENCES bonus_sections(id)
            )
        ''')
        
        # Таблица прогресса пользователей по заданиям
        await self.conn.execute('''
            CREATE TABLE IF NOT EXISTS user_task_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                task_id INTEGER NOT NULL,
                is_completed BOOLEAN DEFAULT FALSE,
                completed_at TIMESTAMP,
                progress_data TEXT, -- JSON для дополнительных данных
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (task_id) REFERENCES bonus_tasks(id),
                UNIQUE(user_id, task_id)
            )
        ''')
        
        await self.conn.commit()
        
    async def get_product_promo_code(self, code: str, product_id: int, user_id: int):
        """Получает промокод для конкретного товара и пользователя"""
        cursor = await self.conn.execute('''
            SELECT id, code, discount, used 
            FROM product_promo_codes 
            WHERE code = ? AND product_id = ? AND user_id = ?
        ''', (code, product_id, user_id))
        return await cursor.fetchone()
        
    async def mark_product_promo_used(self, promo_id: int):
        """Отмечает промокод как использованный"""
        await self.conn.execute('''
            UPDATE product_promo_codes 
            SET used = 1 
            WHERE id = ?
        ''', (promo_id,))
        await self.conn.commit()
        
    async def generate_product_promo_code(self, discount: int, product_id: int, user_id: int):
        """Генерирует новый промокод для товара"""
        # Генерируем случайный код из 8 символов
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        await self.add_product_promo_code(code, discount, product_id, user_id)
        return code

    # Методы для работы с системой бонусов
    
    async def get_bonus_sections(self):
        """Получает все разделы бонусов"""
        cursor = await self.conn.execute('''
            SELECT id, name, description, photo_id, parent_id, created_at
            FROM bonus_sections 
            WHERE is_active = TRUE
            ORDER BY created_at ASC
        ''')
        return await cursor.fetchall()
    
    async def get_bonus_sections_by_parent(self, parent_id: int = None):
        """Получает разделы бонусов по parent_id"""
        if parent_id is None:
            cursor = await self.conn.execute('''
                SELECT id, name, description, photo_id, parent_id, created_at
                FROM bonus_sections 
                WHERE is_active = TRUE AND (parent_id IS NULL OR parent_id = 0)
                ORDER BY created_at ASC
            ''')
        else:
            cursor = await self.conn.execute('''
                SELECT id, name, description, photo_id, parent_id, created_at
                FROM bonus_sections 
                WHERE is_active = TRUE AND parent_id = ?
                ORDER BY created_at ASC
            ''', (parent_id,))
        return await cursor.fetchall()

    async def add_bonus_section(self, name: str, description: str = None, photo_id: str = None, parent_id: int = None):
        """Добавляет новый раздел бонусов"""
        cursor = await self.conn.execute('''
            INSERT INTO bonus_sections (name, description, photo_id, parent_id)
            VALUES (?, ?, ?, ?)
            RETURNING id
        ''', (name, description, photo_id, parent_id))
        row = await cursor.fetchone()
        await self.conn.commit()
        return row[0] if row else None
    
    async def get_bonus_section(self, section_id: int):
        """Получает раздел бонусов по ID"""
        cursor = await self.conn.execute('''
            SELECT id, name, description, photo_id, parent_id, created_at
            FROM bonus_sections 
            WHERE id = ? AND is_active = TRUE
        ''', (section_id,))
        return await cursor.fetchone()
    
    async def get_bonus_tasks(self, section_id: int = None, task_type: str = None):
        """Получает задания для бонусов"""
        query = '''
            SELECT id, section_id, task_type, name, description, reward_tickets, 
                   task_data, created_at
            FROM bonus_tasks 
            WHERE is_active = TRUE
        '''
        params = []
        
        if section_id:
            query += ' AND section_id = ?'
            params.append(section_id)
        
        if task_type:
            query += ' AND task_type = ?'
            params.append(task_type)
        
        query += ' ORDER BY created_at ASC'
        
        cursor = await self.conn.execute(query, params)
        return await cursor.fetchall()
    
    async def add_bonus_task(self, section_id: int, task_type: str, name: str, 
                           description: str, reward_tickets: int, task_data: str = None):
        """Добавляет новое задание для бонусов"""
        cursor = await self.conn.execute('''
            INSERT INTO bonus_tasks (section_id, task_type, name, description, reward_tickets, task_data)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id
        ''', (section_id, task_type, name, description, reward_tickets, task_data))
        row = await cursor.fetchone()
        await self.conn.commit()
        return row[0] if row else None
    
    async def get_user_task_progress(self, user_id: int, task_id: int):
        """Получает прогресс пользователя по заданию"""
        cursor = await self.conn.execute('''
            SELECT id, user_id, task_id, is_completed, completed_at, progress_data
            FROM user_task_progress 
            WHERE user_id = ? AND task_id = ?
        ''', (user_id, task_id))
        return await cursor.fetchone()
    
    async def update_user_task_progress(self, user_id: int, task_id: int, 
                                      is_completed: bool = False, progress_data: str = None):
        """Обновляет прогресс пользователя по заданию"""
        await self.conn.execute('''
            INSERT OR REPLACE INTO user_task_progress 
            (user_id, task_id, is_completed, completed_at, progress_data)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, task_id, is_completed, 
              datetime.now().strftime('%Y-%m-%d %H:%M:%S') if is_completed else None,
              progress_data))
        await self.conn.commit()
    
    async def get_user_tickets_count(self, user_id: int):
        """Получает количество билетов пользователя (tickets counter in users table)"""
        cursor = await self.conn.execute('''
            SELECT tickets FROM users WHERE user_id = ?
        ''', (user_id,))
        result = await cursor.fetchone()
        return result[0] if result else 0
    
    async def add_user_tickets(self, user_id: int, tickets: int):
        """Добавляет билеты пользователю"""
        # Сначала убеждаемся, что пользователь существует
        await self.ensure_user_exists(user_id)
        
        await self.conn.execute('''
            UPDATE users 
            SET tickets = COALESCE(tickets, 0) + ?
            WHERE user_id = ?
        ''', (tickets, user_id))
        await self.conn.commit()
    
    async def get_user_purchase_amount(self, user_id: int):
        """Получает общую сумму покупок пользователя"""
        cursor = await self.conn.execute('''
            SELECT SUM(amount) FROM transactions 
            WHERE user_id = ? AND status = 'completed'
        ''', (user_id,))
        result = await cursor.fetchone()
        return result[0] if result and result[0] else 0
    
    async def get_user_referral_count(self, user_id: int):
        """Получает количество рефералов пользователя"""
        cursor = await self.conn.execute('''
            SELECT COUNT(*) FROM referrals 
            WHERE referrer_id = ?
        ''', (user_id,))
        result = await cursor.fetchone()
        return result[0] if result else 0
    
    async def get_user_orders(self, user_id: int, page: int = 0, orders_per_page: int = 5):
        """Получает заказы пользователя с пагинацией"""
        offset = page * orders_per_page
        
        cursor = await self.conn.execute('''
            SELECT o.id, o.user_id, o.product_id, o.code, o.quantity, o.price, o.status,
                   strftime('%Y-%m-%d %H:%M:%S', o.expires_at) as expires_at,
                   strftime('%Y-%m-%d %H:%M:%S', o.created_at) as created_at,
                   c.name as product_name, o.selected_days, o.payment_method,
                   strftime('%Y-%m-%d %H:%M:%S', o.completed_at) as completed_at
            FROM orders o
            JOIN catalog_items c ON o.product_id = c.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        ''', (user_id, orders_per_page, offset))
        return await cursor.fetchall()
    
    async def get_user_orders_count(self, user_id: int):
        """Получает общее количество заказов пользователя"""
        cursor = await self.conn.execute('''
            SELECT COUNT(*) FROM orders WHERE user_id = ?
        ''', (user_id,))
        result = await cursor.fetchone()
        return result[0] if result else 0
    
    # Методы для работы с API токенами
    async def set_api_token(self, token_name: str, token_value: str):
        """Устанавливает или обновляет API токен"""
        await self.conn.execute('''
            INSERT OR REPLACE INTO api_tokens (token_name, token_value, updated_at)
            VALUES (?, ?, datetime('now'))
        ''', (token_name, token_value))
        await self.conn.commit()
    
    async def get_api_token(self, token_name: str):
        """Получает API токен по имени"""
        cursor = await self.conn.execute('''
            SELECT token_value FROM api_tokens WHERE token_name = ?
        ''', (token_name,))
        result = await cursor.fetchone()
        return result[0] if result else None
    
    async def get_all_api_tokens(self):
        """Получает все API токены"""
        cursor = await self.conn.execute('''
            SELECT token_name, token_value, created_at, updated_at FROM api_tokens
        ''')
        return await cursor.fetchall()
    
    # Методы для работы с промокодами
    async def add_promo_code(self, code: str, discount: int):
        """Добавляет промокод"""
        await self.conn.execute('''
            INSERT OR REPLACE INTO promo_codes (code, discount)
            VALUES (?, ?)
        ''', (code, discount))
        await self.conn.commit()
    
    async def get_promo_code(self, code: str):
        """Получает промокод"""
        cursor = await self.conn.execute('''
            SELECT code, discount FROM promo_codes WHERE code = ?
        ''', (code,))
        return await cursor.fetchone()
    
    async def get_all_promo_codes(self):
        """Получает все промокоды"""
        cursor = await self.conn.execute('''
            SELECT code, discount, created_at FROM promo_codes ORDER BY created_at DESC
        ''')
        return await cursor.fetchall()
    
    async def delete_promo_code(self, code: str):
        """Удаляет промокод"""
        await self.conn.execute('''
            DELETE FROM promo_codes WHERE code = ?
        ''', (code,))
        await self.conn.commit()
    
    # Методы для работы с названиями кнопок главного меню
    async def get_button_name(self, button_key: str):
        """Получает название кнопки по ключу"""
        cursor = await self.conn.execute('''
            SELECT button_name FROM button_names WHERE button_key = ?
        ''', (button_key,))
        result = await cursor.fetchone()
        return result[0] if result else None
    
    async def set_button_name(self, button_key: str, button_name: str):
        """Устанавливает или обновляет название кнопки"""
        await self.conn.execute('''
            INSERT OR REPLACE INTO button_names (button_key, button_name, updated_at)
            VALUES (?, ?, datetime('now'))
        ''', (button_key, button_name))
        await self.conn.commit()
    
    async def get_all_button_names(self):
        """Получает все названия кнопок"""
        cursor = await self.conn.execute('''
            SELECT button_key, button_name FROM button_names
        ''')
        return await cursor.fetchall()
    
    async def init_default_button_names(self):
        """Инициализирует дефолтные названия кнопок"""
        default_buttons = {
            'catalog': '🏪 Каталог товаров',
            'deposit': '💳 Пополнить баланс',
            'profile': '👤 Мой профиль',
            'contact': '📞 Связаться',
            'bonus': '🎁ПОЛУЧИ БОНУСЫ🎁'
        }
        
        for key, name in default_buttons.items():
            # Проверяем, существует ли кнопка
            existing = await self.get_button_name(key)
            if not existing:
                await self.set_button_name(key, name)
    
    # Методы для работы с BitPAPA платежами
    async def save_bitpapa_payment(self, user_id: int, order_code: str, payment_id: str, amount: float, payment_url: str):
        """Сохраняет данные платежа BitPAPA"""
        try:
            # Обновляем существующий платеж, добавляя данные BitPAPA
            await self.conn.execute('''
                UPDATE payments 
                SET bitpapa_payment_id = ?, bitpapa_payment_url = ?
                WHERE code = ?
            ''', (payment_id, payment_url, order_code))
            await self.conn.commit()
        except Exception as e:
            print(f"Ошибка сохранения BitPAPA платежа: {e}")
    
    async def get_bitpapa_payment_by_order(self, order_code: str):
        """Получает данные BitPAPA платежа по коду заказа"""
        cursor = await self.conn.execute('''
            SELECT user_id, amount, bitpapa_payment_id, bitpapa_payment_url
            FROM payments WHERE code = ?
        ''', (order_code,))
        result = await cursor.fetchone()
        if result:
            return {
                'user_id': result[0],
                'amount': result[1],
                'payment_id': result[2],
                'payment_url': result[3]
            }
        return None
    
    async def update_bitpapa_payment_status(self, order_code: str, status: str, updated_at):
        """Обновляет статус BitPAPA платежа"""
        await self.conn.execute('''
            UPDATE payments 
            SET bitpapa_status = ?, updated_at = ?
            WHERE code = ?
        ''', (status, updated_at.strftime('%Y-%m-%d %H:%M:%S'), order_code))
        await self.conn.commit()
    
    async def update_payment_status(self, code: str, status: str):
        """Обновляет статус платежа"""
        await self.conn.execute('''
            UPDATE payments SET status = ?
            WHERE code = ?
        ''', (status, code))
        await self.conn.commit()
    
    #бота создал @pravitelstvo_russian

# Глобальный экземпляр базы данных
db = Database()