"""
Scrapling sidecar service for mega-agenda.

Reads JSON commands from stdin (one per line), executes scraping,
writes JSON results to stdout (one per line).

Stays alive in a loop -- does not exit after one command.
"""

import json
import sys
import re
import traceback

from scrapling import Fetcher, StealthFetcher


VERSION = "1.0"


def write_response(data: dict) -> None:
    """Write a JSON response line to stdout and flush."""
    sys.stdout.write(json.dumps(data) + "\n")
    sys.stdout.flush()


def health_check() -> dict:
    return {"ok": True, "version": VERSION}


def scrape_yelp(category: str, location: str = "Charlotte NC", limit: int = 20) -> dict:
    """Scrape Yelp search results using StealthFetcher (bot detection)."""
    query = category.replace(" ", "+")
    loc = location.replace(" ", "+")
    url = f"https://www.yelp.com/search?find_desc={query}&find_loc={loc}"

    fetcher = StealthFetcher()
    page = fetcher.fetch(url)

    businesses = []
    for card in page.css('[data-testid="serp-ia-card"]'):
        name_el = card.css_first("a.css-19v1rkv") or card.css_first("h3 a") or card.css_first("a[href*='/biz/']")
        name = name_el.text.strip() if name_el else ""
        link = name_el.attrib.get("href", "") if name_el else ""
        if link and not link.startswith("http"):
            link = "https://www.yelp.com" + link

        rating_el = card.css_first('[aria-label*="star rating"]') or card.css_first('[class*="star"]')
        rating = ""
        if rating_el:
            label = rating_el.attrib.get("aria-label", "")
            match = re.search(r"([\d.]+)", label)
            rating = match.group(1) if match else ""

        phone_el = card.css_first('p[class*="phone"]') or card.css_first('[class*="phone"]')
        phone = phone_el.text.strip() if phone_el else ""

        if name:
            businesses.append({
                "name": name,
                "url": link,
                "rating": rating,
                "phone": phone,
                "source": "yelp",
            })

        if len(businesses) >= limit:
            break

    return {"businesses": businesses}


def scrape_directory(url: str) -> dict:
    """Scrape a business directory page using simple Fetcher."""
    fetcher = Fetcher()
    page = fetcher.fetch(url)

    businesses = []

    # Generic directory scraping -- look for common patterns
    cards = (
        page.css(".card") or
        page.css("[class*='member']") or
        page.css("[class*='listing']") or
        page.css("[class*='directory']") or
        page.css("article")
    )

    for card in cards:
        name_el = card.css_first("h2, h3, h4, .card-title, [class*='name']")
        name = name_el.text.strip() if name_el else ""

        link_el = card.css_first("a[href]")
        link = ""
        if link_el:
            href = link_el.attrib.get("href", "")
            if href.startswith("http"):
                link = href
            elif href.startswith("/"):
                from urllib.parse import urlparse
                parsed = urlparse(url)
                link = f"{parsed.scheme}://{parsed.netloc}{href}"

        phone_el = card.css_first("[class*='phone'], [href^='tel:']")
        phone = ""
        if phone_el:
            tel = phone_el.attrib.get("href", "")
            phone = tel.replace("tel:", "") if tel.startswith("tel:") else phone_el.text.strip()

        addr_el = card.css_first("[class*='address'], address")
        address = addr_el.text.strip() if addr_el else ""

        if name:
            businesses.append({
                "name": name,
                "url": link,
                "phone": phone,
                "address": address,
                "source": "directory",
            })

    return {"businesses": businesses}


def scrape_social_links(url: str) -> dict:
    """Scrape a website for social media profile links."""
    fetcher = Fetcher()
    page = fetcher.fetch(url)

    social = {
        "linkedin": "",
        "facebook": "",
        "instagram": "",
        "twitter": "",
    }

    for a in page.css("a[href]"):
        href = a.attrib.get("href", "").lower()
        if "linkedin.com" in href and not social["linkedin"]:
            social["linkedin"] = a.attrib.get("href", "")
        elif "facebook.com" in href and not social["facebook"]:
            social["facebook"] = a.attrib.get("href", "")
        elif "instagram.com" in href and not social["instagram"]:
            social["instagram"] = a.attrib.get("href", "")
        elif ("twitter.com" in href or "x.com" in href) and not social["twitter"]:
            social["twitter"] = a.attrib.get("href", "")

    return {"social": social}


def scrape_google_search(query: str) -> dict:
    """Scrape Google search results using StealthFetcher."""
    encoded = query.replace(" ", "+")
    url = f"https://www.google.com/search?q={encoded}"

    fetcher = StealthFetcher()
    page = fetcher.fetch(url)

    results = []
    for item in page.css("div.g, div[data-sokoban-container]"):
        link_el = item.css_first("a[href]")
        title_el = item.css_first("h3")

        if link_el and title_el:
            href = link_el.attrib.get("href", "")
            title = title_el.text.strip()
            if href.startswith("http"):
                results.append({"url": href, "title": title})

    return {"results": results}


HANDLERS = {
    "health_check": lambda _: health_check(),
    "scrape_yelp": lambda cmd: scrape_yelp(
        category=cmd.get("category", ""),
        location=cmd.get("location", "Charlotte NC"),
        limit=cmd.get("limit", 20),
    ),
    "scrape_directory": lambda cmd: scrape_directory(url=cmd["url"]),
    "scrape_social_links": lambda cmd: scrape_social_links(url=cmd["url"]),
    "scrape_google_search": lambda cmd: scrape_google_search(query=cmd["query"]),
}


def main() -> None:
    """Main loop: read JSON commands from stdin, dispatch, write results."""
    # Signal readiness
    write_response({"ready": True, "version": VERSION})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            cmd = json.loads(line)
        except json.JSONDecodeError as e:
            write_response({"error": f"Invalid JSON: {e}"})
            continue

        cmd_name = cmd.get("cmd")
        if not cmd_name:
            write_response({"error": "Missing 'cmd' field"})
            continue

        handler = HANDLERS.get(cmd_name)
        if not handler:
            write_response({"error": f"Unknown command: {cmd_name}"})
            continue

        try:
            result = handler(cmd)
            write_response(result)
        except Exception:
            write_response({"error": traceback.format_exc()})


if __name__ == "__main__":
    main()
