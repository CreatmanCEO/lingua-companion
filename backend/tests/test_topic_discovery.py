"""
Tests for Topic Discovery Agent.
"""
import json
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

from app.agents.topic_discovery import fetch_rss, generate_discussion_prompt

# Sample RSS XML (HN-style)
SAMPLE_RSS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Hacker News</title>
    <item>
      <title>Show HN: A new approach to LLM fine-tuning</title>
      <link>https://example.com/article1</link>
      <description>Interesting approach to fine-tuning large language models.</description>
    </item>
    <item>
      <title>Rust vs Go for backend services</title>
      <link>https://example.com/article2</link>
      <description>Performance comparison of Rust and Go.</description>
    </item>
  </channel>
</rss>
"""

# Sample Atom XML (Reddit-style)
SAMPLE_ATOM_XML = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>r/programming</title>
  <entry>
    <title>Understanding async/await in Python</title>
    <link href="https://reddit.com/r/programming/post1"/>
    <content type="html">Deep dive into Python asyncio.</content>
  </entry>
  <entry>
    <title>WebAssembly is changing the web</title>
    <link href="https://reddit.com/r/programming/post2"/>
    <content type="html">How WASM is transforming web development.</content>
  </entry>
</feed>
"""


@pytest.mark.asyncio
async def test_fetch_rss_parses_rss_format():
    """Test parsing of standard RSS format (HN)."""
    mock_response = MagicMock()
    mock_response.text = SAMPLE_RSS_XML
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.agents.topic_discovery.httpx.AsyncClient", return_value=mock_client):
        items = await fetch_rss("https://hnrss.org/frontpage", "hn")

    assert len(items) == 2
    assert items[0]["title"] == "Show HN: A new approach to LLM fine-tuning"
    assert items[0]["url"] == "https://example.com/article1"
    assert items[0]["source"] == "hn"
    assert items[1]["title"] == "Rust vs Go for backend services"


@pytest.mark.asyncio
async def test_fetch_rss_parses_atom_format():
    """Test parsing of Atom format (Reddit)."""
    mock_response = MagicMock()
    mock_response.text = SAMPLE_ATOM_XML
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.agents.topic_discovery.httpx.AsyncClient", return_value=mock_client):
        items = await fetch_rss("https://reddit.com/.rss", "reddit")

    assert len(items) == 2
    assert items[0]["title"] == "Understanding async/await in Python"
    assert items[0]["url"] == "https://reddit.com/r/programming/post1"
    assert items[0]["source"] == "reddit"


@pytest.mark.asyncio
async def test_fetch_rss_handles_network_error():
    """Test graceful handling of network failures."""
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.agents.topic_discovery.httpx.AsyncClient", return_value=mock_client):
        items = await fetch_rss("https://bad-url.example.com", "hn")

    assert items == []


@pytest.mark.asyncio
async def test_generate_discussion_prompt_success():
    """Test discussion prompt generation with mocked LLM."""
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(
            content=json.dumps({"discussion_prompt": "What are your thoughts on LLM fine-tuning?"})
        ))
    ]

    with patch("app.agents.topic_discovery.litellm.acompletion", new_callable=AsyncMock, return_value=mock_response):
        prompt = await generate_discussion_prompt("LLM Fine-tuning", "New approach to fine-tuning", "B1")

    assert prompt == "What are your thoughts on LLM fine-tuning?"


@pytest.mark.asyncio
async def test_generate_discussion_prompt_fallback_on_error():
    """Test fallback prompt when LLM fails."""
    with patch("app.agents.topic_discovery.litellm.acompletion", new_callable=AsyncMock, side_effect=Exception("API error")):
        prompt = await generate_discussion_prompt("Rust vs Go", "Performance comparison", "B1")

    assert "Rust vs Go" in prompt
    assert "What do you think" in prompt


@pytest.mark.asyncio
async def test_fetch_rss_handles_empty_xml():
    """Test parsing of empty RSS feed."""
    empty_rss = """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel><title>Empty</title></channel></rss>"""

    mock_response = MagicMock()
    mock_response.text = empty_rss
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.agents.topic_discovery.httpx.AsyncClient", return_value=mock_client):
        items = await fetch_rss("https://hnrss.org/frontpage", "hn")

    assert items == []
