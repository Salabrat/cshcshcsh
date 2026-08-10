# keyboards.py
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
from config import cfg
import random
import string
from datetime import datetime, timedelta
# TODO: Candidate for removal? `quote` is not used here

async def main_menu_kb():
    from database import db
    
    keyboard = ReplyKeyboardMarkup(
        resize_keyboard=True, 
        row_width=2, 
        one_time_keyboard=False, 
        selective=False, 
        is_persistent=False,
        input_field_placeholder=""
    )
    
    # Получаем названия кнопок из базы данных
    catalog_name = await db.get_button_name('catalog') or '🏪 Каталог товаров'
    deposit_name = await db.get_button_name('deposit') or '💳 Пополнить баланс'
    profile_name = await db.get_button_name('profile') or '👤 Мой профиль'
    contact_name = await db.get_button_name('contact') or '📞 Связаться'
    bonus_name = await db.get_button_name('bonus') or '🎁ПОЛУЧИ БОНУСЫ🎁'
    
    buttons = [
        KeyboardButton(catalog_name, request_contact=False, request_location=False),
        KeyboardButton(deposit_name, request_contact=False, request_location=False),
        KeyboardButton(profile_name, request_contact=False, request_location=False),
        KeyboardButton(contact_name, request_contact=False, request_location=False),
        KeyboardButton(bonus_name, request_contact=False, request_location=False)
    ]
    keyboard.add(*buttons)
    return keyboard

def profile_actions_kb():
    keyboard = InlineKeyboardMarkup(row_width=2)  # Изменяем row_width на 2 для двух кнопок в ряду
    keyboard.add(
        InlineKeyboardButton("📦 Мои заказы", callback_data="my_orders"),
        InlineKeyboardButton("💳 Пополнить", callback_data="deposit_balance")
    )
    keyboard.add(
        InlineKeyboardButton("🤝 Реферальная программа", callback_data="referral_program")
    )
    return keyboard

# В keyboards.py проверяем, что все кнопки "Назад" имеют правильные callback_data
def back_to_profile_kb():
    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_profile")
    )
    return keyboard

def user_orders_list_kb(orders, current_page: int, total_pages: int):
    """Клавиатура с заказами пользователя в виде кнопок"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    
    # Добавляем кнопки с заказами
    for i, order in enumerate(orders, 1):
        order_id, user_id, product_id, code, quantity, price, status = order[:7]
        expires_at, created_at, product_name = order[7:10]
        selected_days = order[10] if len(order) > 10 else None
        
        # Определяем статус заказа
        status_emoji = {
            'pending': '⏳',
            'paid': '✅', 
            'completed': '✅',
            'cancelled': '❌',
            'expired': '⏰'
        }
        
        emoji = status_emoji.get(status, '❓')
        price_rub = price / 100 if price else 0
        days_info = f" ({selected_days} дн.)" if selected_days else ""
        
        # Формируем текст кнопки
        button_text = f"{emoji} {product_name}{days_info} - {price_rub:.0f}₽"
        
        # Ограничиваем длину текста кнопки
        if len(button_text) > 60:
            button_text = button_text[:57] + "..."
        
        keyboard.add(
            InlineKeyboardButton(
                button_text,
                callback_data=f"view_order_{code}",

            )
        )
    
    return keyboard

def user_orders_pagination_kb(current_page: int, total_pages: int, has_orders: bool = True):
    """Клавиатура для пагинации заказов пользователя"""
    keyboard = InlineKeyboardMarkup(row_width=3)
    
    if has_orders and total_pages > 1:
        pagination_row = []
        
        # Кнопка влево
        if current_page > 0:
            pagination_row.append(InlineKeyboardButton("❮", callback_data=f"orders_page_{current_page-1}"))
        else:
            pagination_row.append(InlineKeyboardButton("❮", callback_data="noop"))  # Неактивная кнопка
        
        # Информация о странице
        pagination_row.append(InlineKeyboardButton(f"{current_page + 1}/{total_pages}", callback_data="noop"))
        
        # Кнопка вправо
        if current_page < total_pages - 1:
            pagination_row.append(InlineKeyboardButton("❯", callback_data=f"orders_page_{current_page+1}"))
        else:
            pagination_row.append(InlineKeyboardButton("❯", callback_data="noop"))  # Неактивная кнопка
        
        keyboard.row(*pagination_row)
    
    # Кнопка назад к профилю
    keyboard.add(
        InlineKeyboardButton("🔙 Назад к профилю", callback_data="back_to_profile")
    )
    
    return keyboard

def order_details_kb(code: str):
    """Клавиатура для детального просмотра заказа"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("💳 Оплатить", callback_data=f"pay_order_{code}"),
        InlineKeyboardButton("❌ Отменить", callback_data=f"cancel_order_from_orders_{code}")
    )
    keyboard.add(
        InlineKeyboardButton("🔙 К заказам", callback_data="my_orders")
    )
    return keyboard

def quantity_selection_kb(product_id: int, current_quantity: int, max_quantity: int):
    """Клавиатура для выбора количества товара"""
    keyboard = InlineKeyboardMarkup()
    
    # Первая строка: уменьшить на 1, текущее количество, увеличить на 1
    row1 = []
    if current_quantity > 1:
        row1.append(InlineKeyboardButton("🔻", callback_data=f"qty_dec1_{product_id}_{current_quantity}"))
    else:
        row1.append(InlineKeyboardButton("🔻", callback_data="qty_min_reached"))
    
    row1.append(InlineKeyboardButton(f"{current_quantity} шт.", callback_data="qty_display"))
    
    if current_quantity < max_quantity:
        row1.append(InlineKeyboardButton("🔺", callback_data=f"qty_inc1_{product_id}_{current_quantity}"))
    else:
        row1.append(InlineKeyboardButton("🔺", callback_data="qty_max_reached"))
    
    keyboard.row(*row1)
    
    # Вторая строка: уменьшить на 10, увеличить на 10
    row2 = []
    
    # Кнопка 🔻10 всегда видна
    if current_quantity > 10:
        row2.append(InlineKeyboardButton("🔻10", callback_data=f"qty_dec10_{product_id}_{current_quantity}"))
    elif current_quantity > 1:
        # Если количество меньше 10, но больше 1, уменьшаем до 1
        row2.append(InlineKeyboardButton("🔻10", callback_data=f"qty_set1_{product_id}"))
    else:
        # Даже при количестве 1 показываем кнопку, но она будет неактивной
        row2.append(InlineKeyboardButton("🔻10", callback_data="qty_min_reached"))
    
    # Кнопка 🔺10 всегда видна
    if current_quantity + 10 <= max_quantity:
        row2.append(InlineKeyboardButton("🔺10", callback_data=f"qty_inc10_{product_id}_{current_quantity}"))
    elif current_quantity < max_quantity:
        # Если нельзя добавить 10, но можно добавить до максимума
        row2.append(InlineKeyboardButton("🔺10", callback_data=f"qty_setmax_{product_id}_{max_quantity}"))
    else:
        # При максимальном количестве показываем неактивную кнопку
        row2.append(InlineKeyboardButton("🔺10", callback_data="qty_max_reached"))
    
    # Всегда добавляем вторую строку
    keyboard.row(*row2)
    
    return keyboard

def product_purchase_kb(product_id: int, price_rub: float, quantity: int = 1, max_quantity: int = 1):
    """Клавиатура для покупки т��вара с выбором количества"""
    keyboard = InlineKeyboardMarkup()
    
    # Если товаров больше 1, показываем кнопки выбора количества
    if max_quantity > 1:
        qty_keyboard = quantity_selection_kb(product_id, quantity, max_quantity)
        # Добавляем кнопки выбора количества
        for row in qty_keyboard.inline_keyboard:
            keyboard.row(*row)
    
    # Кнопка "Купить"
    total_price = price_rub * quantity
    keyboard.add(
        InlineKeyboardButton(
            f"💳 Купить за {total_price:.0f}₽", 
            callback_data=f"buy_product_{product_id}_{quantity}"
        )
    )

    keyboard.add(
        InlineKeyboardButton("🎁 Есть промокод", callback_data=f"promo_code_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔗 Поделиться", callback_data=f"share_product_{product_id}")
    )
    
    return keyboard

def admin_confirm_payment_kb(code: str, user_id: int, amount: int):
    """Клавиатура для подтверждения платежа админом"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton(
            "✅ Подтвердить оплату",
            callback_data=f"admin_approve_{code}_{user_id}_{amount}"
        ),
        InlineKeyboardButton(
            "❌ Отклонить",
            callback_data=f"admin_reject_{code}"
        )
    )
    return keyboard

def admin_tickets_kb(tickets):
    """Клавиатура со списком обращений для админа"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    for ticket in tickets:
        btn_text = f"#{ticket[0]} - {ticket[2]} ({ticket[6]})"  # id, topic, created_at
        keyboard.add(InlineKeyboardButton(
            btn_text,
            callback_data=f"admin_view_ticket_{ticket[0]}"
        ))
    return keyboard

def admin_ticket_details_kb(ticket_id, user_id):
    """Клавиатура для просмотра обращения админом"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton(
            "✉️ Ответить",
            callback_data=f"admin_reply_{user_id}_{ticket_id}"
        ),
        InlineKeyboardButton(
            "📋 Все обращения",
            callback_data="admin_all_tickets"
        )
    )
    return keyboard

def back_to_referral_kb():
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("💰 Вывести средства", callback_data="withdraw_funds"),
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_profile")
    )
    return keyboard

def withdraw_methods_kb():
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("💳 На баланс", callback_data="withdraw_to_balance"),
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_referral")
    )
    return keyboard

# keyboards.py
def contact_menu_kb():
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("➕ Создать обращение", callback_data="create_ticket"),
        InlineKeyboardButton("📭 Мои обращения", callback_data="my_tickets")
    )
    return keyboard

# keyboards.py
def back_to_contact_kb():
    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_contact")
    )
    return keyboard

# Обновим функцию admin_reply_kb
def admin_reply_kb(user_id, ticket_id):
    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton(
            "✉️ Ответить",
            callback_data=f"admin_reply_{user_id}_{ticket_id}"
        )
    )
    return keyboard

def admin_payment_management_kb():
    """Клавиатура для управления реквизитами админом"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("📱 СБП по номеру", callback_data="edit_sbp_phone"),
        InlineKeyboardButton("💳 Карта", callback_data="edit_card"),
        InlineKeyboardButton("₿ Криптовалюта", callback_data="edit_crypto"),
        InlineKeyboardButton("🔑 Stars Provider Token", callback_data="edit_stars_provider_token"),
        InlineKeyboardButton("🤖 CryptoBot URL", callback_data="edit_cryptobot_url"),
        InlineKeyboardButton("🔐 BitPAPA API Token", callback_data="edit_bitpapa_token"),
        InlineKeyboardButton("⚙️ Добавить/убрать метод оплаты", callback_data="manage_payment_methods"),
        InlineKeyboardButton("📐 Настроить расположение методов", callback_data="manage_payment_layout")
    )
    return keyboard

def edit_start_menu_kb():
    """Клавиатура для редактирования приветственного сообщения"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("✏️ Изменить /start", callback_data="edit_welcome_message"),
        InlineKeyboardButton("🖼️ Изменить фото каталога", callback_data="edit_catalog_photo"),
        InlineKeyboardButton("🎁 Редактировать ПОЛУЧИ БОНУСЫ", callback_data="edit_bonus_system")
    )
    return keyboard

def edit_welcome_components_kb():
    """Клавиатура для выбора компонентов приветственного сообщения"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("🎁 Изменить стикер", callback_data="edit_welcome_sticker"),
        InlineKeyboardButton("🖼️ Изменить фото", callback_data="edit_welcome_photo"),
        InlineKeyboardButton("📝 Изменить текст", callback_data="edit_welcome_text"),
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_edit_menu")
    )
    return keyboard


# Клавиатуры для системы бонусов

def bonus_system_settings_kb():
    """Клавиатура для настроек системы бонусов"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("🎁 Настроить стикер", callback_data="edit_bonus_sticker"),
        InlineKeyboardButton("🖼️ Настроить фото", callback_data="edit_bonus_photo"),
        InlineKeyboardButton("📝 Настроить описание", callback_data="edit_bonus_description"),
        InlineKeyboardButton("➕ Добавить категорию", callback_data="add_bonus_category"),
        InlineKeyboardButton("📋 Показать категории", callback_data="show_bonus_sections"),
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_edit_menu")
    )
    return keyboard

def bonus_sections_list_kb(sections, is_admin=False):
    """Клавиатура со списком категорий бонусов"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    
    for section in sections:
        section_id, section_name = section[0], section[1]
        # Поддержка базового форматирования в названиях кнопок
        # Удаляем только _ и ~, оставляем * для жирного форматирования
        formatted_name = section_name.replace('_', '').replace('~', '')
        keyboard.add(
            InlineKeyboardButton(formatted_name, callback_data=f"view_bonus_section_{section_id}")
        )
    
    if is_admin:
        keyboard.add(
            InlineKeyboardButton("➕ Добавить категорию", callback_data="add_bonus_category")
        )
    
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_main")
    )
    return keyboard

def bonus_section_admin_kb(section_id):
    """Клавиатура администратора для раздела бонусов"""
    # УДАЛЕНЫ КНОПКИ: ➕ Создать список заданий, ➕ Создать условия покупок, 👀 Посмотреть как пользователь
    # Теперь админ видит все как пользователь, но с возможностью добавить категорию
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data="show_bonus_sections")
    )
    return keyboard

def task_status_kb(task_id, task_type, is_completed=False):
    """Клавиатура для задания"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    
    if not is_completed:
        if task_type == "purchase":
            keyboard.add(
                InlineKeyboardButton("🔍 Проверить задание", callback_data=f"check_task_{task_id}")
            )
        elif task_type == "referral":
            keyboard.add(
                InlineKeyboardButton("🔍 Проверить задание", callback_data=f"check_task_{task_id}")
            )
        elif task_type == "product":
            # Note: This will be handled in view_task_handler with direct URL button
            keyboard.add(
                InlineKeyboardButton("📦 Выполнить задание", callback_data=f"execute_task_{task_id}"),
                InlineKeyboardButton("✅ Я выполнил", callback_data=f"complete_task_{task_id}")
            )
        elif task_type == "tag":
            keyboard.add(
                InlineKeyboardButton("🏷️ Принять участие", callback_data=f"participate_tag_{task_id}"),
                InlineKeyboardButton("✅ Я выполнил", callback_data=f"complete_task_{task_id}")
            )
    
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data="show_bonus_sections")
    )
    return keyboard

def back_to_bonus_settings_kb():
    """Кнопка возврата к настройкам бонусов"""
    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data="edit_bonus_system")
    )
    return keyboard


# keyboards.py
def support_topics_kb():
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("🛒 Проблема с заказом", callback_data="support_order"),
        InlineKeyboardButton("💳 Проблема с оплатой", callback_data="support_payment"),
        InlineKeyboardButton("❓ Вопросы по товару", callback_data="support_product"),
        InlineKeyboardButton("💰 Проблема с пополнением", url=f"https://t.me/{cfg.SUPPORT_ID}"),
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_contact")
    )
    return keyboard

def back_to_topics_kb():
    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton("🔙 Назад к темам", callback_data="back_to_topics")
    )
    return keyboard

def my_tickets_kb():
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("➕ Создать обращение", callback_data="create_ticket"),
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_contact")
    )
    return keyboard


# В keyboards.py добавляем новые функции:

def tickets_list_kb(tickets):
    """Клавиатура со списком обращений"""
    keyboard = InlineKeyboardMarkup(row_width=1)

    for ticket in tickets:
        btn_text = f"{ticket[1]} ({ticket[5]})"  # topic и created_at
        keyboard.add(InlineKeyboardButton(
            btn_text,
            callback_data=f"view_ticket_{ticket[0]}"  # id
        ))

    keyboard.add(
        InlineKeyboardButton("➕ Создать обращение", callback_data="create_ticket"),
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_contact")
    )
    return keyboard

def ticket_details_kb(ticket_id, is_answered):
    """Клавиатура для просмотра конкретного обращения"""
    keyboard = InlineKeyboardMarkup(row_width=1)

    if not is_answered:
        keyboard.add(InlineKeyboardButton(
            "✉️ Ответить",
            callback_data=f"reply_to_ticket_{ticket_id}"
        ))

    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_tickets")  # Changed callback data
    )
    return keyboard


# В keyboards.py добавим:
def payment_amounts_kb():
    """Клавиатура с суммами платежа в 3 ряда (4x3x3)"""
    keyboard = InlineKeyboardMarkup(row_width=4)

    # Первый ряд (4 кнопки)
    keyboard.row(
        InlineKeyboardButton("200₽", callback_data="pay_amount_200"),
        InlineKeyboardButton("500₽", callback_data="pay_amount_500"),
        InlineKeyboardButton("1000₽", callback_data="pay_amount_1000"),
        InlineKeyboardButton("2000₽", callback_data="pay_amount_2000")
    )

    # Второй ряд (3 кнопки)
    keyboard.row(
        InlineKeyboardButton("3000₽", callback_data="pay_amount_3000"),
        InlineKeyboardButton("4000₽", callback_data="pay_amount_4000"),
        InlineKeyboardButton("5000₽", callback_data="pay_amount_5000")
    )

    # Третий ряд (3 кнопки)
    keyboard.row(
        InlineKeyboardButton("10000₽", callback_data="pay_amount_10000"),
        InlineKeyboardButton("15000₽", callback_data="pay_amount_15000"),
        InlineKeyboardButton("20000₽", callback_data="pay_amount_20000")
    )

    # Четвертый ряд (1 кнопка)
    keyboard.row(
        InlineKeyboardButton("💵 Другая сумма", callback_data="custom_amount")
    )

    return keyboard


# keyboards.py (дополнение)
from urllib.parse import quote


async def payment_methods_compact_kb(code: str):
    """Обновленная клавиатура методов оплаты с новой структурой"""
    print(f"=== ГЕНЕРАЦИЯ КЛАВИАТУРЫ ОПЛАТЫ ===")
    print(f"Код платежа: {code}")
    print(f"Тип кода: {type(code)}")
    
    try:
        from database import db
        keyboard = InlineKeyboardMarkup(row_width=3)
        print("Создана клавиатура")

        # Получаем все методы оплаты с их расположением из базы данных
        payment_methods = await db.get_payment_methods_with_layout()
        print(f"Получены методы оплаты: {payment_methods}")
        
        # Фильтруем только включенные методы оплаты
        enabled_methods = [(method_id, method_name, row_number, position_in_row) 
                          for method_id, method_name, is_enabled, row_number, position_in_row in payment_methods 
                          if is_enabled]
        print(f"Включенные методы: {enabled_methods}")
        
        # Группируем методы по рядам
        rows = {}
        for method_id, method_name, row_number, position_in_row in enabled_methods:
            if row_number not in rows:
                rows[row_number] = []
            rows[row_number].append((method_id, method_name, position_in_row))
        
        # Сортируем методы в каждом ряду по позиции
        for row_number in rows:
            rows[row_number].sort(key=lambda x: x[2])
        
        # Добавляем кнопки по рядам
        for row_number in sorted(rows.keys()):
            row_buttons = []
            for method_id, method_name, position_in_row in rows[row_number]:
                # Создаем callback_data в зависимости от метода
                callback_data = f"pay_method_{method_id}_{code}"
                row_buttons.append(InlineKeyboardButton(method_name, callback_data=callback_data))
            
            if row_buttons:
                keyboard.row(*row_buttons)
            print(f"Добавлена строка {row_number}")

        # Кнопка назад в профиль
        keyboard.row(
            InlineKeyboardButton("🔙 Назад в профиль", callback_data="back_to_profile")
        )
        print("Добавлена кнопка назад")
        print(f"Финальная клавиатура: {keyboard}")

        print(f"Клавиатура сгенерирована успешно: {keyboard}")
        return keyboard
    except Exception as e:
        print(f"Ошибка при генерации клавиатура: {e}")
        import traceback
        traceback.print_exc()
        # Возвращаем пустую клавиатуру в случае ошибки
        return InlineKeyboardMarkup()

def payment_support_links_kb():
    """Клавиатура с ссылками на поддержку"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("💬 Написать в поддержку", url="https://t.me/payment_systems"),
        InlineKeyboardButton("🤖 Поддержка по СПАМу", url="https://t.me/SuppPayBot"),
        InlineKeyboardButton("🔙 Назад", callback_data="back_to_profile")
    )
    return keyboard

def generate_payment_code():
    """Генерируем короткий случайный код для платежа в формате Z70D4SO"""
    print("Генерируем код платежа...")
    # Формат: буква + 2 цифры + буква + цифра + 2 буквы
    letters = string.ascii_uppercase
    digits = string.digits
    
    code = (
        random.choice(letters) +           # Первая буква
        ''.join(random.choices(digits, k=2)) +  # 2 цифры
        random.choice(letters) +               # Буква
        random.choice(digits) +                # Цифра
        ''.join(random.choices(letters, k=2))   # 2 буквы
    )
    
    print(f"Сгенерирован код: {code}")
    return code

def get_expire_time(minutes=20):
    """Получаем время истечения платежа"""
    now = datetime.now()
    expire_time = now + timedelta(minutes=minutes)
    return expire_time.strftime("%d.%m.%Y %H:%M")


def payment_confirm_kb(code: str):
    """Клавиатура подтверждения платежа"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("❌ Отменить заказ", callback_data=f"cancel_payment_{code}"),
        InlineKeyboardButton("✅ Перейти к оплате", callback_data=f"confirm_payment_{code}")
    )
    return keyboard


def cancel_confirm_kb(code: str):
    """Клавиатура подтверждения отмены"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("🔄 Я передумал", callback_data=f"back_to_payment_{code}"),
        InlineKeyboardButton("❌ Точно отменить", callback_data=f"confirm_cancel_payment_{code}")
    )
    return keyboard

def back_to_payment_kb(code: str = None):
    """Кнопка возврата к пополнению"""
    keyboard = InlineKeyboardMarkup()
    if code:
        keyboard.add(
            InlineKeyboardButton("↩️ Вернуться к пополнению", callback_data=f"back_to_payment_{code}")
        )
    else:
        keyboard.add(
            InlineKeyboardButton("🔙 Назад", callback_data="back_to_payment")
        )
    return keyboard

# Функции для каталога товаров
async def create_catalog_keyboard(items, is_admin=False, parent_id=None, item_type=None):
    """Создает клавиатуру каталога на основе элементов"""
    from database import db
    keyboard = InlineKeyboardMarkup(row_width=2)
    
    # Добавляем элементы каталога
    current_row = []
    for item in items:
        # Распаковываем с учетом новых колонок (может быть 9 или 10+ колонок)
        if len(item) >= 10:
            item_id, item_type_current, name, description, sticker_id, photo_id, preview_link, row_width, position, is_grid_3x6 = item[:10]
        else:
            item_id, item_type_current, name, description, sticker_id, photo_id, preview_link, row_width, position = item[:9]
            is_grid_3x6 = False
        
        # Определяем callback_data в зависимости от типа
        if item_type_current == 'theme':
            callback_data = f"view_theme_{item_id}"
        elif item_type_current == 'category':
            callback_data = f"view_category_{item_id}"
        elif item_type_current == 'subcategory':
            callback_data = f"view_subcategory_{item_id}"
        elif item_type_current == 'product':
            callback_data = f"view_product_{item_id}"
        else:
            continue
        
        # Создаем кнопку - используем name для отображения на кнопке
        button_text = name if name else description
        
        # Для товаров добавляем цену к названию кнопки
        if item_type_current == 'product':
            try:
                price_info = await db.get_product_price(item_id)
                if price_info and price_info[0] is not None:
                    price, currency = price_info
                    price_rub = price / 100  # Конвертируем из копеек в рубли
                    button_text = f"{button_text} • {price_rub:.0f}₽"
            except Exception as e:
                print(f"Ошибка получения цены для товара {item_id}: {e}")
        
        button = InlineKeyboardButton(button_text, callback_data=callback_data)
        
        # Используем row_width элемента для определения расположения
        if row_width == 2:
            # Элемент должен быть в ряду по 2
            current_row.append(button)
            if len(current_row) == 2:
                keyboard.row(*current_row)
                current_row = []
        else:
            # Элемент должен быть в отдельном ряду
            if current_row:
                keyboard.row(*current_row)
                current_row = []
            keyboard.row(button)
    
    # Добавляем оставшиеся кнопки в ряд
    if current_row:
        keyboard.row(*current_row)
    
    # Добавляем кнопку "Назад" если есть родительский элемент
    if parent_id is not None:
        keyboard.add(
            InlineKeyboardButton("🔙 Назад", callback_data=f"view_parent_{parent_id}_0")
        )
    
    # Добавляем кнопки "Добавить" для админа
    if is_admin:
        admin_buttons = []
        if parent_id is None:
            # В главном каталоге - добавить тему
            admin_buttons.append(InlineKeyboardButton("➕ Добавить тему", callback_data="add_theme"))
        else:
            # Определяем тип текущего элемента для правильных кнопок добавления
            if item_type == 'theme':
                admin_buttons.extend([
                    InlineKeyboardButton("➕ Добавить категорию", callback_data=f"add_category_{parent_id}"),
                    InlineKeyboardButton("➕ Добавить товар", callback_data=f"add_product_{parent_id}")
                ])
            elif item_type == 'category':
                admin_buttons.extend([
                    InlineKeyboardButton("➕ Добавить подкатегорию", callback_data=f"add_subcategory_{parent_id}"),
                    InlineKeyboardButton("➕ Добавить товар", callback_data=f"add_product_{parent_id}"),
                    InlineKeyboardButton("📁 Массовая загрузка", callback_data=f"bulk_upload_{parent_id}")
                ])
            elif item_type == 'subcategory':
                admin_buttons.extend([
                    InlineKeyboardButton("➕ Добавить товар", callback_data=f"add_product_{parent_id}"),
                    InlineKeyboardButton("📁 Массовая загрузка", callback_data=f"bulk_upload_{parent_id}")
                ])
            else:
                # Универсальная кнопка для других случаев
                admin_buttons.extend([
                    InlineKeyboardButton("➕ Добавить товар", callback_data=f"add_product_{parent_id}"),
                    InlineKeyboardButton("📁 Массовая загрузка", callback_data=f"bulk_upload_{parent_id}")
                ])
        
        # Добавляем кнопки добавления
        for btn in admin_buttons:
            keyboard.row(btn)
        
        # Добавляем кнопки редактирования для текущего элемента
        if parent_id is not None:
            edit_buttons = []
            if item_type == 'theme':
                edit_buttons.append(InlineKeyboardButton("✏️ Изменить тему", callback_data=f"admin_edit_theme_{parent_id}"))
            elif item_type == 'category':
                edit_buttons.append(InlineKeyboardButton("✏️ Изменить категорию", callback_data=f"admin_edit_category_{parent_id}"))
            elif item_type == 'subcategory':
                edit_buttons.append(InlineKeyboardButton("✏️ Изменить подкатегорию", callback_data=f"admin_edit_subcategory_{parent_id}"))
            
            # Добавляем кнопки редактирования
            for btn in edit_buttons:
                keyboard.row(btn)
    
    return keyboard

def create_admin_add_keyboard(parent_id=None, item_type=None):
    """Создает клавиатуру для админа при добавлении элементов"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    
    if parent_id is None:
        # Добавление темы
        keyboard.add(
            InlineKeyboardButton("➕ Добавить тему", callback_data="add_theme")
        )
    else:
        # Добавление дочерних элементов
        if item_type == 'theme':
            keyboard.add(
                InlineKeyboardButton("➕ Добавить категорию", callback_data=f"add_category_{parent_id}")
            )
        elif item_type == 'category':
            keyboard.add(
                InlineKeyboardButton("➕ Добавить подкатегорию", callback_data=f"add_subcategory_{parent_id}"),
                InlineKeyboardButton("➕ Добавить товар", callback_data=f"add_product_{parent_id}")
            )
        elif item_type == 'subcategory':
            keyboard.add(
                InlineKeyboardButton("➕ Добавить товар", callback_data=f"add_product_{parent_id}")
            )
    
    keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data="back_to_catalog"))
    
    return keyboard

# Клавиатуры для заказов товаров
async def order_payment_methods_kb(code: str):
    """Клавиатура методов оплаты для заказа товара"""
    print(f"=== ГЕНЕРАЦИЯ КЛАВИАТУРЫ ОПЛАТЫ ЗАКАЗА ===")
    print(f"Код заказа: {code}")
    
    try:
        from database import db
        keyboard = InlineKeyboardMarkup(row_width=2)
        print(f"Создана клавиатура: {keyboard}")
        print(f"Тип клавиатуры: {type(keyboard)}")

        # Добавляем кнопку оплаты с баланса в самом начале
        balance_button = InlineKeyboardButton("💰 Оплатить с баланса", callback_data=f"order_pay_balance_{code}")
        keyboard.row(balance_button)
        print(f"Добавлена кнопка оплаты с баланса: {balance_button}")

        # Получаем все методы оплаты с их расположением из базы данных
        try:
            print("Получаем методы оплаты из базы данных...")
            payment_methods = await db.get_payment_methods_with_layout()
            print(f"Получены методы оплаты: {payment_methods}")
            print(f"Тип payment_methods: {type(payment_methods)}")
        except Exception as e:
            print(f"Ошибка получения методов оплаты: {e}")
            import traceback
            traceback.print_exc()
            # Создаем фолбэк клавиатуру
            keyboard.add(InlineKeyboardButton("🚫 Отменить заказ", callback_data=f"cancel_order_{code}"))
            print(f"Фолбэк клавиатура: {keyboard}")
            return keyboard
        
        # Проверяем, есть ли методы оплаты
        if payment_methods is None:
            print("Методы оплаты None, создаем фолбэк")
            keyboard.add(InlineKeyboardButton("🚫 Отменить заказ", callback_data=f"cancel_order_{code}"))
            print(f"Фолбэк клавиатура: {keyboard}")
            return keyboard
        
        # Фильтруем только включенные методы оплаты
        enabled_methods = [(method_id, method_name, row_number, position_in_row) 
                          for method_id, method_name, is_enabled, row_number, position_in_row in payment_methods 
                          if is_enabled]
        print(f"Включенные методы: {enabled_methods}")
        
        # Если нет включенных методов, создаем фолбэк клавиатуру
        if not enabled_methods:
            print("Нет включенных методов оплаты, создаем фолбэк")
            keyboard.add(InlineKeyboardButton("🚫 Отменить заказ", callback_data=f"cancel_order_{code}"))
            print(f"Фолбэк клавиатура: {keyboard}")
            return keyboard
        
        # Группируем методы по рядам
        rows = {}
        for method_id, method_name, row_number, position_in_row in enabled_methods:
            if row_number not in rows:
                rows[row_number] = []
            rows[row_number].append((method_id, method_name, position_in_row))
        
        # Сортируем методы в каждом ряду по позиции
        for row_number in rows:
            rows[row_number].sort(key=lambda x: x[2])
        
        # Добавляем кнопки по рядам
        for row_number in sorted(rows.keys()):
            row_buttons = []
            for method_id, method_name, position_in_row in rows[row_number]:
                # Создаем callback_data в зависимости от метода
                callback_data = f"order_pay_{method_id}_{code}"
                button = InlineKeyboardButton(method_name, callback_data=callback_data)
                row_buttons.append(button)
                print(f"Добавлена кнопка: {button}")
            
            if row_buttons:
                keyboard.row(*row_buttons)
            print(f"Добавлена строка {row_number}: {row_buttons}")

        # Кнопка отменить заказ
        cancel_button = InlineKeyboardButton("🚫 Отменить заказ", callback_data=f"cancel_order_{code}")
        keyboard.row(cancel_button)
        print(f"Добавлена кнопка отмены: {cancel_button}")
        print(f"Финальная клавиатура: {keyboard}")
        print(f"Тип финальной клавиатуры: {type(keyboard)}")

        # Проверяем, что клавиатура корректна
        if keyboard is None or not hasattr(keyboard, 'inline_keyboard'):
            print("Ошибка: неверный формат клавиатуры!")
            # Создаем фолбэк клавиатуру
            fallback_keyboard = InlineKeyboardMarkup()
            fallback_keyboard.add(InlineKeyboardButton("🚫 Отменить заказ", callback_data=f"cancel_order_{code}"))
            return fallback_keyboard

        return keyboard
    except Exception as e:
        print(f"Ошибка при генерации клавиатуры: {e}")
        import traceback
        traceback.print_exc()
        # Возвращаем пустую клавиатуру в случае ошибки
        keyboard = InlineKeyboardMarkup()
        keyboard.add(InlineKeyboardButton("🚫 Отменить заказ", callback_data=f"cancel_order_{code}"))
        print(f"Аварийная клавиатура: {keyboard}")
        return keyboard

def order_payment_confirm_kb(code: str):
    """Клавиатура подтверждения оплаты заказа"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.row(
        InlineKeyboardButton("🔗 Перейти к оплате", callback_data=f"confirm_order_payment_{code}")
    )
    keyboard.row(
        InlineKeyboardButton("🚫 Отменить заказ", callback_data=f"cancel_order_{code}")
    )
    return keyboard

def order_cancel_confirm_kb(code: str):
    """Клавиатура подтверждения отмены заказа"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.row(
        InlineKeyboardButton("♻️ Я передумал", callback_data=f"back_to_order_{code}")
    )
    keyboard.row(
        InlineKeyboardButton("🚫 Точно отменить", callback_data=f"confirm_cancel_order_{code}")
    )
    return keyboard

def back_to_product_kb(product_id: int):
    """Кнопка возврата к товару"""
    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton("❰ Вернуться к товару", callback_data=f"view_product_{product_id}")
    )
    return keyboard

# Админ-кнопки для товара
def admin_product_actions_kb(product_id: int):
    """Клавиатура действий админа для товара"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("✏️ Изменить товар", callback_data=f"admin_edit_product_{product_id}"),
        InlineKeyboardButton("🗑 Удалить товар", callback_data=f"admin_delete_product_{product_id}")
    )
    return keyboard

def admin_edit_product_menu_kb(product_id: int):
    """Меню редактирования товара для админа"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("🖼 Фото", callback_data=f"admin_edit_product_photo_{product_id}"),
        InlineKeyboardButton("📝 Название", callback_data=f"admin_edit_product_name_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("📄 Описание", callback_data=f"admin_edit_product_desc_{product_id}"),
        InlineKeyboardButton("🔗 Превью‑ссылка", callback_data=f"admin_edit_product_preview_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("💰 Цена", callback_data=f"admin_edit_product_price_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("📁 Файлы товара", callback_data=f"admin_edit_product_files_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("📐 Выравнивание", callback_data=f"admin_edit_product_row_width_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data=f"view_product_{product_id}")
    )
    return keyboard

def admin_product_files_kb(product_id: int, files: list):
    """Список файлов товара + кнопки добавления/удаления"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    if files:
        for f in files:
            file_db_id, file_id, file_type, file_name, position, day_period = f
            label = file_name or f"{file_type} #{file_db_id}"
            if day_period is not None:
                label += f" ({day_period} дн.)"
            keyboard.add(InlineKeyboardButton(f"🗂 {label}", callback_data="noop"))
            keyboard.add(InlineKeyboardButton("🗑 Удалить", callback_data=f"admin_delete_product_file_{file_db_id}_{product_id}"))
    else:
        keyboard.add(InlineKeyboardButton("Нет файлов", callback_data="noop"))
    keyboard.add(InlineKeyboardButton("➕ Добавить файл", callback_data=f"admin_add_product_file_{product_id}"))
    keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_product_{product_id}"))
    return keyboard

def admin_edit_row_width_kb(product_id: int, current_width: int = 1):
    """Клавиатура выбора выравнивания (row_width)"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("1 кнопка в ряду" if current_width == 1 else "1 кнопка в ряду", callback_data=f"admin_set_row_width_{product_id}_1"),
        InlineKeyboardButton("2 кнопки в ряду" if current_width == 2 else "2 кнопки в ряду", callback_data=f"admin_set_row_width_{product_id}_2")
    )
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_product_{product_id}")
    )
    return keyboard

# Клавиатуры для редактирования категорий и тем
def admin_edit_category_menu_kb(category_id: int):
    """Меню редактирования категории для админа"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("📝 Название", callback_data=f"admin_edit_category_name_{category_id}"),
        InlineKeyboardButton("📄 Описание", callback_data=f"admin_edit_category_desc_{category_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🎦 Стикер", callback_data=f"admin_edit_category_sticker_{category_id}"),
        InlineKeyboardButton("🖼 Фото", callback_data=f"admin_edit_category_photo_{category_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔗 Превью-ссылка", callback_data=f"admin_edit_category_preview_{category_id}")
    )
    keyboard.add(
        InlineKeyboardButton("📀 Выравнивание", callback_data=f"admin_edit_category_row_width_{category_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🗑 Удалить категорию", callback_data=f"admin_delete_category_{category_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{category_id}")
    )
    return keyboard

def admin_edit_theme_menu_kb(theme_id: int):
    """Меню редактирования темы для админа"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("📝 Название", callback_data=f"admin_edit_theme_name_{theme_id}"),
        InlineKeyboardButton("📄 Описание", callback_data=f"admin_edit_theme_desc_{theme_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🎦 Стикер", callback_data=f"admin_edit_theme_sticker_{theme_id}"),
        InlineKeyboardButton("🖼 Фото", callback_data=f"admin_edit_theme_photo_{theme_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔗 Превью-ссылка", callback_data=f"admin_edit_theme_preview_{theme_id}")
    )
    keyboard.add(
        InlineKeyboardButton("📀 Выравнивание", callback_data=f"admin_edit_theme_row_width_{theme_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🗑 Удалить тему", callback_data=f"admin_delete_theme_{theme_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data=f"view_theme_{theme_id}")
    )
    return keyboard

def admin_edit_subcategory_menu_kb(subcategory_id: int):
    """Меню редактирования подкатегории для админа"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("📝 Название", callback_data=f"admin_edit_subcategory_name_{subcategory_id}"),
        InlineKeyboardButton("📄 Описание", callback_data=f"admin_edit_subcategory_desc_{subcategory_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🎦 Стикер", callback_data=f"admin_edit_subcategory_sticker_{subcategory_id}"),
        InlineKeyboardButton("🖼 Фото", callback_data=f"admin_edit_subcategory_photo_{subcategory_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔗 Превью-ссылка", callback_data=f"admin_edit_subcategory_preview_{subcategory_id}")
    )
    keyboard.add(
        InlineKeyboardButton("📀 Выравнивание", callback_data=f"admin_edit_subcategory_row_width_{subcategory_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🗑 Удалить подкатегорию", callback_data=f"admin_delete_subcategory_{subcategory_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data=f"view_subcategory_{subcategory_id}")
    )
    return keyboard

def admin_edit_catalog_item_row_width_kb(item_id: int, current_width: int = 1, item_type: str = 'category'):
    """Клавиатура выбора выравнивания для каталоговых элементов"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("1 кнопка в ряду" if current_width == 1 else "1 кнопка в ряду", callback_data=f"admin_set_catalog_row_width_{item_id}_{item_type}_1"),
        InlineKeyboardButton("2 кнопки в ряду" if current_width == 2 else "2 кнопки в ряду", callback_data=f"admin_set_catalog_row_width_{item_id}_{item_type}_2")
    )
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data=f"admin_edit_{item_type}_{item_id}")
    )
    return keyboard

def generate_order_code():
    """Генерируем короткий случайный код для заказа в формате Z70D4SO"""
    # Формат: буква + 2 цифры + буква + цифра + 2 буквы
    letters = string.ascii_uppercase
    digits = string.digits
    
    code = (
        random.choice(letters) +           # Первая буква
        ''.join(random.choices(digits, k=2)) +  # 2 цифры
        random.choice(letters) +               # Буква
        random.choice(digits) +                # Цифра
        ''.join(random.choices(letters, k=2))   # 2 буквы
    )
    
    return code

# Клавиатуры для управления администраторами
def admin_management_kb():
    """Клавиатура для управления администраторами"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("➕ Добавить админа", callback_data="add_admin"),
        InlineKeyboardButton("❌ Удалить админа", callback_data="remove_admin")
    )
    keyboard.add(
        InlineKeyboardButton("📝 Список админов", callback_data="list_admins")
    )
    return keyboard

def admin_list_kb(admins):
    """Клавиатура со списком администраторов"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    
    # Показываем только первых 10 админов для удобства
    for admin in admins[:10]:
        user_id, username, added_by, added_at = admin
        display_name = username if username else f"ID: {user_id}"
        btn_text = f"{display_name} ({added_at})"
        
        # Не даем возможность удалять главного админа
        from config import cfg
        if user_id != cfg.ADMIN_ID:
            keyboard.add(InlineKeyboardButton(
                btn_text,
                callback_data=f"remove_admin_confirm_{user_id}"
            ))
        else:
            keyboard.add(InlineKeyboardButton(
                f"🔒 {btn_text} (Главный)",
                callback_data="noop"  # Ничего не делаем
            ))
    
    keyboard.add(
        InlineKeyboardButton("🔙 Назад к управлению", callback_data="back_to_admin_management")
    )
    return keyboard

def back_to_admin_management_kb():
    """Клавиатура возврата к управлению админами"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("🔙 Назад к управлению", callback_data="back_to_admin_management")
    )
    return keyboard

# Клавиатуры для рассылки
def broadcast_main_kb():
    """Главная клавиатура рассылки"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("📢 Выслать всем пользователям", callback_data="broadcast_all_users"),
        InlineKeyboardButton("📢 Выслать отдельному пользователю", callback_data="broadcast_individual_user")
    )
    return keyboard

def broadcast_skip_kb(callback_data: str):
    """Клавиатура для пропуска шагов в рассылке"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("⟭️ Пропустить", callback_data=callback_data),
        InlineKeyboardButton("🚫 Отменить", callback_data="cancel_broadcast")
    )
    return keyboard

def broadcast_confirm_kb(broadcast_type: str):
    """Клавиатура подтверждения рассылки"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("✅ Отправить", callback_data=f"confirm_broadcast_{broadcast_type}"),
        InlineKeyboardButton("✏️ Редактировать", callback_data=f"edit_broadcast_{broadcast_type}"),
        InlineKeyboardButton("🚫 Отменить", callback_data="cancel_broadcast")
    )
    return keyboard

def back_to_broadcast_kb():
    """Клавиатура возврата к рассылке"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("🔙 Назад к рассылке", callback_data="back_to_broadcast")
    )
    return keyboard

def broadcast_product_edit_kb(product_id: int):
    """Клавиатура редактирования товара для рассылки"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("📝 Изменить описание", callback_data=f"broadcast_edit_desc_{product_id}"),
        InlineKeyboardButton("🖼 Изменить фото", callback_data=f"broadcast_edit_photo_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔗 Изменить preview", callback_data=f"broadcast_edit_preview_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("✅ Подтвердить рассылку", callback_data=f"broadcast_product_confirm_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data="broadcast_product")
    )
    return keyboard

def broadcast_product_target_kb(product_id: int):
    """Клавиатура выбора цели рассылки товара"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("📢 Разослать всем", callback_data=f"broadcast_product_all_{product_id}"),
        InlineKeyboardButton("👤 Разослать отдельным", callback_data=f"broadcast_product_individual_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔙 Назад", callback_data="broadcast_product")
    )
    return keyboard

def product_buy_button_kb(product_id: int):
    """Клавиатура с кнопкой покупки для рассылки"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("💳 Купить", callback_data=f"buy_product_{product_id}")
    )
    return keyboard

async def create_products_selection_keyboard(page: int = 0, products_per_page: int = 10):
    """Создает клавиатуру для выбора товаров с пагинацией"""
    from database import db
    
    # Получаем все товары
    cursor = await db.conn.execute('''
        SELECT id, name, description FROM catalog_items 
        WHERE type = 'product' AND is_visible = TRUE
        ORDER BY name ASC
    ''')
    all_products = await cursor.fetchall()
    
    total_products = len(all_products)
    total_pages = (total_products + products_per_page - 1) // products_per_page
    
    # Получаем товары для текущей страницы
    start_idx = page * products_per_page
    end_idx = start_idx + products_per_page
    page_products = all_products[start_idx:end_idx]
    
    keyboard = InlineKeyboardMarkup(row_width=1)
    
    # Добавляем кнопки товаров
    for product_id, name, description in page_products:
        # Обрезаем название для кнопки
        display_name = name[:40] + '...' if len(name) > 40 else name
        keyboard.add(
            InlineKeyboardButton(display_name, callback_data=f"select_product_{product_id}")
        )
    
    # Навигация
    nav_buttons = []
    if page > 0:
        nav_buttons.append(InlineKeyboardButton("◀️ Назад", callback_data=f"products_page_{page-1}"))
    if page < total_pages - 1:
        nav_buttons.append(InlineKeyboardButton("▶️ Далее", callback_data=f"products_page_{page+1}"))
    
    if nav_buttons:
        if len(nav_buttons) == 2:
            keyboard.row(*nav_buttons)
        else:
            keyboard.add(nav_buttons[0])
    
    # Кнопка отмены
    keyboard.add(
        InlineKeyboardButton("🚫 Отмена", callback_data="cancel_broadcast")
    )
    
    return keyboard, total_products, page + 1, total_pages

# Клавиатуры для 3x6 сетки
async def create_3x6_grid_keyboard(items, page=0, search_button_name=None, back_button_text=None, parent_id=None, is_search_results=False, is_admin=False, search_at_bottom=False):
    """Создает клавиатуру сетки 3x6 с пагинацией"""
    keyboard = InlineKeyboardMarkup(row_width=3)
    
    # Количество элементов на странице (3x6 = 18)
    items_per_page = 18
    total_pages = (len(items) + items_per_page - 1) // items_per_page
    
    # Получаем элементы для текущей страницы
    start_idx = page * items_per_page
    end_idx = start_idx + items_per_page
    page_items = items[start_idx:end_idx]
    
    # Добавляем кнопку поиска в верхней части (только если это не результаты поиска и не внизу)
    if search_button_name and not is_search_results and not search_at_bottom and total_pages > 1:
        keyboard.row(
            InlineKeyboardButton(search_button_name, callback_data=f"search_in_category_{parent_id}")
        )
    
    # Добавляем элементы сетки 3x6
    current_row = []
    for item in page_items:
        # Распаковываем с учетом новых колонок
        if len(item) >= 10:
            item_id, item_type, name, description, sticker_id, photo_id, preview_link, row_width, position, is_grid_3x6 = item[:10]
        else:
            item_id, item_type, name, description, sticker_id, photo_id, preview_link, row_width, position = item[:9]
            is_grid_3x6 = False
        
        # Определяем callback_data в зависимости от типа
        if item_type == 'theme':
            callback_data = f"view_theme_{item_id}"
        elif item_type == 'category':
            callback_data = f"view_category_{item_id}"
        elif item_type == 'subcategory':
            callback_data = f"view_subcategory_{item_id}"
        elif item_type == 'product':
            callback_data = f"view_product_{item_id}"
        else:
            continue
        
        # Создаем кнопку
        button_text = name if name else description
        
        # Для товаров добавляем цену к названию кнопки
        if item_type == 'product':
            try:
                from database import db
                price_info = await db.get_product_price(item_id)
                if price_info and price_info[0] is not None:
                    price, currency = price_info
                    price_rub = price / 100  # Конвертируем из копеек в рубли
                    button_text = f"{button_text} • {price_rub:.0f}₽"
            except Exception as e:
                print(f"Ошибка получения цены для товара {item_id}: {e}")
        
        button = InlineKeyboardButton(button_text, callback_data=callback_data)
        
        current_row.append(button)
        
        # Когда собрали 3 кнопки, добавляем ряд
        if len(current_row) == 3:
            keyboard.row(*current_row)
            current_row = []
    
    # Добавляем оставшиеся кнопки
    if current_row:
        keyboard.row(*current_row)
    
    # Добавляем кнопки пагинации (если страниц больше 1)
    if total_pages > 1:
        pagination_row = []
        
        # Кнопка влево
        if page > 0:
            pagination_row.append(InlineKeyboardButton("❮", callback_data=f"grid_page_{parent_id}_{page-1}"))
        else:
            pagination_row.append(InlineKeyboardButton("❮", callback_data="noop"))  # Неактивная кнопка
        
        # Информация о странице
        pagination_row.append(InlineKeyboardButton(f"{page + 1}/{total_pages}", callback_data="noop"))
        
        # Кнопка вправо
        if page < total_pages - 1:
            pagination_row.append(InlineKeyboardButton("❯", callback_data=f"grid_page_{parent_id}_{page+1}"))
        else:
            pagination_row.append(InlineKeyboardButton("❯", callback_data="noop"))  # Неактивная кнопка
        
        keyboard.row(*pagination_row)
    
    # Добавляем кнопки для результатов поиска
    if is_search_results:
        keyboard.row(
            InlineKeyboardButton("🔄 Повторить поиск", callback_data=f"search_in_category_{parent_id}")
        )
    
    # Добавляем кнопку поиска внизу (если указано)
    if search_button_name and not is_search_results and search_at_bottom and total_pages > 1:
        keyboard.row(
            InlineKeyboardButton(search_button_name, callback_data=f"search_in_category_{parent_id}")
        )
    
    # Добавляем кнопки админа для 3x6 категорий (только если не результаты поиска)
    if is_admin and not is_search_results:
        admin_buttons = []
        if parent_id:
            # Для категорий добавляем кнопки добавления подкатегорий и товаров
            admin_buttons.extend([
                InlineKeyboardButton("➕ Добавить категорию", callback_data=f"add_subcategory_{parent_id}"),
                InlineKeyboardButton("➕ Добавить товар", callback_data=f"add_product_{parent_id}")
            ])
        else:
            # Корневой каталог: даже если пуст, показываем добавление тем
            admin_buttons.append(InlineKeyboardButton("➕ Добавить тему", callback_data="add_theme"))
        
        # Добавляем кнопки добавления
        for btn in admin_buttons:
            keyboard.row(btn)
        
        # Добавляем кнопки редактирования для текущей категории (только для 3x6 сетки)
        if parent_id:
            from database import db
            try:
                parent_item = await db.get_catalog_item(parent_id)
                if parent_item:
                    parent_type = parent_item[2]  # type column
                    edit_buttons = []
                    if parent_type == 'theme':
                        edit_buttons.append(InlineKeyboardButton("✏️ Изменить тему", callback_data=f"admin_edit_theme_{parent_id}"))
                    elif parent_type == 'category':
                        edit_buttons.append(InlineKeyboardButton("✏️ Изменить категорию", callback_data=f"admin_edit_category_{parent_id}"))
                    elif parent_type == 'subcategory':
                        edit_buttons.append(InlineKeyboardButton("✏️ Изменить подкатегорию", callback_data=f"admin_edit_subcategory_{parent_id}"))
                    
                    # Добавляем кнопки редактирования
                    for btn in edit_buttons:
                        keyboard.row(btn)
            except Exception as e:
                # Игнорируем ошибки при получении родительского элемента
                pass
    
    # Кнопка назад
    if back_button_text:
        keyboard.row(
            InlineKeyboardButton(f"❮ Назад {back_button_text}", callback_data=f"view_parent_{parent_id}")
        )
    elif parent_id:
        keyboard.row(
            InlineKeyboardButton("🔙 Назад", callback_data=f"view_parent_{parent_id}")
        )
    
    return keyboard

def search_results_kb(parent_id: int, back_button_text: str = None):
    """Клавиатура для поиска"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    
    # Кнопка назад
    if back_button_text:
        keyboard.add(
            InlineKeyboardButton(f"❮ Назад {back_button_text}", callback_data=f"view_category_{parent_id}")
        )
    else:
        keyboard.add(
            InlineKeyboardButton("🔙 Назад", callback_data=f"view_category_{parent_id}")
        )
    
    return keyboard

def expiration_days_selection_kb(product_id: int, expiration_days: str, current_days: int, base_price: float, files_count: int = 1, current_quantity: int = 1, files_count_by_days: dict = None, user_id: int = None, product_parent_id: int = None):
    """Клавиатура для выбора количества дней действия и количества товара"""
    keyboard = InlineKeyboardMarkup()
    
    # Парсим доступные дни
    available_days = [int(day.strip()) for day in expiration_days.split(',')]
    min_days = min(available_days)
    
    # Находим текущий индекс в списке
    try:
        current_index = available_days.index(current_days)
    except ValueError:
        current_index = 0
        current_days = available_days[0]
    
    # Кнопки уменьшения/увеличения дней
    days_row = []
    
    # Кнопка уменьшения дней
    if current_index > 0:
        prev_days = available_days[current_index - 1]
        days_row.append(InlineKeyboardButton("➖", callback_data=f"days_dec_{product_id}_{prev_days}_{current_quantity}"))
    else:
        days_row.append(InlineKeyboardButton("➖", callback_data="days_min_reached"))
    
    # Текущее количество дней и цена
    additional_days = current_days - min_days
    price_multiplier = 1 + (additional_days * 0.9 / min_days) if min_days > 0 else 1
    unit_price = base_price * price_multiplier
    
    days_row.append(InlineKeyboardButton(
        f"{current_days} дней", 
        callback_data=f"days_selected_{product_id}_{current_days}_{current_quantity}"
    ))
    
    # Кнопка увеличения дней
    if current_index < len(available_days) - 1:
        next_days = available_days[current_index + 1]
        days_row.append(InlineKeyboardButton("➕", callback_data=f"days_inc_{product_id}_{next_days}_{current_quantity}"))
    else:
        days_row.append(InlineKeyboardButton("➕", callback_data="days_max_reached"))
    
    keyboard.row(*days_row)
    
    # Получаем количество файлов для текущего периода дней
    current_day_files_count = files_count_by_days.get(current_days, 0) if files_count_by_days else files_count
    
    # Кнопки выбора количества (если есть несколько файлов)
    if current_day_files_count > 1:
        # Первая строка: уменьшить на 1, текущее количество, увеличить на 1
        qty_row1 = []
        
        # Кнопка уменьшения количества на 1
        if current_quantity > 1:
            qty_row1.append(InlineKeyboardButton("🔻", callback_data=f"qty_dec_days_{product_id}_{current_days}_{current_quantity-1}"))
        else:
            qty_row1.append(InlineKeyboardButton("🔻", callback_data="qty_min_reached"))
        
        # Текущее количество
        total_price = unit_price * current_quantity
        qty_row1.append(InlineKeyboardButton(
            f"{current_quantity} шт.", 
            callback_data=f"qty_selected_{product_id}_{current_days}_{current_quantity}"
        ))
        
        # Кнопка увеличения количества на 1
        if current_quantity < current_day_files_count:
            qty_row1.append(InlineKeyboardButton("🔺", callback_data=f"qty_inc_days_{product_id}_{current_days}_{current_quantity+1}"))
        else:
            qty_row1.append(InlineKeyboardButton("🔺", callback_data="qty_max_reached"))
        
        keyboard.row(*qty_row1)
        
        # Вторая строка: уменьшить на 10, увеличить на 10
        qty_row2 = []
        
        # Кнопка уменьшения на 10
        if current_quantity > 10:
            new_qty = current_quantity - 10
            qty_row2.append(InlineKeyboardButton("🔻10", callback_data=f"qty_dec_days_{product_id}_{current_days}_{new_qty}"))
        elif current_quantity > 1:
            # Если количество меньше 10, но больше 1, уменьшаем до 1
            qty_row2.append(InlineKeyboardButton("🔻10", callback_data=f"qty_dec_days_{product_id}_{current_days}_1"))
        else:
            qty_row2.append(InlineKeyboardButton("🔻10", callback_data="qty_min_reached"))
        
        # Кнопка увеличения на 10
        if current_quantity + 10 <= current_day_files_count:
            new_qty = current_quantity + 10
            qty_row2.append(InlineKeyboardButton("🔺10", callback_data=f"qty_inc_days_{product_id}_{current_days}_{new_qty}"))
        elif current_quantity < current_day_files_count:
            # Если нельзя добавить 10, но можно добавить до максимума
            qty_row2.append(InlineKeyboardButton("🔺10", callback_data=f"qty_inc_days_{product_id}_{current_days}_{current_day_files_count}"))
        else:
            qty_row2.append(InlineKeyboardButton("🔺10", callback_data="qty_max_reached"))
        
        keyboard.row(*qty_row2)
        
        # Кнопка покупки с учетом количества
        keyboard.add(InlineKeyboardButton(
            f"💳 Купить за {total_price:.2f}₽", 
            callback_data=f"buy_product_{product_id}_{current_days}_{current_quantity}"
        ))
    else:
        # Один файл - обычная кнопка покупки
        keyboard.add(InlineKeyboardButton(
            f"💳 Купить за {unit_price:.2f}₽", 
            callback_data=f"buy_product_{product_id}_{current_days}_1"
        ))
    
    # Добавляем кнопки промокода и поделиться
    keyboard.add(
        InlineKeyboardButton("🎁 Есть промокод", callback_data=f"promo_code_{product_id}")
    )
    keyboard.add(
        InlineKeyboardButton("🔗 Поделиться", callback_data=f"share_product_{product_id}")
    )
    
    # Кнопка назад к родительской категории
    keyboard.add(InlineKeyboardButton("🔙 Назад", callback_data=f"view_parent_{product_id}"))
    #бота создал @pravitelstvo_russian
    return keyboard

def create_skip_cancel_kb(skip_callback: str, cancel_callback: str):
    """Создает клавиатуру с кнопками Пропустить и Отменить"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("⏭ Пропустить", callback_data=skip_callback),
        InlineKeyboardButton("❌ Отменить", callback_data=cancel_callback)
    )
    return keyboard

def create_alignment_kb(callback_prefix: str):
    """Создает клавиатуру для выбора выравнивания (1 или 2 кнопки в ряду)"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("1️⃣ Одна кнопка", callback_data=f"{callback_prefix}_1"),
        InlineKeyboardButton("2️⃣ Две кнопки", callback_data=f"{callback_prefix}_2")
    )
    keyboard.add(
        InlineKeyboardButton("❌ Отменить", callback_data="cancel_catalog_creation")
    )
    return keyboard

def create_skip_cancel_alignment_kb(skip_callback: str, cancel_callback: str, alignment_prefix: str):
    """Создает клавиатуру для выравнивания с кнопками пропустить и отменить"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("1️⃣ Одна кнопка", callback_data=f"{alignment_prefix}_1"),
        InlineKeyboardButton("2️⃣ Две кнопки", callback_data=f"{alignment_prefix}_2")
    )
    keyboard.add(
        InlineKeyboardButton("⏭ Пропустить (по умолчанию 1)", callback_data=skip_callback)
    )
    keyboard.add(
        InlineKeyboardButton("❌ Отменить", callback_data=cancel_callback)
    )
    return keyboard

def create_grid_choice_kb(skip_callback: str, cancel_callback: str):
    """Создает клавиатуру для выбора 3x6 сетки"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton("📄 Обычное - списком", callback_data="choose_normal_layout")
    )
    keyboard.add(
        InlineKeyboardButton("🎯 3x6 сетка (по умолчанию)", callback_data="choose_3x6_grid")
    )
    keyboard.add(
        InlineKeyboardButton("⚙️ Ручная настройка сетки", callback_data="choose_manual_grid")
    )
    keyboard.add(
        InlineKeyboardButton("❌ Отменить", callback_data=cancel_callback)
    )
    return keyboard

def create_confirmation_kb(confirm_callback: str, cancel_callback: str, action_name: str):
    """Создает клавиатуру подтверждения отмены"""
    keyboard = InlineKeyboardMarkup(row_width=1)
    keyboard.add(
        InlineKeyboardButton(f"✅ Да, отменить {action_name}", callback_data=confirm_callback)
    )
    keyboard.add(
        InlineKeyboardButton("❌ Нет, продолжить", callback_data=cancel_callback)
    )
    return keyboard