import json

# Read the JSON file
with open('prompts/nt2.2.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# Filter out entries with "level_type": "herhaling"
filtered_data = [entry for entry in data if entry.get("level_type") != "herhaling"]

# Write the filtered data back to the file
with open('prompts/nt2.2.json', 'w', encoding='utf-8') as file:
    json.dump(filtered_data, file, ensure_ascii=False, indent=2)

print(f"Removed {len(data) - len(filtered_data)} entries with level_type: herhaling")
print(f"Remaining entries: {len(filtered_data)}")