"""
Проверяет URL на наличие ключевого слова или RegExp-паттерна.
Возвращает результат проверки с найденными совпадениями и контекстом.
"""
import json
import re
import os
import urllib.request
import urllib.error
import time


def handler(event: dict, context) -> dict:
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers, "body": ""}

    body = json.loads(event.get("body") or "{}")
    url = body.get("url", "").strip()
    keyword = body.get("keyword", "").strip()
    use_regex = body.get("useRegex", False)
    case_sensitive = body.get("caseSensitive", False)
    whole_word = body.get("wholeWord", False)

    if not url or not keyword:
        return {
            "statusCode": 400,
            "headers": cors_headers,
            "body": json.dumps({"error": "url и keyword обязательны"}),
        }

    # Добавляем схему если нет
    if not url.startswith("http"):
        url = "https://" + url

    start_time = time.time()

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; WebMonitor/1.0)",
                "Accept": "text/html,application/xhtml+xml,*/*",
                "Accept-Language": "ru,en;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read()
            encoding = response.headers.get_content_charset("utf-8")
            html = raw.decode(encoding, errors="replace")
    except urllib.error.HTTPError as e:
        elapsed = round((time.time() - start_time) * 1000)
        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps({
                "found": False,
                "matches": [],
                "error": f"HTTP {e.code}: {e.reason}",
                "elapsed_ms": elapsed,
                "url": url,
            }),
        }
    except Exception as e:
        elapsed = round((time.time() - start_time) * 1000)
        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps({
                "found": False,
                "matches": [],
                "error": str(e),
                "elapsed_ms": elapsed,
                "url": url,
            }),
        }

    # Убираем HTML-теги для чистого текста
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()

    elapsed = round((time.time() - start_time) * 1000)

    # Строим паттерн
    flags = 0 if case_sensitive else re.IGNORECASE
    try:
        if use_regex:
            pattern = re.compile(keyword, flags)
        else:
            escaped = re.escape(keyword)
            if whole_word:
                escaped = r"\b" + escaped + r"\b"
            pattern = re.compile(escaped, flags)
    except re.error as e:
        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps({
                "found": False,
                "matches": [],
                "error": f"Ошибка RegExp: {str(e)}",
                "elapsed_ms": elapsed,
                "url": url,
            }),
        }

    matches_found = []
    for m in pattern.finditer(text):
        start = max(0, m.start() - 60)
        end = min(len(text), m.end() + 60)
        context_str = ("..." if start > 0 else "") + text[start:end].strip() + ("..." if end < len(text) else "")
        matches_found.append({
            "matched_text": m.group(0),
            "context": context_str,
            "position": m.start(),
        })
        if len(matches_found) >= 5:
            break

    return {
        "statusCode": 200,
        "headers": cors_headers,
        "body": json.dumps({
            "found": len(matches_found) > 0,
            "matches": matches_found,
            "match_count": len(matches_found),
            "elapsed_ms": elapsed,
            "url": url,
            "error": None,
        }),
    }
