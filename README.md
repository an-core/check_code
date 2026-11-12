# check_code
Синтаксический анализатор кода. Проверка кода на ошибки в HTML, CSS, JavaScript и других языках.

📝 Синтаксический анализатор кода
Веб-приложение для быстрой проверки синтаксиса и форматирования кода на нескольких языках программирования прямо в браузере. Никаких серверов, никаких зависимостей — открыл и работаешь.

https://img.shields.io/badge/HTML5-orange?logo=html5&logoColor=white
https://img.shields.io/badge/CSS3-blue?logo=css3&logoColor=white
https://img.shields.io/badge/JavaScript-yellow?logo=javascript&logoColor=black
https://img.shields.io/badge/license-MIT-green

✨ Возможности
🔍 Проверка синтаксиса — быстрый разбор кода с подсветкой строк, в которых найдены ошибки.

🎯 Автоопределение языка — приложение само угадывает, на каком языке написан код.

🧹 Форматирование — приведение кода к читаемому виду с настраиваемым размером отступа.

📋 Копирование в буфер обмена — в один клик.

📊 Статистика — количество символов и строк в редакторе.

🎨 Тёмная минималистичная тема и удобный редактор с нумерацией строк.

⌨️ Горячие клавиши — Ctrl + Enter запускает проверку.

🌐 Ссылка на W3C Validator — для углублённой проверки HTML.

🧠 Поддерживаемые языки
Язык	Что проверяется
HTML / HTM	Валидность разметки через DOMParser
CSS	Синтаксис через CSSStyleSheet.replaceSync()
JavaScript	Полный разбор через Acorn (ES latest, модули)
JSON	JSON.parse() + точное определение позиции ошибки
XML / SVG	Разбор как HTML/XML
BAT	Баланс кавычек и круглых скобок
C++	Баланс скобок (), [], {} с учётом строк, символов и комментариев
Авто	Последовательная проверка всеми валидаторами
🚀 Как запустить
Проект полностью клиентский — достаточно открыть index.html в браузере.

bash
git clone https://github.com/your-username/syntax-analyzer.git
cd syntax-analyzer
Затем откройте index.html двойным кликом или через локальный сервер:

bash
# Python
python -m http.server 8000

# Node.js
npx serve .
После этого перейдите на http://localhost:8000.

⚠️ Для корректной работы ES-модулей (<script type="module">) рекомендуется запускать через локальный сервер, а не через file://.

📁 Структура проекта
text
syntax-analyzer/
├── index.html          # Разметка интерфейса
├── styles.css          # Стили (тёмная тема, редактор, результаты)
├── functions.js        # Вся логика: детекция языка, валидаторы, форматирование
└── README.md
🛠️ Технологии
Vanilla JavaScript — без фреймворков

Acorn — парсер JavaScript

js-beautify — форматирование JS, CSS и HTML

DOMParser / CSSStyleSheet / JSON — встроенные браузерные API для валидации
