import json
import os

def get_rules_for_level(cefr_level. max_rules=10):
    """Get rules from nt2.json for a specific CEFR level"""
    with open('prompts/nt2.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    rules = [item for item in data if item['cefr_level'] == cefr_level]
    return rules[:max_rules]

def generate_level_file(level_number, cefr_level):
    """Generate a level file using the template structure"""
    # Get rules for this CEFR level
    rules = get_rules_for_level(cefr_level, 5)  # Limit to 5 rules
    
    # Create content using the template structure
    content = f"## Специфические требования для уровня {level_number} ({cefr_level})\n\n"
    
    # Grammar restrictions section
    content += "### Ограничения грамматики уровня\n"
    if cefr_level == 'A0':
        content += "- Только базовая лексика\n"
        content += "- Очень простые предложения\n"
        content += "- Без сложных грамматических конструкций\n"
        content += "- Без модальных глаголов\n"
    elif cefr_level == 'A1':
        content += "- Только настоящее время (прошедшее запрещено)\n"
        content += "- Только простые предложения\n"
        content += "- Без модальных глаголов\n"
        content += "- Без сложных конструкций\n"
    elif cefr_level == 'A2':
        content += "- Основные времена (настоящее, прошедшее)\n"
        content += "- Простые сложные предложения\n"
        content += "- Базовые модальные глаголы разрешены\n"
        content += "- Базовые конструкции разрешены\n"
    elif cefr_level == 'B1':
        content += "- Все времена разрешены\n"
        content += "- Сложные предложения разрешены\n"
        content += "- Модальные глаголы разрешены\n"
        content += "- Сложные конструкции разрешены\n"
    elif cefr_level == 'B2':
        content += "- Все грамматические конструкции разрешены\n"
        content += "- Сложные и составные предложения разрешены\n"
        content += "- Все модальные глаголы разрешены\n"
        content += "- Продвинутые конструкции разрешены\n"
    
    content += "\n### Конкретные примеры для уровня\n"
    
    # Collect examples from rules
    examples = []
    for rule in rules:
        examples.extend(rule.get('examples', [])[:2])  # Take up to 2 examples per rule
    
    # Add examples (limit to 10)
    for i, example in enumerate(examples[:10], 1):
        content += f"- {example}\n"
    
    # If we don't have enough examples from rules, add some generic ones
    if len(examples) < 5:
        generic_examples = [
            "Het belangrijkste nieuws vandaag",
            "De regering heeft besloten",
            "Vandaag was het weer warm",
            "De politie kwam snel ter plaatse",
            "Omdat het gevaarlijk was, moesten mensen weggaan"
        ]
        for example in generic_examples[len(examples):5]:
            content += f"- {example}\n"
    
    return content

def main():
    # Define level mappings
    level_mappings = {
        10: 'A0',
        25: 'A1',
        30: 'A1',
        35: 'A1',
        40: 'A1',
        45: 'A1',
        50: 'A2',
        60: 'A2',
        70: 'B1',
        80: 'B1',
        90: 'B1',
        100: 'B2'
    }
    
    # Generate files for each level
    for level_number, cefr_level in level_mappings.items():
        # Skip level 20 since it's our template
        if level_number == 20:
            continue
            
        filename = f'prompts/news.adapt.nl.{level_number}.txt'
        
        # Generate content
        content = generate_level_file(level_number, cefr_level)
        
        # Write to file
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"Generated {filename}")
    
    # Clean up
    if os.path.exists('generate_from_template.py'):
        os.remove('generate_from_template.py')

if __name__ == "__main__":
    main()