#!/usr/bin/env python3
"""
LinguaCompanion — Full E2E Browser Test via browser-use

Тестирует ВСЁ кроме: голосового ввода и Google OAuth (ручное тестирование).
Использует ChatAnthropic (Claude) как LLM для browser-use агента.

Запуск:
    cd C:/lingua-companion
    python tests/e2e/test_full_flow.py

Требования:
    pip install browser-use
    ANTHROPIC_API_KEY в переменных окружения
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from browser_use import Agent, BrowserSession
from langchain_anthropic import ChatAnthropic
from pydantic import BaseModel

# ============================================================
# CONFIG
# ============================================================

BASE_URL = "https://lingua.creatman.site"
API_URL = "https://api.lingua.creatman.site"

# Тестовый аккаунт (создай заранее через Supabase Dashboard или зарегистрируйся вручную)
TEST_EMAIL = "test@creatman.site"
TEST_PASSWORD = "TestLingua2026!"

# Paths
REPORT_DIR = Path("tests/e2e/reports")
REPORT_DIR.mkdir(parents=True, exist_ok=True)
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(REPORT_DIR / f"test_{TIMESTAMP}.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("e2e")


# ============================================================
# OUTPUT SCHEMAS
# ============================================================

class VisualAuditResult(BaseModel):
    """Результат визуальной проверки страницы."""
    page: str
    issues: list[str]
    suggestions: list[str]
    console_errors: list[str]
    overall_score: int  # 1-10


class FlowTestResult(BaseModel):
    """Результат тестирования user flow."""
    flow_name: str
    steps_completed: int
    steps_total: int
    passed: bool
    issues: list[str]
    details: str


# ============================================================
# HELPERS
# ============================================================

def get_llm():
    """Инициализация Claude для browser-use."""
    return ChatAnthropic(
        model_name="claude-sonnet-4-20250514",
        timeout=60,
        temperature=0,
    )


async def run_test(name: str, task: str, browser: BrowserSession, max_steps: int = 50) -> dict:
    """Запустить один тест и вернуть результат."""
    log.info(f"\n{'='*60}\nТЕСТ: {name}\n{'='*60}")

    agent = Agent(
        task=task,
        llm=get_llm(),
        browser_session=browser,
        use_vision=True,
        max_failures=3,
        save_conversation_path=str(REPORT_DIR / f"conv_{name}_{TIMESTAMP}.json"),
        generate_gif=str(REPORT_DIR / f"gif_{name}_{TIMESTAMP}.gif"),
    )

    try:
        history = await agent.run(max_steps=max_steps)
        result = history.final_result()
        log.info(f"РЕЗУЛЬТАТ [{name}]: {result}")
        return {"name": name, "success": True, "result": result, "steps": history.n_steps}
    except Exception as e:
        log.error(f"ОШИБКА [{name}]: {e}")
        return {"name": name, "success": False, "error": str(e)}


# ============================================================
# ТЕСТЫ
# ============================================================

TESTS = [
    # ----------------------------------------------------------
    # 1. BACKEND HEALTH CHECK
    # ----------------------------------------------------------
    {
        "name": "01_api_health",
        "task": f"""
Navigate to {API_URL}/health

Check:
1. Page loads and shows JSON response
2. Response contains "status": "ok" and "version"
3. Note the version number

Report: the exact JSON response and whether it looks correct.
""",
        "max_steps": 10,
    },

    # ----------------------------------------------------------
    # 2. FRONTEND LOADS — VISUAL AUDIT
    # ----------------------------------------------------------
    {
        "name": "02_frontend_loads",
        "task": f"""
Navigate to {BASE_URL}

Perform a thorough visual audit:

1. Does the page load without errors? Check browser console for errors (open DevTools > Console).
2. Is a login screen displayed? (The app requires authentication — no demo mode)
3. Check the login screen UI:
   - Is there a "Sign in with Google" button?
   - Is there an email/password form?
   - Is there a "Sign up" / "Register" toggle?
   - Are there any layout issues? (broken alignment, overflow, cut-off text, wrong colors)
   - Is the design dark-themed and consistent?
   - Are fonts loading correctly? (not falling back to system fonts)
   - Is there a logo or app name "LinguaCompanion"?
4. Check responsive design — is it mobile-friendly? (viewport meta tag present?)
5. Check console for:
   - JavaScript errors
   - Network errors (failed fetch/XHR)
   - CORS errors
   - Supabase connection errors
   - Any warnings

Report ALL findings. Be extremely detailed about any visual issues.
""",
        "max_steps": 20,
    },

    # ----------------------------------------------------------
    # 3. REGISTRATION FLOW
    # ----------------------------------------------------------
    {
        "name": "03_registration",
        "task": f"""
You are on {BASE_URL} login screen.

Test the registration flow:
1. Click "Sign up" or "Register" to switch to registration mode
2. Enter email: {TEST_EMAIL}
3. Enter password: {TEST_PASSWORD}
4. Click the register/sign up button
5. Observe what happens:
   - Does it show a success message?
   - Does it show a verification email notice?
   - Does it redirect to the chat?
   - Does it show an error? (e.g., "User already exists" — that's OK if account exists)
6. Check console for errors during registration

If the user already exists, switch back to login mode and log in with the same credentials.

Report: what happened at each step, any errors, and the final state (logged in or not).
""",
        "max_steps": 25,
    },

    # ----------------------------------------------------------
    # 4. LOGIN FLOW
    # ----------------------------------------------------------
    {
        "name": "04_login",
        "task": f"""
You are on {BASE_URL}.

If already logged in (chat is visible), skip to reporting.
If on login screen:
1. Enter email: {TEST_EMAIL}
2. Enter password: {TEST_PASSWORD}
3. Click "Log in" button
4. Wait for redirect to chat

Check after login:
1. Is the chat interface visible?
2. Is there a header with companion name (Alex/Sam/Morgan)?
3. Is there a VoiceBar at the bottom (text input + mic button)?
4. Is there a settings gear icon?
5. Is there a ⋯ (more) menu icon?
6. Check console for any errors

Also test: what happens if you enter WRONG password? Does it show a helpful error?
(Try wrong password first, then correct one)

Report: all observations about the login UX, error handling, and post-login state.
""",
        "max_steps": 30,
    },

    # ----------------------------------------------------------
    # 5. ONBOARDING FLOW
    # ----------------------------------------------------------
    {
        "name": "05_onboarding",
        "task": f"""
You should now be logged into {BASE_URL} and see the chat interface.

If an onboarding flow starts (companion asks your name, level, etc.):
1. Answer the first question (name): type "Alex Test" and send
2. Wait for companion's next question
3. Answer level: type "B1" and send
4. Wait for companion's next question
5. Answer specialty: type "backend development" and send
6. Wait for companion's next question
7. Answer style preference: type "professional" or "1" and send
8. After onboarding completes, observe:
   - Does it show a welcome message from the chosen companion?
   - Does the companion name update in the header?

If NO onboarding (already completed before), check:
- Is there a chat with messages?
- Feature discovery tooltips — are they showing? Click through them if visible.

Report: full onboarding experience, any issues, companion name after completion.
""",
        "max_steps": 40,
    },

    # ----------------------------------------------------------
    # 6. TEXT CHAT FLOW
    # ----------------------------------------------------------
    {
        "name": "06_text_chat",
        "task": f"""
You should be logged in at {BASE_URL} with the chat interface visible.

Test text messaging:
1. Find the text input field at the bottom
2. Type: "Yesterday I go to office and fix the bug in production"
3. Click send button (or press Enter)
4. Wait for response (observe):
   a. Does a "processing" indicator appear?
   b. Does reconstruction result appear (showing grammar correction)?
   c. Do variant cards appear (5 different ways to say it)?
   d. Does companion response stream in (typewriter effect)?
   e. Does companion response appear as a chat bubble?
5. Check the reconstruction block:
   - Does it show original vs corrected text?
   - Is there a red line (original) and green line (corrected)?
   - Is there an explanation in Russian?
6. Check variant cards:
   - Are there exactly 5 cards? (Simple, Professional, Colloquial, Slang, Idiom)
   - Do cards have colored badges?
   - Do cards show Russian translations?
   - Is there a "Play" button on each card?
   - Is there a "Save" button on each card?
7. Check companion bubble:
   - Is there a "Listen" button (TTS)?
   - Is there a translate 🔄 button?

Send a second message: "I want to deploy new feature but I не знаю how to write tests"
Observe: does the FIRST message's analysis still stay visible? (Bug #6 was about this)

Report: EVERY observation in detail. Note any visual glitches, missing elements, slow responses.
""",
        "max_steps": 40,
    },

    # ----------------------------------------------------------
    # 7. TRANSLATION TOGGLE
    # ----------------------------------------------------------
    {
        "name": "07_translation",
        "task": f"""
You should be in the chat at {BASE_URL} with at least one companion response visible.

Test translation:
1. Find a companion message bubble
2. Look for the 🔄 translate button
3. Click it
4. Observe:
   - Does a loading indicator appear?
   - Does Russian translation appear below the English text?
   - Does the button change state?
5. Click 🔄 again — does it toggle back to English only?
6. Check console for any errors during translation

Also check variant cards:
1. Do any variant cards already show a Russian translation?
2. If yes, is it displayed below the English text in smaller/gray font?
3. If there's a 🔄 button on a card without translation, click it

Report: translation UX, loading time, any errors, visual presentation.
""",
        "max_steps": 25,
    },

    # ----------------------------------------------------------
    # 8. TTS PLAYBACK
    # ----------------------------------------------------------
    {
        "name": "08_tts_playback",
        "task": f"""
You are in the chat at {BASE_URL}.

Test Text-to-Speech:
1. Find a companion message with a "Listen" or "▶" button
2. Click it
3. Observe:
   - Does the button change to "Playing" or "⏸"?
   - Does audio start playing? (You won't hear it, but check if button state changes)
   - Does it return to normal state after playback?
4. Check console for:
   - Network request to /api/v1/tts
   - Response status (200 OK?)
   - Any audio errors

5. Also find a variant card with a "Play" button
6. Click it
7. Same observations as above

Report: TTS button states, network requests, any errors.
""",
        "max_steps": 20,
    },

    # ----------------------------------------------------------
    # 9. SAVE PHRASE (PHRASE LIBRARY)
    # ----------------------------------------------------------
    {
        "name": "09_save_phrase",
        "task": f"""
You are in the chat at {BASE_URL} with variant cards visible.

Test saving phrases:
1. Find a variant card with a "Save" or "+" button
2. Click it
3. Observe:
   - Does the button change state (saved indicator)?
   - Check console for POST request to /api/v1/phrases
   - Is the response 200 OK?
   - Any errors?

4. Now open Phrase Library:
   - Find the ⋯ (more/ellipsis) menu button in the header
   - Click it
   - Click "Phrase Library"
5. Observe the Phrase Library:
   - Does it open as a panel/sheet?
   - Is the saved phrase visible?
   - Does it show: text, style badge, translation, next review date?
   - Are there "All phrases" and "Due for review" tabs?
   - Is there a delete button on the phrase?

6. Close the Phrase Library

Report: full phrase save + library experience, any visual issues.
""",
        "max_steps": 30,
    },

    # ----------------------------------------------------------
    # 10. SETTINGS PANEL
    # ----------------------------------------------------------
    {
        "name": "10_settings",
        "task": f"""
You are in the chat at {BASE_URL}.

Test Settings:
1. Find the settings gear ⚙ icon in the header
2. Click it
3. Observe the Settings panel:
   - Does it open as a side sheet?
   - Sections present:
     a. Companion selection (Alex/Sam/Morgan with descriptions)
     b. Voice selection (US Male/Female, GB Male/Female)
     c. Speed slider (0.8x - 1.2x)
     d. Topic preference (IT / Mixed / Any)
     e. Level (A2 / B1 / B2)
     f. Theme (Dark / Light)
     g. Notifications toggle
     h. Account section with email and "Log out" button
   - Are all sections properly styled?
   - Any overflow, alignment, or spacing issues?

4. Test companion change:
   - Select "Sam" (if currently Alex)
   - Does the header update to show "Sam"?
   - Does the chat continue working?

5. Test "Test voice" button (if present):
   - Click it
   - Check console for TTS request

6. Close settings

Report: ALL visual details, any missing sections, alignment issues, functionality.
""",
        "max_steps": 30,
    },

    # ----------------------------------------------------------
    # 11. STATS SCREEN
    # ----------------------------------------------------------
    {
        "name": "11_stats",
        "task": f"""
You are in the chat at {BASE_URL}.

Test Stats/Progress:
1. Click the ⋯ (more) menu in header
2. Click "Stats & Progress"
3. Observe:
   - Does the stats panel open?
   - Is there a streak counter?
   - Is there a stats grid (Sessions, Messages, Practice Time, Phrases)?
   - Is there a chart (bar chart for recent activity)?
   - Is there an error breakdown section?
   - For a new user, does it show "0" values or an empty state message?
   - Any visual issues?

4. Close the stats panel

Report: all observations about the stats screen.
""",
        "max_steps": 20,
    },

    # ----------------------------------------------------------
    # 12. SCENARIO MODE
    # ----------------------------------------------------------
    {
        "name": "12_scenario",
        "task": f"""
You are in the chat at {BASE_URL}.

Test Scenario Mode:
1. Find the tab bar (should have "Free Chat" and "Scenario" tabs)
2. Click "Scenario" tab
3. Observe:
   - Are scenario cards displayed? (Daily Stand-up, Code Review, Tech Demo, Job Interview, Sprint Planning, Slack Message)
   - Does each card have: emoji, name, description, level badge?
   - Any visual issues with the cards?

4. Click a scenario (e.g., "Code Review")
5. Observe:
   - Does the chat clear?
   - Does the header show scenario info?
   - Are roles visible? (e.g., "You: Developer, Alex: Tech Lead")
   - Does the companion send a scenario-appropriate opening message?

6. Type a message in the scenario context: "I want to review the authentication module changes"
7. Wait for response — does companion stay in character?

8. Exit scenario (find "Exit" button)
9. Observe: does it return to Free Chat mode?

Report: full scenario experience, role display, companion behavior.
""",
        "max_steps": 35,
    },

    # ----------------------------------------------------------
    # 13. END SESSION + SUMMARY
    # ----------------------------------------------------------
    {
        "name": "13_session_summary",
        "task": f"""
You are in the chat at {BASE_URL} with some conversation history.

Test End Session:
1. Click the ⋯ (more) menu in header
2. Click "End Session"
3. Observe:
   - Is there a confirmation dialog? ("End session and see summary?")
   - Click confirm/yes

4. Wait for summary to load:
   - Does a loading indicator appear?
   - Does the summary modal appear?
   - Does it show: duration, message count, new words, top errors, advice?
   - Is the advice personalized (mentions something from the conversation)?

5. Find "New Session" button
   - Click it
   - Does the chat clear?
   - Does a fresh welcome message appear?

Report: full end-session experience, summary content quality, any issues.
""",
        "max_steps": 30,
    },

    # ----------------------------------------------------------
    # 14. HEADER DROPDOWN MENU — FULL CHECK
    # ----------------------------------------------------------
    {
        "name": "14_header_menu",
        "task": f"""
You are at {BASE_URL} logged in.

Test the ⋯ header menu thoroughly:
1. Click the ⋯ button
2. Check menu items:
   - "Stats & Progress" with chart icon
   - "Phrase Library" with book icon
   - Divider line
   - "End Session" in red with logout icon
3. Click outside the menu — does it close?
4. Click ⋯ again — does it reopen?
5. Is the menu positioned correctly (not overflowing screen)?
6. On mobile viewport (if possible, resize window to 390px width) — does menu still work?

Report: menu behavior, positioning, visual quality.
""",
        "max_steps": 20,
    },

    # ----------------------------------------------------------
    # 15. VOICEBAR COMPACT DESIGN CHECK
    # ----------------------------------------------------------
    {
        "name": "15_voicebar_design",
        "task": f"""
You are at {BASE_URL} logged in.

Audit the VoiceBar (input area at bottom):
1. Is it a SINGLE ROW? (not two modes, not tall)
2. Measure visually: does it take less than ~60px height?
3. Elements present:
   - Text input field
   - Mic button (small, ~36px, round, blue)
   - Send button (appears when text is entered?)
4. Type some text — does send button appear? Does mic button hide?
5. Clear text — does mic button reappear?
6. Are there any "Text mode" / "Voice mode" toggle pills? (There should NOT be)
7. Is the overall design clean and Telegram-like?

Report: every visual detail about the VoiceBar.
""",
        "max_steps": 20,
    },

    # ----------------------------------------------------------
    # 16. CONSOLE ERRORS COMPREHENSIVE CHECK
    # ----------------------------------------------------------
    {
        "name": "16_console_audit",
        "task": f"""
You are at {BASE_URL} logged in.

Open browser DevTools (F12) > Console tab.

1. Clear console
2. Refresh the page (F5)
3. Wait for full load
4. Document EVERY console message:
   - Errors (red)
   - Warnings (yellow)
   - Info messages
5. Navigate through the app:
   - Open Settings, close
   - Open Stats, close
   - Open Phrase Library, close
   - Switch to Scenario tab, back to Free Chat
   - Send a text message
6. After each action, check for new console messages
7. Check Network tab:
   - Any failed requests (red)?
   - Any CORS errors?
   - WebSocket connection status — is it connected?

Report: EVERY console error/warning with exact message text. Every failed network request.
""",
        "max_steps": 35,
    },

    # ----------------------------------------------------------
    # 17. RESPONSIVE DESIGN CHECK
    # ----------------------------------------------------------
    {
        "name": "17_responsive",
        "task": f"""
You are at {BASE_URL} logged in.

Test responsive design:
1. Current viewport — note any issues
2. If possible, resize the browser window to approximately:
   - 390px width (iPhone SE) — check for:
     - No horizontal scroll
     - Text not cut off
     - Buttons reachable
     - Header not cramped
     - VoiceBar fits properly
   - 768px width (tablet) — same checks
   - 1920px width (desktop) — chat centered? Not stretched too wide?
3. Check for:
   - Text overflow (words breaking mid-word)
   - Images/elements overflowing containers
   - Scroll behavior (smooth scrolling in chat area?)
   - Safe area insets (top/bottom padding on mobile)

Report: responsive behavior at each viewport size.
""",
        "max_steps": 25,
    },

    # ----------------------------------------------------------
    # 18. FEATURE DISCOVERY TOOLTIPS
    # ----------------------------------------------------------
    {
        "name": "18_feature_tips",
        "task": f"""
You are at {BASE_URL}.

Check for feature discovery tooltips:
1. If this is a first-time login (or clear localStorage key "lc-features-discovered"):
   - Open DevTools > Application > Local Storage > {BASE_URL}
   - Delete the key "lc-features-discovered" if it exists
   - Refresh the page
2. After a few seconds, do tooltips appear?
3. If tooltips show:
   - How many steps? (should be 4)
   - Content of each tip
   - Is there a Next/Done button?
   - Click through all steps
   - After last step, do they disappear?
   - Is "lc-features-discovered" now set in localStorage?
4. Refresh again — do tooltips NOT show? (they should only show once)

Report: tooltip UX, content quality, any issues.
""",
        "max_steps": 25,
    },

    # ----------------------------------------------------------
    # 19. MESSAGE PERSISTENCE CHECK
    # ----------------------------------------------------------
    {
        "name": "19_persistence",
        "task": f"""
You are at {BASE_URL} with some messages in chat.

Test message persistence:
1. Note the current messages in chat (count and content)
2. Open DevTools > Application > Local Storage
3. Find key "lc-messages"
4. Is it present? What's its size?
5. Refresh the page (F5)
6. After reload:
   - Are the messages still visible?
   - Is the count the same?
   - Are analysis results (reconstruction, variants) preserved?
   - Is message order correct?
7. Check: are audio blobs preserved? (They should NOT be — too large)

Report: persistence behavior, any data loss on reload.
""",
        "max_steps": 20,
    },

    # ----------------------------------------------------------
    # 20. LOGOUT FLOW
    # ----------------------------------------------------------
    {
        "name": "20_logout",
        "task": f"""
You are at {BASE_URL} logged in.

Test logout:
1. Open Settings (gear icon)
2. Scroll to Account section
3. Note the displayed email
4. Click "Log out" button
5. Observe:
   - Does it redirect to login screen?
   - Is the chat history cleared?
   - Is localStorage cleaned (check DevTools)?
6. Try to navigate directly to {BASE_URL} — does it show login screen?

Report: logout behavior, cleanup, security.
""",
        "max_steps": 20,
    },
]


# ============================================================
# MAIN RUNNER
# ============================================================

async def main():
    log.info(f"Starting LinguaCompanion E2E Test Suite — {TIMESTAMP}")
    log.info(f"Target: {BASE_URL}")
    log.info(f"Reports: {REPORT_DIR}/")

    browser = BrowserSession(
        headless=False,  # Видимый браузер для отладки
    )

    results = []

    for test_config in TESTS:
        try:
            result = await run_test(
                name=test_config["name"],
                task=test_config["task"],
                browser=browser,
                max_steps=test_config.get("max_steps", 30),
            )
            results.append(result)
        except KeyboardInterrupt:
            log.warning("Interrupted by user")
            break
        except Exception as e:
            log.error(f"Test {test_config['name']} crashed: {e}")
            results.append({"name": test_config["name"], "success": False, "error": str(e)})

    # ---- SUMMARY ----
    log.info(f"\n{'='*60}\nSUMMARY\n{'='*60}")

    passed = sum(1 for r in results if r.get("success"))
    failed = len(results) - passed

    for r in results:
        status = "✅" if r.get("success") else "❌"
        log.info(f"  {status} {r['name']}")
        if not r.get("success") and r.get("error"):
            log.info(f"     Error: {r['error'][:100]}")

    log.info(f"\nTotal: {len(results)} | Passed: {passed} | Failed: {failed}")

    # Save JSON report
    report_path = REPORT_DIR / f"report_{TIMESTAMP}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    log.info(f"Report saved: {report_path}")

    await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
