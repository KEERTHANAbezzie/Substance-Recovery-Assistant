"""
AI Recovery Companion — Streamlit version
Run: streamlit run streamlit_app.py

Requires an Anthropic API key set in Streamlit secrets:
  .streamlit/secrets.toml
    ANTHROPIC_API_KEY = "sk-ant-..."
"""

import json
import os
from datetime import datetime

import streamlit as st
from anthropic import Anthropic

DATA_FILE = "recovery_data.json"
MODEL = "claude-sonnet-5"

COMPANION_VOICE = """You are a quiet, emotionally intelligent recovery companion built into an app \
for someone navigating a substance use disorder.
You are not a therapist and never claim to be one. You are more like a steady, observant friend \
who has been paying attention.
Tone rules:
- Never lecture, never guilt-trip, never say "you should" or "stay strong."
- Notice patterns instead of giving commands. Prefer "I noticed..." over "You need to..."
- Keep responses short: 2-4 sentences unless asked for a structured script.
- Reference the person's own history and preferences naturally, without over-explaining that you're doing so.
- If real danger, medical emergency, or suicidal intent is present, gently and clearly direct them to \
emergency services or a crisis line in addition to anything else you say."""

EMOTIONS = [
    ("anxious", "Anxious", "😰"),
    ("lonely", "Lonely", "😞"),
    ("angry", "Angry", "😡"),
    ("sad", "Sad", "😔"),
    ("cant_sleep", "Can't Sleep", "😴"),
    ("overwhelmed", "Overwhelmed", "😵"),
    ("need_someone", "Need Someone", "💬"),
    ("okay", "Actually Okay", "🙂"),
]

# ---------- persistence ----------

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {"profile": None, "memory": {"what_worked": {}}, "mood_history": [], "journal": []}


def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)


if "data" not in st.session_state:
    st.session_state.data = load_data()
if "screen" not in st.session_state:
    st.session_state.screen = "onboarding" if not st.session_state.data["profile"] else "home"
if "onboard_step" not in st.session_state:
    st.session_state.onboard_step = 0
if "draft" not in st.session_state:
    st.session_state.draft = {"name": "", "goal": "", "triggers": "", "medical": "", "favorites": "", "emergency_contact": ""}

# ---------- AI helper ----------

@st.cache_resource
def get_client():
    api_key = st.secrets.get("ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY"))
    if not api_key:
        st.error("No ANTHROPIC_API_KEY found. Add it to .streamlit/secrets.toml or your environment.")
        st.stop()
    return Anthropic(api_key=api_key)


def call_claude(system_prompt, user_prompt, expect_json=False):
    client = get_client()
    resp = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    text = "".join(block.text for block in resp.content if block.type == "text")
    if expect_json:
        clean = text.replace("```json", "").replace("```", "").strip()
        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            return {"raw": text}
    return text


def build_memory_context():
    profile = st.session_state.data["profile"]
    memory = st.session_state.data["memory"]
    mood_history = st.session_state.data["mood_history"]

    recent = ", ".join(
        f"{m['emotion']} ({m['at'][:10]})" for m in mood_history[-5:]
    ) or "none yet"
    worked = sorted(memory["what_worked"].items(), key=lambda x: -x[1])[:3]
    worked_str = ", ".join(f"{k} (helped {v}x)" for k, v in worked) or "nothing logged yet"

    return f"""Name: {profile.get('name') or 'friend'}
Recovery goal: {profile.get('goal') or 'not specified'}
Known triggers: {profile.get('triggers') or 'not specified'}
Medical conditions to respect (never recommend anything unsafe for these): {profile.get('medical') or 'none listed'}
Favourite things (use naturally, don't overdo it): {profile.get('favorites') or 'not specified'}
Emergency contact: {profile.get('emergency_contact') or 'not specified'}
Recent check-ins: {recent}
What has worked before: {worked_str}"""


# ---------- UI helpers ----------

def companion(state="calm"):
    colors = {"calm": "🟢", "listening": "🟡", "thinking": "🟠", "alert": "🔴"}
    st.markdown(
        f"<div style='text-align:center; font-size:48px; margin:10px 0;'>{colors.get(state, '🟢')}</div>",
        unsafe_allow_html=True,
    )


def go(screen):
    st.session_state.screen = screen
    st.rerun()


# ---------- screens ----------

def screen_onboarding():
    steps = [
        ("name", "What should I call you?"),
        ("goal", "What does recovery look like for you right now? One sentence is enough."),
        ("triggers", "Are there times, places, or feelings that tend to make things harder?"),
        ("medical", "Anything medical I should always keep in mind before suggesting activities?"),
        ("favorites", "What do you love? Shows, music, characters, sports — anything that lifts you."),
        ("emergency_contact", "Who's one person I could gently suggest reaching out to in a hard moment?"),
    ]
    step = st.session_state.onboard_step
    key, label = steps[step]

    companion("listening")
    st.progress((step + 1) / len(steps))
    st.subheader(label)
    st.session_state.draft[key] = st.text_input(
        "", value=st.session_state.draft[key], key=f"input_{key}", label_visibility="collapsed"
    )

    col1, col2 = st.columns([1, 3])
    with col1:
        if step > 0 and st.button("Back"):
            st.session_state.onboard_step -= 1
            st.rerun()
    with col2:
        label_btn = "I'm ready" if step == len(steps) - 1 else "Continue"
        if st.button(label_btn, type="primary", use_container_width=True):
            if step == len(steps) - 1:
                st.session_state.data["profile"] = dict(st.session_state.draft)
                save_data(st.session_state.data)
                go("home")
            else:
                st.session_state.onboard_step += 1
                st.rerun()


def screen_home():
    profile = st.session_state.data["profile"]
    hour = datetime.now().hour
    greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 18 else "Good evening"

    companion("calm")
    st.markdown(f"<h2 style='text-align:center;'>{greeting}, {profile.get('name') or 'friend'}</h2>", unsafe_allow_html=True)
    st.write("")

    if st.button("🚨  Help Now", use_container_width=True):
        go("emergency")
    if st.button("😊  Check In", use_container_width=True):
        go("checkin")
    if st.button("📖  Journal", use_container_width=True):
        go("journal")


def screen_checkin():
    if st.button("← Back"):
        go("home")

    picked = st.session_state.get("picked_emotion")

    if not picked:
        companion("listening")
        st.subheader("What's going on right now?")
        cols = st.columns(2)
        for i, (key, label, emoji) in enumerate(EMOTIONS):
            with cols[i % 2]:
                if st.button(f"{emoji}  {label}", key=f"emo_{key}", use_container_width=True):
                    st.session_state.picked_emotion = {"key": key, "label": label}
                    st.rerun()
        return

    companion("thinking")
    with st.spinner("Thinking with you..."):
        context = build_memory_context()
        prompt = f"""Context about this person:
{context}

They just tapped the emotion button: "{picked['label']}".

Respond in JSON only, no markdown, no preamble:
{{
  "reflection": "a short warm, non-judgmental reflection acknowledging how they feel, referencing a real pattern from their history if relevant (2-3 sentences)",
  "suggestion": "one tiny, concrete, under-5-minute coping action suited to their medical notes and past successes",
  "journal_summary": "a first-person-adjacent journal entry written FOR them, 2-3 sentences, capturing mood, likely trigger, and the action offered"
}}"""
        result = call_claude(COMPANION_VOICE, prompt, expect_json=True)

    companion("calm")
    st.info(result.get("reflection", result.get("raw", "I'm here with you.")))
    if result.get("suggestion"):
        st.success(f"**Maybe try:** {result['suggestion']}")

    now = datetime.now().isoformat()
    st.session_state.data["mood_history"].append({"emotion": picked["key"], "at": now})
    st.session_state.data["journal"].append({
        "at": now,
        "emotion": picked["key"],
        "summary": result.get("journal_summary", result.get("reflection", "")),
    })
    save_data(st.session_state.data)

    if st.button("Back home", type="primary", use_container_width=True):
        del st.session_state.picked_emotion
        go("home")


def screen_emergency():
    if st.button("Not now"):
        go("home")

    companion("alert")
    with st.spinner("I'm here. One second..."):
        context = build_memory_context()
        prompt = f"""Context about this person:
{context}

They just pressed the "Help Now" emergency button. This means they are in a hard moment right now \
and may be at risk of relapse, panic, or crisis.

Respond in JSON only:
{{
  "opening": "one calm sentence to say first, grounding them in the present moment",
  "grounding": "a short, concrete grounding or breathing exercise, 2-3 sentences, respecting any medical notes",
  "personal_note": "one sentence referencing something specific that has worked for them before or someone they trust, if known — otherwise a warm general note",
  "escalate": true or false — true only if there are real signs of danger requiring professional/crisis help based on context given (default false)
}}"""
        script = call_claude(COMPANION_VOICE, prompt, expect_json=True)

    companion("calm")
    st.markdown(f"### {script.get('opening', '')}")
    st.write(script.get("grounding", ""))
    if script.get("personal_note"):
        st.info(script["personal_note"])
    if script.get("escalate"):
        contact = st.session_state.data["profile"].get("emergency_contact")
        extra = f" Calling {contact} right now could help too." if contact else ""
        st.error(
            "If you're in immediate danger, please reach out to emergency services now, "
            f"or a crisis line, before anything else.{extra}"
        )

    if st.button("I'm steadier now", type="primary", use_container_width=True):
        go("home")


def screen_journal():
    if st.button("← Back"):
        go("home")

    st.subheader("Your story")
    entries = list(reversed(st.session_state.data["journal"]))
    if not entries:
        st.caption("Nothing here yet — check in when something's going on, and I'll write it down for you.")
    for e in entries:
        with st.container(border=True):
            st.caption(datetime.fromisoformat(e["at"]).strftime("%b %d, %Y — %I:%M %p"))
            st.write(e["summary"])


# ---------- router ----------

st.set_page_config(page_title="AI Recovery Companion", page_icon="🌙", layout="centered")

screens = {
    "onboarding": screen_onboarding,
    "home": screen_home,
    "checkin": screen_checkin,
    "emergency": screen_emergency,
    "journal": screen_journal,
}
screens[st.session_state.screen]()
