# News Adaptation Prompts

This directory contains prompt templates for adapting news articles to different language proficiency levels in the Kolmit system.

## Prompt Structure

Each prompt file follows a consistent structure:

1. **Header** - Describes the task and target language level
2. **Requirements** - Specifies what the output text must include
3. **Lexical Guidelines** - Defines allowed vocabulary for the level
4. **Grammar Constraints** - Specifies permitted grammatical structures
5. **Content Structure** - Details the required format and organization
6. **Special Instructions** - Additional requirements for the output

## Level Progression

The prompts are organized by Kolmit levels, which correspond to CEFR levels:

- **Level 20-30** - A1 (Beginner)
- **Level 30-40** - A1-A2 (Elementary)
- **Level 40-50** - A2 (Pre-Intermediate)
- **Level 50-60** - A2-B1 (Intermediate)
- **Level 60-70** - B1 (Upper-Intermediate)
- **Level 70-80** - B2 (Advanced)
- **Level 80-90** - B2 (Proficient)
- **Level 90-100** - C1 (Expert)
- **Level 100** - C2 (Mastery)

## Improvements Made

The following enhancements were made to the original prompts:

1. **Consistent Structure** - All prompts now follow the same organizational pattern
2. **Clearer Instructions** - Each prompt has more explicit guidelines
3. **Complete Range** - Created a full progression of prompts with 10-level increments
4. **Enhanced Detail** - Added more specific guidance on content structure and style
5. **Improved Formatting** - Made the prompts more readable and consistent
6. **Better Alignment** - Ensured that complexity increases appropriately between levels
7. **Self-Contained Prompts** - All prompts are now self-contained and don't reference external files

## Usage

These prompts are used by the news adaptation system to generate news articles at appropriate language levels. The system replaces placeholders like `${level}`, `${llang}`, and `${kolmit_scale}` with actual values before processing.

Each prompt ensures that the output:
- Contains exactly 10 sentences
- Follows JSON format requirements
- Matches the grammatical and lexical constraints of the target level
- Maintains a journalistic style
- Excludes direct speech (except at higher levels)

## Design Principles

The prompts are designed to be self-contained and provide all necessary information to the AI model without requiring access to external files. Each prompt includes specific guidance on:
- Lexical constraints for the target level
- Grammatical structures that are permitted
- Content structure and organization
- Special requirements for the output format