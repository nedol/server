import json

def remove_duplicates(input_file, output_file):
    # Read the JSON file
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Keep track of seen rule names
    seen_rule_names = set()
    unique_rules = []
    
    # Iterate through the rules and keep only unique ones
    for rule in data:
        rule_name = rule.get("rule_name")
        if rule_name not in seen_rule_names:
            seen_rule_names.add(rule_name)
            unique_rules.append(rule)
        else:
            print(f"Duplicate rule found and removed: {rule_name}")
    
    # Write the unique rules to the output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(unique_rules, f, ensure_ascii=False, indent=2)
    
    print(f"Original rules: {len(data)}")
    print(f"Unique rules: {len(unique_rules)}")
    print(f"Duplicates removed: {len(data) - len(unique_rules)}")

if __name__ == "__main__":
    input_file = "c:/Users/Kolmit/VSCodeProjects/news_server/prompts/nt2.2.json"
    output_file = "c:/Users/Kolmit/VSCodeProjects/news_server/prompts/nt2.2_cleaned.json"
    remove_duplicates(input_file, output_file)