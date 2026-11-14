(function() {
    'use strict';

    function cleanInput(text) {
        return text.replace(/^[\uFEFF\u200B\u2060\uFFF9-\uFFFB\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]+/, '').trimStart();
    }
    const codeInput = document.getElementById('codeInput');
    const lineNumbers = document.getElementById('lineNumbers');
    const langSelect = document.getElementById('langSelect');
    const checkBtn = document.getElementById('checkBtn');
    const clearBtn = document.getElementById('clearBtn');
    const formatBtn = document.getElementById('formatBtn');
    const copyBtn = document.getElementById('copyBtn');
    const w3cManualBtn = document.getElementById('w3cManualBtn');
    const resultsBody = document.getElementById('resultsBody');
    const resultBadge = document.getElementById('resultBadge');
    const detectedLang = document.getElementById('detectedLang');
    const charCount = document.getElementById('charCount');
    const lineCount = document.getElementById('lineCount');
    const editorStatus = document.getElementById('editorStatus');
    const indentSizeSelect = document.getElementById('indentSizeSelect');

    let lastResult = [];
    let copyTimeout = null;
    let errorLines = [];

    function pluralize(num, one, few, many) {
        if (num % 10 === 1 && num % 100 !== 11) return one;
        if (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20)) return few;
        return many;
    }

    function updateLineNumbers(errorLinesArray) {
        if (!errorLinesArray) errorLinesArray = [];
        const text = codeInput.value;
        const lines = text.split('\n');
        const errorSet = new Set(errorLinesArray);
        let html = '';
        for (let i = 1; i <= lines.length; i++) {
            const cls = errorSet.has(i) ? ' error-line' : '';
            html += `<span class="line-num${cls}">${i}</span>`;
        }
        lineNumbers.innerHTML = html;
        syncScroll();
        charCount.textContent = text.length;
        lineCount.textContent = lines.length;
    }

    function syncScroll() {
        lineNumbers.scrollTop = codeInput.scrollTop;
    }

    codeInput.addEventListener('scroll', syncScroll);
    codeInput.addEventListener('input', function() {
        errorLines = [];
        updateLineNumbers([]);
        updateDetectedLang();
    });

    window.addEventListener('load', function() {
        updateLineNumbers([]);
        updateDetectedLang();
        updateStats();
    });

    function updateStats() {
        const text = codeInput.value;
        charCount.textContent = text.length;
        lineCount.textContent = text.split('\n').length;
    }

    function detectLanguage(text) {
        if (!text || text.trim() === '') return 'unknown';
        const trimmed = text.trim();

        // HTML
        if (/<!DOCTYPE\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed) || /<\/html>/i.test(trimmed)) {
            return 'html';
        }

        // JSON
        if (/^\s*[{\[]/.test(trimmed) && /[}\]]\s*$/.test(trimmed)) {
            try {
                JSON.parse(trimmed);
                return 'json';
            } catch (_) {}
        }

        // JavaScript
        const jsPatterns = [
            /\b(const|let|var)\s+[a-zA-Z_$][\w$]*\s*[=;]/,
            /\bfunction\s*\([^)]*\)\s*{/,
            /\bfunction\s+[a-zA-Z_$][\w$]*\s*\(/,
            /=>/,
            /\bimport\s+.*\s+from\s+['"]/,
            /\bexport\s+(default\s+)?[{a-zA-Z]/,
            /\btry\s*\{/,
            /\bcatch\s*\(/,
            /\breturn\s+[^;]+;/
        ];
        if (jsPatterns.some(p => p.test(trimmed))) {
            return 'javascript';
        }

        // CSS
        if (/[a-zA-Z_\-]+\s*\{[^}]*\}/.test(trimmed) && !jsPatterns.some(p => p.test(trimmed))) {
            return 'css';
        }

        // XML/SVG/HTML
        if (/<\/?[a-zA-Z][a-zA-Z0-9:._-]*\s*\/?>/i.test(trimmed)) {
            if (/<svg[\s>]/i.test(trimmed) && /<\/svg>/i.test(trimmed)) return 'svg';
            if (/<\?xml/i.test(trimmed)) return 'xml';
            return 'html';
        }

        // C++
        const cppMarkers = [
            /^\s*#include\s*[<"]/i,
            /#define\s+\w+/i,
            /#ifdef|#ifndef|#endif|#if|#else|#elif/i,
            /\btemplate\s*</i,
            /\bclass\s+\w+\s*[:{]/i,
            /\bstruct\s+\w+\s*[:{]/i,
            /\bpublic\s*:|private\s*:|protected\s*:/i,
            /::\s*\w+/
        ];
        if (cppMarkers.some(p => p.test(trimmed))) {
            return 'cpp';
        }

        // BAT
        const batCommandPattern = /(?:^|\s)@echo\s+(?:off|on)|%~dp0|%errorlevel%|chcp\s+\d+|net\s+session|cd\s+\/d|mkdir\s+|start\s+.*\/min|timeout\s+\/t|exit\s+\/b\s+\d+|pause\s*$|\bset\s+[A-Z_][A-Z0-9_]*\s*=|if\s+(?:exist|defined|errorlevel|not)\s+/i;
        const batVariablePattern = /%[A-Z_][A-Z0-9_]*%/i;
        if (batCommandPattern.test(trimmed) || batVariablePattern.test(trimmed)) {
            return 'bat';
        }
        return 'unknown';
    }

    function updateDetectedLang() {
        const manual = langSelect.value;
        if (manual !== 'auto') {
            return;
        }
        const text = codeInput.value;
        const lang = detectLanguage(text);
        const map = {
            html: 'HTML',
            htm: 'HTM',
            css: 'CSS',
            javascript: 'JavaScript',
            json: 'JSON',
            xml: 'XML',
            svg: 'SVG',
            bat: 'BAT',
            cpp: 'C++',
            unknown: 'не определён'
        };
        detectedLang.textContent = ' ' + (map[lang] || lang);
        return lang;
    }

    function getEffectiveLang() {
        const manual = langSelect.value;
        if (manual !== 'auto') return manual;
        const text = codeInput.value;
        const detected = detectLanguage(text);
        if (detected === 'unknown' && text.trim() !== '') return 'html';
        return detected;
    }

    function validateCpp(text) {
        const errors = [];
        let line = 1,
            col = 1;
        let inSingleLineComment = false;
        let inMultiLineComment = false;
        let inString = false;
        let inChar = false;
        let stack = [];
        let stackLine = [];
        let stackCol = [];

        function pushBracket(ch, l, c) {
            stack.push(ch);
            stackLine.push(l);
            stackCol.push(c);
        }

        function popBracket(expected, l, c) {
            if (stack.length === 0) {
                errors.push({
                    line: l,
                    column: c,
                    message: `Лишняя закрывающая скобка '${expected}'`,
                    severity: 'error'
                });
                return false;
            }
            const top = stack.pop();
            stackLine.pop();
            stackCol.pop();
            if ((expected === ')' && top !== '(') ||
                (expected === ']' && top !== '[') ||
                (expected === '}' && top !== '{')) {
                errors.push({
                    line: l,
                    column: c,
                    message: `Несоответствие скобок: ожидалась '${top === '(' ? ')' : top === '[' ? ']' : '}'}', получена '${expected}'`,
                    severity: 'error'
                });
                return false;
            }
            return true;
        }

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '\n') {
                line++;
                col = 1;
                if (inSingleLineComment) inSingleLineComment = false;
                continue;
            }
            col++;

            if (!inSingleLineComment && !inMultiLineComment && !inString && !inChar) {
                if (ch === '/' && i + 1 < text.length && text[i + 1] === '/') {
                    inSingleLineComment = true;
                    i++;
                    continue;
                }
                if (ch === '/' && i + 1 < text.length && text[i + 1] === '*') {
                    inMultiLineComment = true;
                    i++; // пропустить *
                    continue;
                }
                if (ch === '"') {
                    inString = true;
                    continue;
                }
                if (ch === '\'') {
                    inChar = true;
                    continue;
                }
                if (ch === '(' || ch === '[' || ch === '{') {
                    pushBracket(ch, line, col);
                } else if (ch === ')') {
                    popBracket(')', line, col);
                } else if (ch === ']') {
                    popBracket(']', line, col);
                } else if (ch === '}') {
                    popBracket('}', line, col);
                }
            } else {
                if (inSingleLineComment) {} else if (inMultiLineComment) {
                    if (ch === '*' && i + 1 < text.length && text[i + 1] === '/') {
                        inMultiLineComment = false;
                        i++;
                    }
                } else if (inString) {
                    if (ch === '\\' && i + 1 < text.length) {
                        i++;
                    } else if (ch === '"') {
                        inString = false;
                    }
                } else if (inChar) {
                    if (ch === '\\' && i + 1 < text.length) {
                        i++;
                    } else if (ch === '\'') {
                        inChar = false;
                    }
                }
            }
        }

        if (inString) {
            errors.push({
                line: line,
                column: col,
                message: 'Незакрытая строковая константа (")',
                severity: 'error'
            });
        }
        if (inChar) {
            errors.push({
                line: line,
                column: col,
                message: 'Незакрытый символьный литерал (\')',
                severity: 'error'
            });
        }
        if (inMultiLineComment) {
            errors.push({
                line: line,
                column: col,
                message: 'Незакрытый многострочный комментарий (/*)',
                severity: 'error'
            });
        }
        while (stack.length > 0) {
            const top = stack.pop();
            const l = stackLine.pop();
            const c = stackCol.pop();
            const expected = top === '(' ? ')' : top === '[' ? ']' : '}';
            errors.push({
                line: l,
                column: c,
                message: `Незакрытая скобка '${top}', ожидается '${expected}'`,
                severity: 'error'
            });
        }

        if (errors.length === 0) {
            errors.push({
                line: 0,
                column: 0,
                message: 'C++ синтаксис корректен (базовая проверка скобок)',
                severity: 'info'
            });
        }
        return errors;
    }

    function runCheck() {
        const rawText = codeInput.value;
        const cleanedText = cleanInput(rawText);
        const lang = getEffectiveLang();

        if (cleanedText.trim() === '') {
            resultsBody.innerHTML = `<span class="empty">⏳ Вставьте код для проверки</span>`;
            resultBadge.textContent = 'ожидание';
            resultBadge.style.color = '#8b93a7';
            editorStatus.textContent = 'пусто';
            errorLines = [];
            updateLineNumbers([]);
            return;
        }

        editorStatus.textContent = 'проверка…';
        let errors = [];

        switch (lang) {
            case 'html':
            case 'htm':
            case 'xml':
            case 'svg':
                errors = validateHTML(cleanedText, lang);
                break;
            case 'css':
                errors = validateCSS(cleanedText);
                break;
            case 'javascript':
                errors = validateJavaScript(cleanedText);
                break;
            case 'json':
                errors = validateJSON(cleanedText);
                break;
            case 'bat':
                errors = validateBat(cleanedText);
                break;
            case 'cpp':
                errors = validateCpp(cleanedText);
                break;
            default:
                errors = validateGeneric(cleanedText);
                break;
        }

        displayResults(errors, lang);
        lastResult = errors;
        editorStatus.textContent = errors.length === 0 ? '✓ синтаксис верен' : '✗ найдены ошибки';
    }

    function validateHTML(text, lang) {
        const errors = [];
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                const msg = parserError.textContent || 'Ошибка парсинга HTML';
                errors.push({
                    line: 1,
                    column: 1,
                    message: msg,
                    severity: 'error'
                });
            }
        } catch (e) {
            errors.push({
                line: 1,
                column: 1,
                message: 'Ошибка парсера: ' + e.message,
                severity: 'error'
            });
        }
        if (errors.length === 0) {
            errors.push({
                line: 0,
                column: 0,
                message: 'Синтаксис корректен',
                severity: 'info'
            });
        }
        return errors;
    }

    function validateCSS(text) {
        const errors = [];
        try {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(text);
        } catch (e) {
            let line = 1,
                col = 1;
            const match = e.message.match(/line\s*(\d+)/i) || e.message.match(/position\s*(\d+)/i);
            if (match) {
                const pos = parseInt(match[1]);
                if (!isNaN(pos)) {
                    if (e.message.includes('line')) {
                        line = pos;
                    } else {
                        const before = text.substring(0, pos);
                        line = before.split('\n').length;
                        col = before.split('\n').pop().length + 1;
                    }
                }
            }
            errors.push({
                line: line,
                column: col,
                message: 'Ошибка CSS: ' + e.message.replace(/^[^:]+:\s*/, ''),
                severity: 'error'
            });
        }
        if (errors.length === 0) {
            errors.push({
                line: 0,
                column: 0,
                message: 'CSS-синтаксис корректен',
                severity: 'info'
            });
        }
        return errors;
    }

    function validateJavaScript(text) {
        const errors = [];
        try {
            if (typeof acorn !== 'undefined') {
                acorn.parse(text, {
                    ecmaVersion: 'latest',
                    sourceType: 'module',
                    allowAwaitOutsideFunction: true,
                    allowReturnOutsideFunction: false,
                    locations: true,
                });
            } else {
                new Function('"use strict";\n' + text);
            }
            errors.push({
                line: 0,
                column: 0,
                message: 'JavaScript-синтаксис корректен',
                severity: 'info'
            });
        } catch (e) {
            let line = 1,
                col = 1;
            if (e.loc && typeof e.loc.line === 'number') {
                line = e.loc.line;
                col = e.loc.column + 1;
            } else {
                const match = e.message.match(/line (\d+)/i);
                if (match) line = parseInt(match[1]);
                const matchCol = e.message.match(/column (\d+)/i);
                if (matchCol) col = parseInt(matchCol[1]);
            }
            errors.push({
                line: line,
                column: col,
                message: 'Ошибка JavaScript: ' + e.message.replace(/^[^:]+:\s*/, ''),
                severity: 'error'
            });
        }
        return errors;
    }

    function validateJSON(text) {
        const errors = [];
        try {
            JSON.parse(text);
            errors.push({
                line: 0,
                column: 0,
                message: 'JSON-синтаксис корректен',
                severity: 'info'
            });
        } catch (e) {
            let line = 1,
                col = 1;
            const match = e.message.match(/position (\d+)/);
            if (match) {
                const pos = parseInt(match[1]);
                if (!isNaN(pos) && pos < text.length) {
                    const before = text.substring(0, pos);
                    line = before.split('\n').length;
                    col = before.split('\n').pop().length + 1;
                }
            }
            errors.push({
                line: line,
                column: col,
                message: 'Ошибка JSON: ' + e.message.replace(/^[^:]+:\s*/, ''),
                severity: 'error'
            });
        }
        return errors;
    }

    function validateBat(text) {
        const errors = [];
        let lineNum = 1;

        let inQuotes = false;
        let quoteLine = 1;
        let quoteCol = 1;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '\n') {
                lineNum++;
                continue;
            }
            if (ch === '"') {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteLine = lineNum;
                    quoteCol = i - text.lastIndexOf('\n', i) + 1;
                } else {
                    inQuotes = false;
                }
            }
        }
        if (inQuotes) {
            errors.push({
                line: quoteLine,
                column: quoteCol,
                message: 'Незакрытая кавычка (возможно, забыли закрыть путь или аргумент)',
                severity: 'error'
            });
        }

        let parens = 0;
        let parenLine = 1;
        let parenCol = 1;
        let inString = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '\n') {
                parenLine++;
                continue;
            }
            if (ch === '"') {
                inString = !inString;
                continue;
            }
            if (inString) continue;
            if (ch === '(') {
                if (parens === 0) {
                    parenLine = parenLine;
                    parenCol = i - text.lastIndexOf('\n', i) + 1;
                }
                parens++;
            } else if (ch === ')') {
                parens--;
                if (parens < 0) {
                    errors.push({
                        line: parenLine,
                        column: parenCol,
                        message: 'Лишняя закрывающая скобка ) без открывающей',
                        severity: 'error'
                    });
                    parens = 0;
                }
            }
        }
        if (parens > 0) {
            errors.push({
                line: parenLine,
                column: parenCol,
                message: `Несбалансированные круглые скобки: ${parens} не закрыто`,
                severity: 'error'
            });
        }

        if (errors.length === 0) {
            errors.push({
                line: 0,
                column: 0,
                message: 'Синтаксис BAT корректен (базовая проверка)',
                severity: 'info'
            });
        }

        return errors;
    }

    function validateGeneric(text) {
        let allErrors = [];
        const langs = ['html', 'css', 'javascript', 'json', 'bat'];
        for (const l of langs) {
            let res;
            switch (l) {
                case 'html':
                    res = validateHTML(text, 'html');
                    break;
                case 'css':
                    res = validateCSS(text);
                    break;
                case 'javascript':
                    res = validateJavaScript(text);
                    break;
                case 'json':
                    res = validateJSON(text);
                    break;
                case 'bat':
                    res = validateBat(text);
                    break;
            }
            const realErrors = res.filter(e => e.severity === 'error');
            if (realErrors.length === 0) {
                allErrors = res;
                break;
            }
            allErrors = allErrors.concat(res);
        }
        if (allErrors.length === 0) {
            allErrors.push({
                line: 0,
                column: 0,
                message: 'Синтаксис корректен (автоопределение)',
                severity: 'info'
            });
        }
        return allErrors;
    }

    function displayResults(errors, lang) {
        const langMap = {
            html: 'HTML',
            htm: 'HTM',
            css: 'CSS',
            javascript: 'JavaScript',
            json: 'JSON',
            xml: 'XML',
            svg: 'SVG',
            bat: 'BAT',
            cpp: 'C++',
            unknown: 'неопределён'
        };
        const langName = langMap[lang] || lang;

        if (!errors || errors.length === 0) {
            resultsBody.innerHTML = `<span class="empty">✔️ Ошибок не найдено (${langName})</span>`;
            resultBadge.textContent = 'OK';
            resultBadge.style.color = '#6ee7b7';
            errorLines = [];
            updateLineNumbers([]);
            return;
        }

        const realErrors = errors.filter(e => e.severity === 'error');
        const warnings = errors.filter(e => e.severity === 'warning');
        const infos = errors.filter(e => e.severity === 'info');

        const errorLinesArray = realErrors.map(e => e.line).filter(l => l > 0);
        errorLines = errorLinesArray;
        updateLineNumbers(errorLinesArray);

        if (realErrors.length === 0 && warnings.length === 0) {
            resultsBody.innerHTML =
                `<div class="success-msg"><span class="icon">✔️</span> ${infos[0]?.message || 'Синтаксис корректен'}</div>`;
            resultBadge.textContent = 'OK';
            resultBadge.style.color = '#6ee7b7';
            return;
        }

        let html = '';
        const allItems = [...realErrors, ...warnings, ...infos];
        for (const err of allItems) {
            const sevClass = err.severity === 'error' ? 'sev-error' :
                err.severity === 'warning' ? 'sev-warning' : 'sev-info';
            const icon = err.severity === 'error' ? '✗' :
                err.severity === 'warning' ? '⚠' : 'ℹ';
            const lineStr = err.line > 0 ? `стр. ${err.line}` : '—';
            const colStr = err.column > 0 ? `:${err.column}` : '';
            html += `
                        <div class="error-item ${sevClass}">
                            <span class="severity">${icon}</span>
                            <span class="line">${lineStr}${colStr}</span>
                            <span class="msg">${err.message}</span>
                        </div>
                    `;
        }

        resultsBody.innerHTML = html;

        let parts = [];
        if (realErrors.length > 0) {
            let word = pluralize(realErrors.length, 'ошибка', 'ошибки', 'ошибок');
            parts.push(`❌ ${realErrors.length} ${word}`);
        }
        if (warnings.length > 0) {
            let word = pluralize(warnings.length, 'предупреждение', 'предупреждения', 'предупреждений');
            parts.push(`⚠ ${warnings.length} ${word}`);
        }
        let badgeText = parts.length ? parts.join(', ') : '✔️ нет ошибок';
        resultBadge.textContent = badgeText;
        if (realErrors.length > 0) {
            resultBadge.style.color = '#f87171';
        } else if (warnings.length > 0) {
            resultBadge.style.color = '#fbbf24';
        } else {
            resultBadge.style.color = '#6ee7b7';
        }
    }

    function formatCode() {
        const rawText = codeInput.value;
        const text = cleanInput(rawText);
        const lang = getEffectiveLang();

        if (!text.trim()) {
            editorStatus.textContent = 'нет кода для форматирования';
            return;
        }

        let errors = [];
        switch (lang) {
            case 'html':
            case 'htm':
            case 'xml':
            case 'svg':
                errors = validateHTML(text, lang);
                break;
            case 'css':
                errors = validateCSS(text);
                break;
            case 'javascript':
                errors = validateJavaScript(text);
                break;
            case 'json':
                errors = validateJSON(text);
                break;
            case 'bat':
                errors = validateBat(text);
                break;
            case 'cpp':
                errors = validateCpp(text);
                break;
            default:
                errors = validateGeneric(text);
                break;
        }

        const hasErrors = errors.some(e => e.severity === 'error');
        if (hasErrors) {
            editorStatus.textContent = '⚠️ синтаксические ошибки - форматирование отменено';
            return;
        }

        const indentSize = parseInt(indentSizeSelect.value, 10) || 4;
        const indentChar = ' ';

        try {
            let formatted = '';
            switch (lang) {
                case 'javascript':
                    if (typeof js_beautify !== 'undefined') {
                        formatted = js_beautify(text, {
                            indent_size: indentSize,
                            indent_char: indentChar,
                            space_in_empty_paren: true,
                            eol: '\n'
                        });
                    } else {
                        throw new Error('Библиотека js-beautify не загружена');
                    }
                    break;
                case 'css':
                    if (typeof css_beautify !== 'undefined') {
                        formatted = css_beautify(text, {
                            indent_size: indentSize,
                            indent_char: indentChar,
                            selector_separator_newline: true,
                            newline_between_rules: true
                        });
                    } else {
                        throw new Error('Библиотека css-beautify не загружена');
                    }
                    break;
                case 'html':
                case 'htm':
                case 'xml':
                case 'svg':
                    if (typeof html_beautify !== 'undefined') {
                        formatted = html_beautify(text, {
                            indent_size: indentSize,
                            indent_char: indentChar,
                            indent_inner_html: true,
                            preserve_newlines: true,
                            max_preserve_newlines: 2
                        });
                    } else {
                        throw new Error('Библиотека html-beautify не загружена');
                    }
                    break;
                case 'json':
                    try {
                        const parsed = JSON.parse(text);
                        formatted = JSON.stringify(parsed, null, indentSize);
                    } catch (e) {
                        throw new Error('Некорректный JSON: ' + e.message);
                    }
                    break;
                default:
                    formatted = text;
                    break;
            }
            codeInput.value = formatted;
            errorLines = [];
            updateLineNumbers([]);
            updateDetectedLang();
            editorStatus.textContent = '✓ отформатировано';
        } catch (e) {
            editorStatus.textContent = '⚠️ ошибка форматирования: ' + e.message;
        }
    }

    function copyCode() {
        const text = codeInput.value;
        if (!text) {
            editorStatus.textContent = 'нечего копировать';
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => showCopyStatus('скопировано'))
                .catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showCopyStatus('скопировано');
        } catch (e) {
            showCopyStatus('ошибка копирования');
        }
        document.body.removeChild(textarea);
    }

    function showCopyStatus(message) {
        editorStatus.textContent = message;
        if (copyTimeout) clearTimeout(copyTimeout);
        copyTimeout = setTimeout(() => {
            if (editorStatus.textContent === message) {
                editorStatus.textContent = 'готов';
            }
            copyTimeout = null;
        }, 2000);
    }

    function openW3CManual() {
        window.open('https://validator.w3.org/nu/', '_blank');
    }

    checkBtn.addEventListener('click', runCheck);
    codeInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runCheck();
        }
    });

    clearBtn.addEventListener('click', () => {
        codeInput.value = '';
        errorLines = [];
        updateLineNumbers([]);
        updateDetectedLang();
        resultsBody.innerHTML = `<span class="empty">Вставьте код в редактор и нажмите «Проверить»</span>`;
        resultBadge.textContent = 'ожидание';
        resultBadge.style.color = '#8b93a7';
        editorStatus.textContent = 'очищено';
        lastResult = [];
    });

    formatBtn.addEventListener('click', formatCode);
    copyBtn.addEventListener('click', copyCode);
    w3cManualBtn.addEventListener('click', openW3CManual);

    langSelect.addEventListener('change', function() {
        const manual = langSelect.value;
        if (manual !== 'auto') {
            const map = {
                html: 'HTML',
                htm: 'HTM',
                css: 'CSS',
                javascript: 'JavaScript',
                json: 'JSON',
                xml: 'XML',
                svg: 'SVG',
                bat: 'BAT',
                cpp: 'C++'
            };
            detectedLang.textContent = '🔍 ' + (map[manual] || manual);
        } else {
            updateDetectedLang();
        }
    });

    updateLineNumbers([]);
    updateDetectedLang();
    updateStats();

    resultsBody.addEventListener('dblclick', () => {
        if (lastResult.length > 0) {
            console.log('Последние результаты:', lastResult);
        }
    });

})();