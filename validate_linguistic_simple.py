def validate_prompt_file_simple(file_path):
    """
    Simple validation of the linguistic correctness of the prompt file.
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    print("Validating linguistic correctness of the prompt file...")
    print("=" * 50)
    
    all_checks_passed = True
    
    # Check 1: Verify the file contains the expected structure sections
    required_sections = [
        "## Входные параметры:",
        "## Структура и содержание",
        "## ПРОВЕРКА",
        "### Формат вывода"
    ]
    
    for section in required_sections:
        if section in content:
            print(f"✓ Found required section: {section}")
        else:
            print(f"✗ Missing required section: {section}")
            all_checks_passed = False
    
    # Check 2: Verify important instructions are present
    required_instructions = [
        "ВАЖНО: Несмотря на то, что этот промт на русском языке, вы должны генерировать весь ответ строго на языке ${llang}",
        "ВАЖНО: Верните ТОЛЬКО действительный JSON",
        "НЕ используйте markdown",
        "Количество предложений: 10"
    ]
    
    for instruction in required_instructions:
        if instruction in content:
            print(f"✓ Found required instruction: {instruction[:50]}...")
        else:
            print(f"✗ Missing required instruction: {instruction[:50]}...")
            all_checks_passed = False
    
    # Check 3: Verify the example content uses English placeholder text (not Russian)
    # Check that the example JSON content doesn't contain Russian text
    json_start = content.find('{')
    json_end = content.rfind('}') + 1
    
    if json_start != -1 and json_end != -1:
        json_content = content[json_start:json_end]
        
        # Check for English placeholder text
        english_placeholders = [
            "${llang} news title example",
            "This is the first example sentence",
            "Check 1: All sentences are correctly formatted"
        ]
        
        for placeholder in english_placeholders:
            if placeholder in json_content:
                print(f"✓ Found English placeholder: {placeholder[:30]}...")
            else:
                print(f"✗ Missing English placeholder: {placeholder[:30]}...")
                all_checks_passed = False
        
        # Check that there's no Russian text in the JSON example
        russian_indicators = ["Это первый пример", "Проверка 1:"]
        russian_found = False
        for indicator in russian_indicators:
            if indicator in json_content:
                print(f"✗ Found Russian text in JSON example: {indicator}")
                russian_found = True
                all_checks_passed = False
        
        if not russian_found:
            print("✓ No Russian text found in JSON example")
    else:
        print("✗ Could not find JSON structure in file")
        all_checks_passed = False
    
    # Check 4: Verify formatting rules are present
    formatting_rules_indicators = [
        "ПРАВИЛА ФОРМАТИРОВАНИЯ JSON",
        "Все строки должны быть в двойных кавычках",
        "Убедитесь, что все скобки сбалансированы"
    ]
    
    for indicator in formatting_rules_indicators:
        if indicator in content:
            print(f"✓ Found formatting rule: {indicator[:30]}...")
        else:
            print(f"✗ Missing formatting rule: {indicator[:30]}...")
            all_checks_passed = False
    
    print("=" * 50)
    if all_checks_passed:
        print("✓ All linguistic correctness checks passed!")
    else:
        print("✗ Some linguistic correctness checks failed!")
    
    return all_checks_passed

if __name__ == "__main__":
    file_path = "prompts/news.adapt.nl.txt"
    validate_prompt_file_simple(file_path)