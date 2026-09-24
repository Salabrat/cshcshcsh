def add_state_to_text_handler(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    modified = False
    for i, line in enumerate(lines):
        if "@dp.message_handler(lambda message: message.text and not message.text.startswith('/'))" in line:
            if "state=" not in line:
                lines[i] = line.replace("('/'))", "('/'), state='*')")
                modified = True

    if modified:
        with open(filename, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Updated text handler successfully!")

if __name__ == "__main__":
    add_state_to_text_handler('streetshop.py')
