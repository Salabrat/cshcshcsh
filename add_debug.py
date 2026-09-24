with open('streetshop.py', 'a', encoding='utf-8') as f:
    f.write('\n\n@dp.callback_query_handler(state="*")\n')
    f.write('async def debug_all_callbacks(callback: types.CallbackQuery, state: FSMContext):\n')
    f.write('    print(f"DEBUG UNHANDLED CALLBACK: {callback.data} FROM {callback.from_user.id}")\n')
    f.write('    await callback.answer("Debug: Unknown button: " + callback.data, show_alert=True)\n')
print("Added debug callback handler to the end of streetshop.py")
