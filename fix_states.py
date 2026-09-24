import re

def add_state_asterisk(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    modified = False
    for i, line in enumerate(lines):
        # Find callback_query_handler lines without state=
        if '@dp.callback_query_handler(' in line and 'state=' not in line:
            # Check if it has lambda
            if 'lambda' in line:
                # Replace the closing parenthesis with , state="*")
                # Need to be careful about newlines and existing closing parens
                # We can use regex to find the closing parenthesis of the handler
                match = re.search(r'(@dp\.callback_query_handler\(.*?)(\s*\))$', line)
                if match:
                    new_line = match.group(1) + ', state="*"' + match.group(2) + '\n'
                    lines[i] = new_line
                    modified = True

    if modified:
        with open(filename, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Updated handlers successfully!")
    else:
        print("No lines modified.")

if __name__ == "__main__":
    add_state_asterisk('streetshop.py')
