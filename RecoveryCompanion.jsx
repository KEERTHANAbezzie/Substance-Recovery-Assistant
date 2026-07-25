import { useState, useEffect, useRef } from "react";

/* ---------------------------------------------------------
   AI Recovery Companion — core vertical slice
   Signature element: "the Companion" — a slow breathing orb
   that is always present, always calm, and shifts color
   gently with the user's state instead of showing charts
   or numbers up front.
--------------------------------------------------------- */

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap";

const palette = {
  bg: "#0f1320",
  panel: "#171d2e",
  panelLight: "#212a41",
  border: "#2a3350",
  textPrimary: "#f1ece2",
  textMuted: "#8f97ac",
  amber: "#e0a458",
  teal: "#5fa8a0",
  coral: "#e2634f",
};

const EMOTIONS = [
  { key: "anxious", label: "Anxious", emoji: "😰" },
  { key: "lonely", label: "Lonely", emoji: "😞" },
  { key: "angry", label: "Angry", emoji: "😡" },
  { key: "sad", label: "Sad", emoji: "😔" },
  { key: "cant_sleep", label: "Can't Sleep", emoji: "😴" },
  { key: "overwhelmed", label: "Overwhelmed", emoji: "😵" },
  { key: "need_someone", label: "Need Someone", emoji: "💬" },
  { key: "okay", label: "Actually Okay", emoji: "🙂" },
];

function useCompanionPulse(state) {
  // state: 'calm' | 'listening' | 'thinking' | 'alert'
  const colors = {
    calm: palette.teal,
    listening: palette.amber,
    thinking: palette.amber,
    alert: palette.coral,
  };
  return colors[state] || palette.teal;
}

function Companion({ state = "calm", size = 120 }) {
  const color = useCompanionPulse(state);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, ${color}55, ${color}22 60%, transparent 75%)`,
        border: `1px solid ${color}66`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: state === "thinking" ? "companion-think 1.4s ease-in-out infinite" : "companion-breathe 4.5s ease-in-out infinite",
        transition: "background 0.8s ease",
      }}
    >
      <div
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}, ${color}99)`,
          boxShadow: `0 0 ${size * 0.3}px ${color}55`,
        }}
      />
    </div>
  );
}

async function callClaude(systemPrompt, userPrompt, expectJson = false) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  if (expectJson) {
    const clean = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(clean);
    } catch {
      return { raw: text };
    }
  }
  return text;
}

const COMPANION_VOICE = `You are a quiet, emotionally intelligent recovery companion built into an app for someone navigating a substance use disorder.
You are not a therapist and never claim to be one. You are more like a steady, observant friend who has been paying attention.
Tone rules:
- Never lecture, never guilt-trip, never say "you should" or "stay strong."
- Notice patterns instead of giving commands. Prefer "I noticed..." over "You need to..."
- Keep responses short: 2-4 sentences unless asked for a structured script.
- Reference the person's own history and preferences naturally, without over-explaining that you're doing so.
- If real danger, medical emergency, or suicidal intent is present, gently and clearly direct them to emergency services or a crisis line in addition to anything else you say.`;

function buildMemoryContext(profile, memory, moodHistory) {
  const recentMoods = moodHistory.slice(-5).map((m) => `${m.emotion} (${new Date(m.at).toLocaleDateString()})`).join(", ") || "none yet";
  const workedList = Object.entries(memory.whatWorked || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} (helped ${v}x)`)
    .join(", ") || "nothing logged yet";
  return `
Name: ${profile.name || "friend"}
Recovery goal: ${profile.goal || "not specified"}
Known triggers: ${profile.triggers || "not specified"}
Medical conditions to respect (never recommend anything unsafe for these): ${profile.medical || "none listed"}
Favourite things (use naturally for encouragement, don't overdo it): ${profile.favorites || "not specified"}
Emergency contact: ${profile.emergencyContact || "not specified"}
Recent check-ins: ${recentMoods}
What has worked before: ${workedList}
`.trim();
}

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [memory, setMemory] = useState({ whatWorked: {} });
  const [moodHistory, setMoodHistory] = useState([]);
  const [journal, setJournal] = useState([]);
  const [onboardStep, setOnboardStep] = useState(0);
  const [draft, setDraft] = useState({ name: "", goal: "", triggers: "", medical: "", favorites: "", emergencyContact: "" });

  useEffect(() => {
    (async () => {
      try {
        const p = await window.storage.get("profile");
        const m = await window.storage.get("memory");
        const mh = await window.storage.get("mood-history");
        const j = await window.storage.get("journal");
        if (p) setProfile(JSON.parse(p.value));
        if (m) setMemory(JSON.parse(m.value));
        if (mh) setMoodHistory(JSON.parse(mh.value));
        if (j) setJournal(JSON.parse(j.value));
        setScreen(p ? "home" : "onboarding");
      } catch {
        setScreen("onboarding");
      }
    })();
  }, []);

  async function saveProfile(p) {
    setProfile(p);
    await window.storage.set("profile", JSON.stringify(p));
  }
  async function saveMemory(m) {
    setMemory(m);
    await window.storage.set("memory", JSON.stringify(m));
  }
  async function saveMoodHistory(mh) {
    setMoodHistory(mh);
    await window.storage.set("mood-history", JSON.stringify(mh));
  }
  async function saveJournal(j) {
    setJournal(j);
    await window.storage.set("journal", JSON.stringify(j));
  }

  function completeOnboarding() {
    saveProfile(draft);
    setScreen("home");
  }

  if (screen === "loading") {
    return (
      <Shell>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}>
          <Companion state="calm" />
        </div>
      </Shell>
    );
  }

  if (screen === "onboarding") {
    return (
      <Shell>
        <Onboarding
          step={onboardStep}
          setStep={setOnboardStep}
          draft={draft}
          setDraft={setDraft}
          onDone={completeOnboarding}
        />
      </Shell>
    );
  }

  if (screen === "checkin") {
    return (
      <Shell>
        <CheckIn
          profile={profile}
          memory={memory}
          moodHistory={moodHistory}
          onLogged={async (entry, memoryUpdate, journalEntry) => {
            const newMh = [...moodHistory, entry];
            await saveMoodHistory(newMh);
            if (memoryUpdate) {
              const nm = { ...memory, whatWorked: { ...memory.whatWorked, [memoryUpdate]: (memory.whatWorked[memoryUpdate] || 0) + 1 } };
              await saveMemory(nm);
            }
            if (journalEntry) {
              await saveJournal([...journal, journalEntry]);
            }
          }}
          onBack={() => setScreen("home")}
        />
      </Shell>
    );
  }

  if (screen === "emergency") {
    return (
      <Shell>
        <Emergency profile={profile} memory={memory} moodHistory={moodHistory} onBack={() => setScreen("home")} />
      </Shell>
    );
  }

  if (screen === "journal") {
    return (
      <Shell>
        <Journal entries={journal} onBack={() => setScreen("home")} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Home profile={profile} onNav={setScreen} />
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div
      style={{
        minHeight: "100%",
        background: `radial-gradient(1200px 600px at 50% -10%, ${palette.panelLight} 0%, ${palette.bg} 55%)`,
        color: palette.textPrimary,
        fontFamily: "Inter, sans-serif",
        padding: "28px 20px 60px",
      }}
    >
      <style>{`
        @import url('${FONT_LINK}');
        @keyframes companion-breathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes companion-think {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(0.94); }
        }
        button { font-family: inherit; cursor: pointer; }
        .rc-display { font-family: 'Fraunces', serif; }
      `}</style>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function BigButton({ emoji, label, onClick, accent = palette.teal, sub }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: palette.panel,
        border: `1px solid ${palette.border}`,
        borderRadius: 16,
        padding: "16px 18px",
        marginBottom: 12,
        textAlign: "left",
        transition: "transform 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = palette.border)}
    >
      <div style={{ fontSize: 26 }}>{emoji}</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: palette.textPrimary }}>{label}</div>
        {sub && <div style={{ fontSize: 13, color: palette.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
    </button>
  );
}

function Onboarding({ step, setStep, draft, setDraft, onDone }) {
  const steps = [
    { key: "name", label: "What should I call you?", placeholder: "First name" },
    { key: "goal", label: "What does recovery look like for you right now? One sentence is enough.", placeholder: "e.g. stay clear-headed for my daughter" },
    { key: "triggers", label: "Are there times, places, or feelings that tend to make things harder?", placeholder: "e.g. Friday nights, being alone, work stress" },
    { key: "medical", label: "Anything medical I should always keep in mind before suggesting activities?", placeholder: "e.g. asthma, pregnancy, anxiety — or leave blank" },
    { key: "favorites", label: "What do you love? Shows, music, characters, sports — anything that lifts you.", placeholder: "e.g. Rocky, Naruto, lo-fi playlists" },
    { key: "emergencyContact", label: "Who's one person I could gently suggest reaching out to in a hard moment?", placeholder: "e.g. my sister Meera" },
  ];
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div style={{ paddingTop: 40 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <Companion state="listening" size={90} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= step ? palette.amber : palette.border }} />
        ))}
      </div>
      <h2 className="rc-display" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.4, marginBottom: 20 }}>
        {current.label}
      </h2>
      <input
        autoFocus
        value={draft[current.key]}
        onChange={(e) => setDraft({ ...draft, [current.key]: e.target.value })}
        placeholder={current.placeholder}
        style={{
          width: "100%",
          background: palette.panel,
          border: `1px solid ${palette.border}`,
          borderRadius: 12,
          padding: "14px 16px",
          color: palette.textPrimary,
          fontSize: 15,
          outline: "none",
          marginBottom: 24,
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 10 }}>
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{ padding: "12px 18px", borderRadius: 10, background: "transparent", border: `1px solid ${palette.border}`, color: palette.textMuted }}
          >
            Back
          </button>
        )}
        <button
          onClick={() => (isLast ? onDone() : setStep(step + 1))}
          style={{
            flex: 1,
            padding: "12px 18px",
            borderRadius: 10,
            background: palette.amber,
            border: "none",
            color: "#1a1200",
            fontWeight: 600,
          }}
        >
          {isLast ? "I'm ready" : "Continue"}
        </button>
      </div>
      <button
        onClick={() => setStep(steps.length)}
        style={{ display: step === steps.length - 1 ? "none" : "block", marginTop: 14, background: "none", border: "none", color: palette.textMuted, fontSize: 13, textDecoration: "underline" }}
      >
        Skip for now, ask me later
      </button>
    </div>
  );
}

function Home({ profile, onNav }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div style={{ paddingTop: 30 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <Companion state="calm" size={110} />
      </div>
      <h1 className="rc-display" style={{ textAlign: "center", fontSize: 24, fontWeight: 500, marginBottom: 36 }}>
        {greeting}, {profile.name || "friend"}
      </h1>

      <BigButton emoji="🚨" label="Help Now" sub="Immediate support, tailored to you" accent={palette.coral} onClick={() => onNav("emergency")} />
      <BigButton emoji="😊" label="Check In" sub="Tap how you're feeling — no typing needed" accent={palette.amber} onClick={() => onNav("checkin")} />
      <BigButton emoji="📖" label="Journal" sub="Your story, written for you" accent={palette.teal} onClick={() => onNav("journal")} />
    </div>
  );
}

function CheckIn({ profile, memory, moodHistory, onLogged, onBack }) {
  const [picked, setPicked] = useState(null);
  const [aiState, setAiState] = useState("listening");
  const [response, setResponse] = useState(null);
  const [suggestion, setSuggestion] = useState(null);

  async function handlePick(emotion) {
    setPicked(emotion);
    setAiState("thinking");
    const context = buildMemoryContext(profile, memory, moodHistory);
    const prompt = `Context about this person:\n${context}\n\nThey just tapped the emotion button: "${emotion.label}".\n\nRespond in JSON only, no markdown, no preamble:\n{\n  "reflection": "a short warm, non-judgmental reflection acknowledging how they feel, referencing a real pattern from their history if relevant (2-3 sentences)",\n  "suggestion": "one tiny, concrete, under-5-minute coping action suited to their medical notes and past successes",\n  "journal_summary": "a first-person-adjacent journal entry written FOR them, 2-3 sentences, capturing mood, likely trigger, and the action offered"\n}`;
    const result = await callClaude(COMPANION_VOICE, prompt, true);
    setAiState("calm");
    setResponse(result.reflection || result.raw || "I'm here with you.");
    setSuggestion(result.suggestion || null);

    const entry = { emotion: emotion.key, at: Date.now() };
    const journalEntry = {
      at: Date.now(),
      emotion: emotion.key,
      summary: result.journal_summary || result.reflection || "",
    };
    onLogged(entry, null, journalEntry);
  }

  return (
    <div style={{ paddingTop: 20 }}>
      <BackLink onClick={onBack} />
      <div style={{ display: "flex", justifyContent: "center", margin: "12px 0 24px" }}>
        <Companion state={aiState} size={100} />
      </div>

      {!picked && (
        <>
          <h2 className="rc-display" style={{ fontSize: 20, fontWeight: 500, textAlign: "center", marginBottom: 20 }}>
            What's going on right now?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {EMOTIONS.map((e) => (
              <button
                key={e.key}
                onClick={() => handlePick(e)}
                style={{
                  background: palette.panel,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 14,
                  padding: "16px 10px",
                  color: palette.textPrimary,
                  fontSize: 14,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>{e.emoji}</div>
                {e.label}
              </button>
            ))}
          </div>
        </>
      )}

      {picked && (
        <div>
          {!response && <p style={{ textAlign: "center", color: palette.textMuted }}>Thinking with you...</p>}
          {response && (
            <div style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 20 }}>
              <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: suggestion ? 16 : 0 }}>{response}</p>
              {suggestion && (
                <div style={{ borderTop: `1px solid ${palette.border}`, paddingTop: 14, marginTop: 4 }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: palette.teal, marginBottom: 6 }}>
                    Maybe try
                  </div>
                  <p style={{ fontSize: 14, color: palette.textPrimary }}>{suggestion}</p>
                </div>
              )}
            </div>
          )}
          {response && (
            <button
              onClick={onBack}
              style={{ width: "100%", marginTop: 18, padding: "12px 18px", borderRadius: 10, background: palette.amber, border: "none", color: "#1a1200", fontWeight: 600 }}
            >
              Back home
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Emergency({ profile, memory, moodHistory, onBack }) {
  const [aiState, setAiState] = useState("alert");
  const [script, setScript] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const context = buildMemoryContext(profile, memory, moodHistory);
      const prompt = `Context about this person:\n${context}\n\nThey just pressed the "Help Now" emergency button. This means they are in a hard moment right now and may be at risk of relapse, panic, or crisis.\n\nRespond in JSON only:\n{\n  "opening": "one calm sentence to say first, grounding them in the present moment",\n  "grounding": "a short, concrete grounding or breathing exercise, 2-3 sentences, respecting any medical notes",\n  "personal_note": "one sentence referencing something specific that has worked for them before or someone they trust, if known — otherwise a warm general note",\n  "escalate": true or false — true only if there are real signs of danger requiring professional/crisis help based on context given (default false)\n}`;
      const result = await callClaude(COMPANION_VOICE, prompt, true);
      setAiState("calm");
      setScript(result);
    })();
  }, []);

  return (
    <div style={{ paddingTop: 20 }}>
      <BackLink onClick={onBack} label="Not now" />
      <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 24px" }}>
        <Companion state={aiState} size={130} />
      </div>

      {!script && <p style={{ textAlign: "center", color: palette.textMuted }}>I'm here. One second...</p>}

      {script && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 20 }}>
            <p style={{ fontSize: 17, lineHeight: 1.6, marginBottom: 14 }}>{script.opening}</p>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: palette.textPrimary }}>{script.grounding}</p>
          </div>
          {script.personal_note && (
            <div style={{ background: palette.panelLight, borderRadius: 16, padding: 18, borderLeft: `3px solid ${palette.teal}` }}>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{script.personal_note}</p>
            </div>
          )}
          {(script.escalate === true) && (
            <div style={{ background: `${palette.coral}22`, border: `1px solid ${palette.coral}`, borderRadius: 16, padding: 18 }}>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                If you're in immediate danger, please reach out to emergency services now, or a crisis line, before anything else.
                {profile.emergencyContact ? ` Calling ${profile.emergencyContact} right now could help too.` : ""}
              </p>
            </div>
          )}
          <button
            onClick={onBack}
            style={{ padding: "13px 18px", borderRadius: 10, background: palette.amber, border: "none", color: "#1a1200", fontWeight: 600 }}
          >
            I'm steadier now
          </button>
        </div>
      )}
    </div>
  );
}

function Journal({ entries, onBack }) {
  return (
    <div style={{ paddingTop: 20 }}>
      <BackLink onClick={onBack} />
      <h2 className="rc-display" style={{ fontSize: 20, fontWeight: 500, margin: "16px 0 20px" }}>Your story</h2>
      {entries.length === 0 && (
        <p style={{ color: palette.textMuted, fontSize: 14 }}>Nothing here yet — check in when something's going on, and I'll write it down for you.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[...entries].reverse().map((e, i) => (
          <div key={i} style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, color: palette.textMuted, marginBottom: 6 }}>
              {new Date(e.at).toLocaleString()}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{e.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackLink({ onClick, label = "Back" }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", color: palette.textMuted, fontSize: 13 }}>
      ← {label}
    </button>
  );
}
