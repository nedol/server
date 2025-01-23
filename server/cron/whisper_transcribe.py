# -*- coding: utf-8 -*-

# import whisper

# model = whisper.load_model("base")
# print("Model loaded successfully!")


import whisper
import sys
import json

# Загрузить модель Whisper
model = whisper.load_model("base")

# Получить путь к аудиофайлу
audio_file = sys.argv[1]

# Выполнить транскрипцию с получением временных меток
result = model.transcribe(audio_file, word_timestamps=True)

# Вывести результат в формате JSON (с временными метками)
output = {
    "text": result["text"],
    "segments": result["segments"]  # Список сегментов с временными метками
}

# Печатаем результат в формате JSON
print(json.dumps(output))
