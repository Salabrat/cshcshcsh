import asyncio
import aiosqlite

# List of additional countries to add with their flags
additional_countries = [
    # European countries
    ("🇦🇱Албания", "Albania"),
    ("🇦🇩Андорра", "Andorra"),
    ("🇦🇲Армения", "Armenia"),
    ("🇦🇿Азербайджан", "Azerbaijan"),
    ("🇧🇾Беларусь", "Belarus"),
    ("🇧🇦Босния и Герцеговина", "Bosnia and Herzegovina"),
    ("🇧🇬Болгария", "Bulgaria"),
    ("🇭🇷Хорватия", "Croatia"),
    ("🇨🇾Кипр", "Cyprus"),
    ("🇨🇿Чехия", "Czech Republic"),
    ("🇩🇰Дания", "Denmark"),
    ("🇪🇪Эстония", "Estonia"),
    ("🇫🇴Фарерские острова", "Faroe Islands"),
    ("🇫🇮Финляндия", "Finland"),
    ("🇬🇪Грузия", "Georgia"),
    ("🇬🇮Гибралтар", "Gibraltar"),
    ("🇬🇱Гренландия", "Greenland"),
    ("🇬🇬Гернси", "Guernsey"),
    ("🇭🇺Венгрия", "Hungary"),
    ("🇮🇸Исландия", "Iceland"),
    ("🇮🇲Остров Мэн", "Isle of Man"),
    ("🇯🇪Джерси", "Jersey"),
    ("🇱🇻Латвия", "Latvia"),
    ("🇱🇮Лихтенштейн", "Liechtenstein"),
    ("🇱🇹Литва", "Lithuania"),
    ("🇱🇺Люксембург", "Luxembourg"),
    ("🇲🇹Мальта", "Malta"),
    ("🇲🇩Молдова", "Moldova"),
    ("🇲🇨Монако", "Monaco"),
    ("🇲🇪Черногория", "Montenegro"),
    ("🇳🇱Нидерланды", "Netherlands"),
    ("🇲🇰Северная Македония", "North Macedonia"),
    ("🇳🇴Норвегия", "Norway"),
    ("🇵🇱Польша", "Poland"),
    ("🇵🇹Португалия", "Portugal"),
    ("🇷🇴Румыния", "Romania"),
    ("🇸🇲Сан-Марино", "San Marino"),
    ("🇷🇸Сербия", "Serbia"),
    ("🇸🇰Словакия", "Slovakia"),
    ("🇸🇮Словения", "Slovenia"),
    ("🇪🇸Испания", "Spain"),
    ("🇸🇯Шпицберген и Ян-Майен", "Svalbard and Jan Mayen"),
    ("🇸🇪Швеция", "Sweden"),
    ("🇨🇭Швейцария", "Switzerland"),
    ("🇹🇷Турция", "Turkey"),
    ("🇬🇧Великобритания", "United Kingdom"),
    ("🇻🇦Ватикан", "Vatican City"),

    # Asian countries
    ("🇦🇫Афганистан", "Afghanistan"),
    ("🇧🇭Бахрейн", "Bahrain"),
    ("🇧🇩Бангладеш", "Bangladesh"),
    ("🇧🇹Бутан", "Bhutan"),
    ("🇧🇳Бруней", "Brunei"),
    ("🇰🇭Камбоджа", "Cambodia"),
    ("🇨🇳Китай", "China"),
    ("🇭🇰Гонконг", "Hong Kong"),
    ("🇮🇳Индия", "India"),
    ("🇮🇩Индонезия", "Indonesia"),
    ("🇮🇷Иран", "Iran"),
    ("🇮🇶Ирак", "Iraq"),
    ("🇮🇱Израиль", "Israel"),
    ("🇯🇵Япония", "Japan"),
    ("🇯🇴Иордания", "Jordan"),
    ("🇰🇿Казахстан", "Kazakhstan"),
    ("🇰🇼Кувейт", "Kuwait"),
    ("🇰🇬Киргизия", "Kyrgyzstan"),
    ("🇱🇦Лаос", "Laos"),
    ("🇱🇧Ливан", "Lebanon"),
    ("🇲🇴Макао", "Macao"),
    ("🇲🇾Малайзия", "Malaysia"),
    ("🇲🇻Мальдивы", "Maldives"),
    ("🇲🇳Монголия", "Mongolia"),
    ("🇲🇲Мьянма", "Myanmar"),
    ("🇳🇵Непал", "Nepal"),
    ("🇰🇵Северная Корея", "North Korea"),
    ("🇴🇲Оман", "Oman"),
    ("🇵🇰Пакистан", "Pakistan"),
    ("🇵🇸Палестина", "Palestine"),
    ("🇵🇭Филиппины", "Philippines"),
    ("🇶🇦Катар", "Qatar"),
    ("🇸🇦Саудовская Аравия", "Saudi Arabia"),
    ("🇸🇬Сингапур", "Singapore"),
    ("🇰🇷Южная Корея", "South Korea"),
    ("🇱🇰Шри-Ланка", "Sri Lanka"),
    ("🇸🇾Сирия", "Syria"),
    ("🇹🇼Тайвань", "Taiwan"),
    ("🇹🇯Таджикистан", "Tajikistan"),
    ("🇹🇭Таиланд", "Thailand"),
    ("🇹🇱Восточный Тимор", "Timor-Leste"),
    ("🇹🇲Туркменистан", "Turkmenistan"),
    ("🇦🇪Объединенные Арабские Эмираты", "United Arab Emirates"),
    ("🇺🇿Узбекистан", "Uzbekistan"),
    ("🇻🇳Вьетнам", "Vietnam"),
    ("🇾🇪Йемен", "Yemen"),

    # African countries
    ("🇩🇿Алжир", "Algeria"),
    ("🇦🇴Ангола", "Angola"),
    ("🇧🇯Бенин", "Benin"),
    ("🇧🇼Ботсвана", "Botswana"),
    ("🇧🇫Буркина-Фасо", "Burkina Faso"),
    ("🇧🇮Бурунди", "Burundi"),
    ("🇨🇲Камерун", "Cameroon"),
    ("🇨🇻Кабо-Верде", "Cape Verde"),
    ("🇨🇫Центрально-Африканская Республика", "Central African Republic"),
    ("🇹🇩Чад", "Chad"),
    ("🇰🇲Коморы", "Comoros"),
    ("🇨🇬Конго", "Congo"),
    ("🇨🇩Демократическая Республика Конго", "Democratic Republic of the Congo"),
    ("🇨🇮Кот-д'Ивуар", "Côte d'Ivoire"),
    ("🇩🇯Джибути", "Djibouti"),
    ("🇪🇬Египет", "Egypt"),
    ("🇬🇶Экваториальная Гвинея", "Equatorial Guinea"),
    ("🇪🇷Эритрея", "Eritrea"),
    ("🇪🇹Эфиопия", "Ethiopia"),
    ("🇬🇦Габон", "Gabon"),
    ("🇬🇲Гамбия", "Gambia"),
    ("🇬🇭Гана", "Ghana"),
    ("🇬🇳Гвинея", "Guinea"),
    ("🇬🇼Гвинея-Бисау", "Guinea-Bissau"),
    ("🇰🇪Кения", "Kenya"),
    ("🇱🇸Лесото", "Lesotho"),
    ("🇱🇷Либерия", "Liberia"),
    ("🇱🇾Ливия", "Libya"),
    ("🇲🇬Мадагаскар", "Madagascar"),
    ("🇲🇼Малави", "Malawi"),
    ("🇲🇱Мали", "Mali"),
    ("🇲🇷Мавритания", "Mauritania"),
    ("🇲🇺Маврикий", "Mauritius"),
    ("🇲🇦Марокко", "Morocco"),
    ("🇲🇿Мозамбик", "Mozambique"),
    ("🇳🇦Намибия", "Namibia"),
    ("🇳🇪Нигер", "Niger"),
    ("🇳🇬Нигерия", "Nigeria"),
    ("🇷🇼Руанда", "Rwanda"),
    ("🇸🇹Сан-Томе и Принсипи", "Sao Tome and Principe"),
    ("🇸🇳Сенегал", "Senegal"),
    ("🇸🇨Сейшельские острова", "Seychelles"),
    ("🇸🇱Сьерра-Леоне", "Sierra Leone"),
    ("🇸🇴Сомали", "Somalia"),
    ("🇿🇦Южно-Африканская Республика", "South Africa"),
    ("🇸🇸Южный Судан", "South Sudan"),
    ("🇸🇩Судан", "Sudan"),
    ("🇸🇿Эсватини", "Eswatini"),
    ("🇹🇿Танзания", "Tanzania"),
    ("🇹🇬Того", "Togo"),
    ("🇹🇳Тунис", "Tunisia"),
    ("🇺🇬Уганда", "Uganda"),
    ("🇿🇲Замбия", "Zambia"),
    ("🇿🇼Зимбабве", "Zimbabwe"),

    # American countries
    ("🇦🇮Ангилья", "Anguilla"),
    ("🇦🇬Антигуа и Барбуда", "Antigua and Barbuda"),
    ("🇦🇷Аргентина", "Argentina"),
    ("🇦🇼Аруба", "Aruba"),
    ("🇧🇸Багамы", "Bahamas"),
    ("🇧🇧Барбадос", "Barbados"),
    ("🇧🇿Белиз", "Belize"),
    ("🇧🇲Бермуды", "Bermuda"),
    ("🇧🇴Боливия", "Bolivia"),
    ("🇧🇶Бонэйр, Синт-Эстатиус и Саба", "Bonaire, Sint Eustatius and Saba"),
    ("🇧🇷Бразилия", "Brazil"),
    ("🇻🇬Британские Виргинские острова", "British Virgin Islands"),
    ("🇨🇦Канада", "Canada"),
    ("🇰🇾Каймановы острова", "Cayman Islands"),
    ("🇨🇱Чили", "Chile"),
    ("🇨🇴Колумбия", "Colombia"),
    ("🇨🇷Коста-Рика", "Costa Rica"),
    ("🇨🇺Куба", "Cuba"),
    ("🇨🇼Кюрасао", "Curaçao"),
    ("🇩🇲Доминика", "Dominica"),
    ("🇩🇴Доминиканская Республика", "Dominican Republic"),
    ("🇪🇨Эквадор", "Ecuador"),
    ("🇸🇻Сальвадор", "El Salvador"),
    ("🇫🇰Фолклендские острова", "Falkland Islands"),
    ("🇬🇫Французская Гвиана", "French Guiana"),
    ("🇬🇩Гренада", "Grenada"),
    ("🇬🇵Гваделупа", "Guadeloupe"),
    ("🇬🇹Гватемала", "Guatemala"),
    ("🇬🇾Гайана", "Guyana"),
    ("🇭🇹Гаити", "Haiti"),
    ("🇭🇳Гондурас", "Honduras"),
    ("🇯🇲Ямайка", "Jamaica"),
    ("🇲🇶Мартиника", "Martinique"),
    ("🇲🇽Мексика", "Mexico"),
    ("🇲🇸Монтсеррат", "Montserrat"),
    ("🇳🇮Никарагуа", "Nicaragua"),
    ("🇵🇦Панама", "Panama"),
    ("🇵🇾Парагвай", "Paraguay"),
    ("🇵🇪Перу", "Peru"),
    ("🇵🇷Пуэрто-Рико", "Puerto Rico"),
    ("🇧🇱Сен-Бартелеми", "Saint Barthélemy"),
    ("🇰🇳Сент-Китс и Невис", "Saint Kitts and Nevis"),
    ("🇱🇨Сент-Люсия", "Saint Lucia"),
    ("🇲🇫Сен-Мартен", "Saint Martin"),
    ("🇻🇨Сент-Винсент и Гренадины", "Saint Vincent and the Grenadines"),
    ("🇸🇽Синт-Мартен", "Sint Maarten"),
    ("🇸🇷Суринам", "Suriname"),
    ("🇹🇹Тринидад и Тобаго", "Trinidad and Tobago"),
    ("🇹🇨Теркс и Кайкос", "Turks and Caicos Islands"),
    ("🇺🇾Уругвай", "Uruguay"),
    ("🇺🇸США", "United States"),
    ("🇻🇪Венесуэла", "Venezuela"),
    ("🇻🇮Американские Виргинские острова", "United States Virgin Islands"),

    # Oceanian countries
    ("🇦🇸Американское Самоа", "American Samoa"),
    ("🇦🇺Австралия", "Australia"),
    ("🇨🇰Острова Кука", "Cook Islands"),
    ("🇫🇯Фиджи", "Fiji"),
    ("🇵🇫Французская Полинезия", "French Polynesia"),
    ("🇬🇺Гуам", "Guam"),
    ("🇰🇮Кирибати", "Kiribati"),
    ("🇲🇭Маршалловы острова", "Marshall Islands"),
    ("🇫🇲Микронезия", "Micronesia"),
    ("🇳🇷Науру", "Nauru"),
    ("🇳🇨Новая Каледония", "New Caledonia"),
    ("🇳🇿Новая Зеландия", "New Zealand"),
    ("🇳🇺Ниуэ", "Niue"),
    ("🇳🇫Остров Норфолк", "Norfolk Island"),
    ("🇲🇵Северные Марианские острова", "Northern Mariana Islands"),
    ("🇵🇼Палау", "Palau"),
    ("🇵🇬Папуа — Новая Гвинея", "Papua New Guinea"),
    ("🇵🇳Питкэрн", "Pitcairn Islands"),
    ("🇼🇸Самоа", "Samoa"),
    ("🇸🇧Соломоновы острова", "Solomon Islands"),
    ("🇹🇰Токелау", "Tokelau"),
    ("🇹🇴Тонга", "Tonga"),
    ("🇹🇻Тувалу", "Tuvalu"),
    ("🇻🇺Вануату", "Vanuatu"),
    ("🇼🇫Уоллис и Футуна", "Wallis and Futuna")
]

async def add_countries():
    # Connect to the database
    conn = await aiosqlite.connect("database.db")
    
    # Get the parent ID for "Приватный IPv4"
    cursor = await conn.execute("SELECT id FROM catalog_items WHERE name = '👤Приватный IPv4'")
    private_ipv4 = await cursor.fetchone()
    
    if not private_ipv4:
        print("Private IPv4 category not found")
        await conn.close()
        return
    
    parent_id = private_ipv4[0]
    print(f"Adding countries to Private IPv4 category (ID: {parent_id})")
    
    # Count existing countries first
    cursor = await conn.execute("""
        SELECT COUNT(*) FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory'
    """, (parent_id,))
    
    existing_count = await cursor.fetchone()
    print(f"Existing countries: {existing_count[0]}")
    
    # Add each country
    for i, (russian_name, english_name) in enumerate(additional_countries, start=1):
        try:
            # Check if country already exists
            cursor = await conn.execute("""
                SELECT id FROM catalog_items 
                WHERE name = ? AND parent_id = ? AND type = 'subcategory'
            """, (russian_name, parent_id))
            
            existing = await cursor.fetchone()
            if existing:
                print(f"✓ {russian_name} already exists (ID: {existing[0]})")
                continue
            
            # Add the country as a subcategory
            cursor = await conn.execute('''
                INSERT INTO catalog_items 
                (parent_id, type, name, description, sticker_id, photo_id, preview_link, 
                 row_width, position, is_grid_3x6, search_button_name, back_button_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                parent_id,  # parent_id
                'subcategory',  # type
                russian_name,  # name
                f"🌐 <b>Приватный IPv4</b>  ›  <b>{russian_name.replace(russian_name[0:2], '')}</b>\n\nВыберите регион:",  # description
                None,  # sticker_id
                None,  # photo_id
                None,  # preview_link
                1,  # row_width
                i + 100,  # position (start from 100 to avoid conflicts)
                1,  # is_grid_3x6
                "🔎найти регион",  # search_button_name
                "к выбору страны"  # back_button_text
            ))
            
            await conn.commit()
            country_id = cursor.lastrowid
            print(f"✓ Added {russian_name} (ID: {country_id})")
            
        except Exception as e:
            print(f"✗ Error adding {russian_name}: {e}")
    
    # Count total countries after adding
    cursor = await conn.execute("""
        SELECT COUNT(*) FROM catalog_items 
        WHERE parent_id = ? AND type = 'subcategory'
    """, (parent_id,))
    
    final_count = await cursor.fetchone()
    print(f"\nFinal total countries: {final_count[0]}")
    print(f"Pages available: {final_count[0] // 18 + (1 if final_count[0] % 18 > 0 else 0)}")
    
    await conn.close()
    print("\nFinished adding countries!")

if __name__ == "__main__":
    asyncio.run(add_countries())