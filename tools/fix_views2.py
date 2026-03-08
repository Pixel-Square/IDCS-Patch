path = r'g:\IDCS-NEW\IDCS-Restart\backend\idcsscan\views.py'
lines = open(path, encoding='utf-8').readlines()
# line 414 (0-indexed) has the broken f-string with escaped double quotes
# Replace it with a clean version using single-quotes inside the f-string
lines[414] = "                'message': f'Student already exited at {already_scanned.gatepass_scanned_at.strftime(\"%I:%M %p\")}.',\n".replace('\\"', "'").replace("strftime('", "strftime(")
# Simpler: just write the exact bytes we want
lines[414] = "                'message': f'Student already exited at {already_scanned.gatepass_scanned_at.strftime(\"%I:%M %p\")}.',\n"
# That still has backslash. Use %I:%M %p with single quotes
lines[414] = "                'message': 'Student already exited at ' + already_scanned.gatepass_scanned_at.strftime('%I:%M %p') + '.',\n"
open(path, 'w', encoding='utf-8').writelines(lines)
import ast
src = open(path, encoding='utf-8').read()
try:
    ast.parse(src)
    print('Syntax OK')
except SyntaxError as e:
    print('Still broken:', e)
