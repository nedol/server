import json
import re

def validate_prompt_file(file_path):
    """
    Validates the linguistic correctness of the prompt file.
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Check 1: Verify that the example JSON is valid
    # Extract the JSON part from the file
    json_start = content.find('{')
    json_end = content.rfind('}') + 1
    
    if json_start == -1 or json_end == -1:
        print("ERROR: Could not find valid JSON structure in the file")
        return False
    
    json_content = content[json_start:json_end]
    
    # Fix escaped quotes that might cause issues
    json_content = json_content.replace('\\"', '"')
    
    try:
        # Parse the JSON to check if it's valid
        parsed_json = json.loads(json_content)
        print("✓ JSON structure is valid")
    except json.JSONDecodeError as e:
        print(f"✗ JSON parsing error: {e}")
        print("Trying to extract and validate JSON more carefully...")
        # Try a more careful extraction
        return validate_json_carefully(content)
    
    # Check 2: Verify that the example content uses English placeholder text
    expected_placeholders = [
        "${llang} news title example",
        "This is the first example sentence of adapted news in ${llang} language.",
        "This is the second example sentence of adapted news in ${llang} language.",
        "Check 1: All sentences are correctly formatted and match level ${level}",
        "Check 2: Only vocabulary from the frequency dictionary for level ${level} is used"
    ]
    
    all_correct = True
    for placeholder in expected_placeholders:
        if placeholder not in json_content:
            print(f"✗ Missing or incorrect placeholder: {placeholder}")
            all_correct = False
    
    if all_correct:
        print("✓ All example content uses correct English placeholder text")
    
    # Check 3: Verify proper formatting rules are present
    required_rules = [
        "ВАЖНО: Верните ТОЛЬКО действительный JSON",
        "НЕ используйте markdown",
        "ПРАВИЛА ФОРМАТИРОВАНИЯ JSON"
    ]
    
    for rule in required_rules:
        if rule not in content:
            print(f"✗ Missing required rule: {rule}")
            all_correct = False
    
    if all_correct:
        print("✓ All required formatting rules are present")
    
    # Check 4: Verify structure sections
    required_sections = [
        "## Входные параметры:",
        "## Структура и содержание",
        "## ПРОВЕРКА",
        "### Формат вывода"
    ]
    
    for section in required_sections:
        if section not in content:
            print(f"✗ Missing required section: {section}")
            all_correct = False
    
    if all_correct:
        print("✓ All required sections are present")
    
    return all_correct

def validate_json_carefully(content):
    """
    More careful validation of JSON content.
    """
    # Extract everything between the first { and last }
    json_start = content.find('{')
    json_end = content.rfind('}') + 1
    
    if json_start == -1 or json_end == -1:
        print("ERROR: Could not find valid JSON structure")
        return False
    
    json_text = content[json_start:json_end]
    
    # Try to parse it
    try:
        json.loads(json_text)
        print("✓ JSON structure is valid")
        return True
    except json.JSONDecodeError as e:
        print(f"✗ JSON parsing error: {e}")
        # Let's try to show a snippet of the problematic area
        error_pos = e.pos
        start = max(0, error_pos - 50)
        end = min(len(json_text), error_pos + 50)
        print(f"Context around error: {json_text[start:end]}")
        return False

if __name__ == "__main__":
    file_path = "prompts/news.adapt.nl.txt"
    print(f"Validating linguistic correctness of {file_path}...")
    print("=" * 50)
    
    is_valid = validate_prompt_file(file_path)
    
    print("=" * 50)
    if is_valid:
        print("✓ All linguistic correctness checks passed!")
    else:
        print("✗ Some linguistic correctness checks failed!")