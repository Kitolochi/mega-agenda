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
from urllib.parse import urlparse, urlencode

from scrapling import Fetcher, StealthyFetcher


VERSION = "1.1"


def write_response(data: dict) -> None:
    """Write a JSON response line to stdout and flush."""
    sys.stdout.write(json.dumps(data) + "\n")
    sys.stdout.flush()


def health_check() -> dict:
    return {"ok": True, "version": VERSION}


def _extract_yelp_businesses(page, category: str) -> list:
    """Extract business data from a Yelp search results page."""
    businesses = []

    cards = (
        page.css('[data-testid="serp-ia-card"]')
        or page.css('[class*="container"] [class*="searchResult"]')
        or page.css("li.border-color--default")
    )

    for card in cards:
        name_el = (
            card.css_first("a.css-19v1rkv")
            or card.css_first("h3 a")
            or card.css_first("a[href*='/biz/']")
        )
        name = name_el.text.strip() if name_el else ""
        link = name_el.attrib.get("href", "") if name_el else ""
        if link and not link.startswith("http"):
            link = "https://www.yelp.com" + link
        if "/biz/" in link:
            link = link.split("?")[0]

        rating_el = (
            card.css_first('[aria-label*="star rating"]')
            or card.css_first('[class*="star"]')
        )
        rating = ""
        if rating_el:
            label = rating_el.attrib.get("aria-label", "")
            match = re.search(r"([\d.]+)", label)
            rating = match.group(1) if match else ""

        review_count = ""
        review_el = card.css_first('[class*="reviewCount"]') or card.css_first("span.css-chan6m")
        if review_el:
            match = re.search(r"(\d+)", review_el.text)
            review_count = match.group(1) if match else ""
        if not review_count:
            for span in card.css("span"):
                txt = span.text.strip()
                m = re.match(r"^(\d+)\s*reviews?$", txt, re.I)
                if m:
                    review_count = m.group(1)
                    break

        phone_el = card.css_first('p[class*="phone"]') or card.css_first('[class*="phone"]')
        phone = phone_el.text.strip() if phone_el else ""

        address = ""
        addr_el = card.css_first('[class*="secondaryAttributes"] address')
        if not addr_el:
            addr_el = card.css_first("address")
        if not addr_el:
            for p in card.css("p, span"):
                txt = p.text.strip()
                if re.search(r"Charlotte|NC|\d{5}", txt) and len(txt) < 120:
                    address = txt
                    break
        if addr_el:
            address = addr_el.text.strip()

        biz_category = category
        cat_el = card.css_first('[class*="priceCategory"] a') or card.css_first("span.css-11bijt4 a")
        if cat_el:
            biz_category = cat_el.text.strip()

        if name:
            businesses.append({
                "name": name,
                "url": link,
                "rating": rating,
                "reviewCount": review_count,
                "phone": phone,
                "address": address,
                "category": biz_category,
                "website": "",
                "source": "yelp",
            })

    return businesses


def scrape_yelp(category: str, location: str = "Charlotte NC", limit: int = 20) -> dict:
    """Scrape Yelp search results with pagination using StealthyFetcher."""
    fetcher = StealthyFetcher()
    businesses = []
    offset = 0
    page_size = 10
    max_pages = (limit // page_size) + (1 if limit % page_size else 0)
    max_pages = min(max_pages, 5)

    for page_num in range(max_pages):
        params = {
            "find_desc": category,
            "find_loc": location,
        }
        if offset > 0:
            params["start"] = str(offset)

        url = "https://www.yelp.com/search?" + urlencode(params)
        page = fetcher.fetch(url)

        page_results = _extract_yelp_businesses(page, category)
        if not page_results:
            break

        businesses.extend(page_results)

        if len(businesses) >= limit:
            businesses = businesses[:limit]
            break

        offset += page_size

    return {"businesses": businesses}


def scrape_directory(url: str) -> dict:
    """Scrape a business directory page. Handles Charlotte Chamber + generic directories."""
    fetcher = StealthyFetcher()
    is_chamber = "charlotteareachamber.com" in url

    if is_chamber:
        return _scrape_chamber_directory(fetcher, url)
    return _scrape_generic_directory(fetcher, url)


def _scrape_chamber_directory(fetcher, base_url: str) -> dict:
    """Scrape directory.charlotteareachamber.com member directory with pagination."""
    businesses = []
    url = base_url
    max_pages = 10

    for page_num in range(max_pages):
        page = fetcher.fetch(url)

        cards = (
            page.css(".gz-results-card")
            or page.css("[class*='gz-member']")
            or page.css(".card.gz-card")
            or page.css("[class*='mn-search-result']")
            or page.css(".card")
            or page.css("[class*='member']")
            or page.css("[class*='listing']")
            or page.css("article")
        )

        found_on_page = 0
        for card in cards:
            name_el = (
                card.css_first(".gz-results-card-title a")
                or card.css_first("h4.card-title a")
                or card.css_first("h3 a, h4 a, h2 a")
                or card.css_first("[class*='name'] a")
                or card.css_first("a[href*='member']")
            )
            name = name_el.text.strip() if name_el else ""

            link = ""
            if name_el:
                href = name_el.attrib.get("href", "")
                if href.startswith("http"):
                    link = href
                elif href.startswith("/"):
                    parsed = urlparse(base_url)
                    link = f"{parsed.scheme}://{parsed.netloc}{href}"

            phone = ""
            phone_el = card.css_first("[href^='tel:']")
            if phone_el:
                phone = phone_el.attrib.get("href", "").replace("tel:", "")
            if not phone:
                phone_el = card.css_first("[class*='phone']")
                if phone_el:
                    phone = phone_el.text.strip()

            address = ""
            addr_el = (
                card.css_first(".gz-street-address")
                or card.css_first("[class*='address']")
                or card.css_first("address")
            )
            if addr_el:
                address = addr_el.text.strip()
            city_el = card.css_first(".gz-address-city") or card.css_first("[class*='city']")
            if city_el:
                city_text = city_el.text.strip()
                if city_text and city_text not in address:
                    address = f"{address}, {city_text}".strip(", ")

            website = ""
            for a in card.css("a[href]"):
                href = a.attrib.get("href", "")
                text = a.text.strip().lower() if a.text else ""
                if text in ("website", "visit website", "visit site"):
                    website = href
                    break
                if (
                    href.startswith("http")
                    and "charlotteareachamber" not in href
                    and "facebook.com" not in href
                    and "linkedin.com" not in href
                    and "twitter.com" not in href
                    and "instagram.com" not in href
                    and "youtube.com" not in href
                    and "yelp.com" not in href
                    and "growthzoneapp.com" not in href
                    and "tel:" not in href
                    and "mailto:" not in href
                    and not website
                ):
                    website = href

            category = ""
            cat_el = (
                card.css_first("[class*='category']")
                or card.css_first("[class*='tag']")
            )
            if cat_el:
                category = cat_el.text.strip()

            if name:
                businesses.append({
                    "name": name,
                    "url": link,
                    "phone": phone,
                    "address": address,
                    "website": website,
                    "category": category,
                    "source": "chamber",
                })
                found_on_page += 1

        if found_on_page == 0:
            break

        next_link = (
            page.css_first("a[aria-label='Next']")
            or page.css_first("a.next")
            or page.css_first("[class*='pagination'] a[rel='next']")
            or page.css_first("li.next a")
        )
        if not next_link:
            pag_links = page.css("[class*='pagination'] a")
            next_link = None
            for pl in pag_links:
                text = pl.text.strip().lower()
                if text in ("next", ">", ">>", "next page"):
                    next_link = pl
                    break

        if not next_link:
            break

        next_href = next_link.attrib.get("href", "")
        if not next_href:
            break

        if next_href.startswith("http"):
            url = next_href
        elif next_href.startswith("/"):
            parsed = urlparse(base_url)
            url = f"{parsed.scheme}://{parsed.netloc}{next_href}"
        else:
            break

    return {"businesses": businesses}


def _scrape_generic_directory(fetcher, url: str) -> dict:
    """Scrape a generic business directory page."""
    page = fetcher.fetch(url)
    businesses = []

    cards = (
        page.css(".card")
        or page.css("[class*='member']")
        or page.css("[class*='listing']")
        or page.css("[class*='directory']")
        or page.css("article")
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
                parsed = urlparse(url)
                link = f"{parsed.scheme}://{parsed.netloc}{href}"

        phone_el = card.css_first("[class*='phone'], [href^='tel:']")
        phone = ""
        if phone_el:
            tel = phone_el.attrib.get("href", "")
            phone = tel.replace("tel:", "") if tel.startswith("tel:") else phone_el.text.strip()

        addr_el = card.css_first("[class*='address'], address")
        address = addr_el.text.strip() if addr_el else ""

        website = ""
        for a in card.css("a[href]"):
            href = a.attrib.get("href", "")
            text = a.text.strip().lower() if a.text else ""
            if text in ("website", "visit website"):
                website = href
                break

        category = ""
        cat_el = card.css_first("[class*='category']")
        if cat_el:
            category = cat_el.text.strip()

        if name:
            businesses.append({
                "name": name,
                "url": link,
                "phone": phone,
                "address": address,
                "website": website,
                "category": category,
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
    """Scrape Google search results using StealthyFetcher."""
    encoded = query.replace(" ", "+")
    url = f"https://www.google.com/search?q={encoded}"

    fetcher = StealthyFetcher()
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
