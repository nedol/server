import json

# Read the JSON file
with open('prompts/nt2.2.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# Renumber kolmit_level values sequentially starting from 1
for i, entry in enumerate(data, 1):
    entry["kolmit_level"] = i

# Write the renumbered data back to the file
with open('prompts/nt2.2.json', 'w', encoding='utf-8') as file:
    json.dump(data, file, ensure_ascii=False, indent=2)

print(f"Renumbered kolmit_level values for {len(data)} entries")