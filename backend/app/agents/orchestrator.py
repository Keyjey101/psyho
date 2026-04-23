import json
import asyncio
from pathlib import Path

from app.agents.base import BaseAgent, client
from app.agents.cbt import CBTAgent
from app.agents.jungian import JungianAgent
from app.agents.act import ACTAgent
from app.agents.ifs import IFSAgent
from app.agents.narrative import NarrativeAgent
from app.agents.somatic import SomaticAgent
from app.config import get_settings

settings = get_settings()

CRISIS_KEYWORDS_RU = [
    "самоубийств", "суицид", "не хочу жить", "покончить с собой",
    "убить себя", "покончу с собой", "умереть хочу", "нет смысла жить",
    "прыгну", "выброшусь", "повешусь", "отравлюсь", "выпью таблетки",
    "порежу вены", "крыша", "третий этаж", "ножом по венам",
]

CRISIS_KEYWORDS_EN = [
    "suicide", "kill myself", "end my life", "don't want to live",
    "no reason to live", "better off dead",
]

CRISIS_RESPONSE = """Я здесь, и я слышу тебя. То, о чём ты говоришь, очень важно, и я не оставлю это без внимания.

Пожалуйста, обратись за помощью — тебе не нужно справляться с этим одной:

**Россия:**
- Единый телефон доверия: **8-800-333-44-34** (бесплатно)
- Телефон доверия для детей и подростков: **8-800-2000-122**
- Центр экстренной психологической помощи МЧС: **+7 (495) 989-50-50**

**Международный:**
- Befrienders Worldwide: **befrienders.org**

Ты важна. Пожалуйста, свяжись с профессионалами, которые могут помочь прямо сейчас."""

TOPIC_AGENT_MAP: dict[str, list[str]] = {
    "anxiety": ["cbt", "somatic"],
    "depression": ["cbt", "act"],
    "relationships": ["ifs", "narrative"],
    "meaning": ["jungian", "act"],
    "dreams": ["jungian"],
    "trauma": ["somatic", "ifs"],
    "self_criticism": ["ifs", "cbt"],
    "identity": ["jungian", "narrative"],
    "procrastination": ["cbt", "act"],
    "anger": ["ifs", "somatic"],
    "stress": ["somatic", "act"],
    "emotions": ["ifs", "act"],
    "fear": ["cbt", "somatic"],
    "loneliness": ["narrative", "ifs"],
    "burnout": ["act", "somatic"],
    "grief": ["narrative", "somatic"],
    "self_esteem": ["cbt", "narrative"],
    "habits": ["cbt", "act"],
    "boundaries": ["ifs", "narrative"],
}


def _check_crisis(message: str) -> bool:
    lower = message.lower()
    for kw in CRISIS_KEYWORDS_RU + CRISIS_KEYWORDS_EN:
        if kw in lower:
            return True
    return False


class Orchestrator:
    def __init__(self):
        self.agents: dict[str, BaseAgent] = {
            "cbt": CBTAgent(),
            "jungian": JungianAgent(),
            "act": ACTAgent(),
            "ifs": IFSAgent(),
            "narrative": NarrativeAgent(),
            "somatic": SomaticAgent(),
        }
        self._load_orchestrator_prompt()

    def _load_orchestrator_prompt(self):
        path = Path(__file__).parent / "prompts" / "orchestrator.txt"
        self.system_prompt = path.read_text(encoding="utf-8")

    async def _classify_topics(self, message: str, history: list[dict]) -> list[str]:
        topics_list = ", ".join(TOPIC_AGENT_MAP.keys())
        classify_prompt = f"""Ты — классификатор тем для психологического чат-бота. Определи, какие психологические темы затрагивает сообщение пользователя.

Доступные темы: {topics_list}

История разговора (последние сообщения):
{self._format_history_for_classify(history[-6:])}

Текущее сообщение пользователя: {message}

Верни ТОЛЬКО JSON-массив со строками — названиями тем. Пример: ["anxiety", "self_criticism"]
Если тема не определена — верни пустой массив: []"""

        response = await client.chat.completions.create(
            model=settings.ZAI_SMALL_MODEL,
            max_tokens=200,
            temperature=0.1,
            messages=[{"role": "user", "content": classify_prompt}],
        )
        try:
            text = response.choices[0].message.content.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            topics = json.loads(text)
            if isinstance(topics, list):
                return [t for t in topics if isinstance(t, str) and t in TOPIC_AGENT_MAP]
        except (json.JSONDecodeError, IndexError):
            pass
        return []

    def _select_agents(self, topics: list[str]) -> list[tuple[str, BaseAgent]]:
        agent_keys: set[str] = set()
        for topic in topics:
            for key in TOPIC_AGENT_MAP.get(topic, []):
                agent_keys.add(key)
                if len(agent_keys) >= 2:
                    break
            if len(agent_keys) >= 2:
                break

        if not agent_keys and topics:
            for topic in topics:
                for key in TOPIC_AGENT_MAP.get(topic, []):
                    agent_keys.add(key)

        return [(k, self.agents[k]) for k in agent_keys if k in self.agents]

    def _format_history_for_classify(self, history: list[dict]) -> str:
        lines = []
        for m in history:
            role = "Пользователь" if m["role"] == "user" else "Ника"
            lines.append(f"{role}: {m['content'][:200]}")
        return "\n".join(lines)

    async def process(
        self,
        message: str,
        history: list[dict],
        session_summary: str = "",
        preferred_style: str = "balanced",
        long_term_memory: str = "",
        therapy_goals: str = "",
        address_form: str = "ты",
        gender: str = "",
    ):
        if _check_crisis(message):
            yield {"type": "agents_used", "agents": ["crisis"]}
            yield {"type": "token", "content": CRISIS_RESPONSE}
            return

        topics = await self._classify_topics(message, history)
        selected = self._select_agents(topics)

        if len(history) < 4:
            selected = []

        perspectives: dict[str, str] = {}
        agent_names = [k for k, _ in selected]

        if selected:
            tasks = [
                agent.analyze(message, history)
                for _, agent in selected
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for (key, _), result in zip(selected, results):
                if isinstance(result, Exception):
                    continue
                perspectives[key] = result

        yield {"type": "agents_used", "agents": agent_names if agent_names else ["orchestrator"]}

        async for token in self._synthesize(
            message, history, perspectives, session_summary,
            preferred_style, long_term_memory, therapy_goals, address_form, gender,
        ):
            yield token

    async def _synthesize(
        self,
        message: str,
        history: list[dict],
        perspectives: dict[str, str],
        session_summary: str,
        preferred_style: str = "balanced",
        long_term_memory: str = "",
        therapy_goals: str = "",
        address_form: str = "ты",
        gender: str = "",
    ):
        perspectives_text = ""
        if perspectives:
            parts = []
            for name, text in perspectives.items():
                agent_name_map = {
                    "cbt": "КПТ-терапевт",
                    "jungian": "Юнгианский аналитик",
                    "act": "ACT-терапевт",
                    "ifs": "IFS-терапевт",
                    "narrative": "Нарративный терапевт",
                    "somatic": "Соматический терапевт",
                }
                parts.append(f"[{agent_name_map.get(name, name)}]\n{text}")
            perspectives_text = "\n\n".join(parts)

        name_map_agents = {
            "cbt": "КПТ", "jungian": "Юнг", "act": "ACT",
            "ifs": "IFS", "narrative": "Нарратив", "somatic": "Соматика",
        }

        history_text = ""
        for m in history[-10:]:
            role = "Пользователь" if m["role"] == "user" else "Ника"
            agents_note = ""
            if m.get("agents_used"):
                try:
                    agents_list = json.loads(m["agents_used"]) if isinstance(m["agents_used"], str) else m["agents_used"]
                    if agents_list:
                        readable = [name_map_agents.get(a, a) for a in agents_list]
                        agents_note = f" [через {', '.join(readable)}]"
                except Exception:
                    pass
            history_text += f"{role}{agents_note}: {m['content']}\n"

        summary_section = ""
        if session_summary:
            summary_section = f"\n\nРезюме предыдущей беседы:\n{session_summary}"

        user_content = f"""История разговора:
{history_text}
{summary_section}

Текущее сообщение пользователя: {message}
"""

        if perspectives_text:
            user_content += f"""
Мнения экспертов:
{perspectives_text}

Синтезируй единый тёплый, профессиональный и эмпатичный ответ, органично интегрируя наиболее полезные инсайты от экспертов. Ответ должен звучать естественно, как от одного заботливого терапевта."""

        messages = [{"role": "system", "content": self.system_prompt}]

        if long_term_memory:
            messages[0]["content"] += f"\n\n## Что я знаю об этом человеке\n{long_term_memory}"

        if therapy_goals:
            messages[0]["content"] += f"\n\n## Цели пользователя в терапии\n{therapy_goals}"

        if preferred_style and preferred_style != "balanced":
            style_instructions = {
                "direct": "\n\n## Стиль общения\nПользователь предпочитает прямой, структурированный стиль. Давай чёткие шаги и конкретные техники, меньше воды.",
                "gentle": "\n\n## Стиль общения\nПользователь предпочитает мягкий, поддерживающий стиль. Будь особенно тёплой и эмпатичной, избегай директивности.",
            }
            if preferred_style in style_instructions:
                messages[0]["content"] += style_instructions[preferred_style]

        if address_form == "вы":
            messages[0]["content"] += "\n\n## Форма обращения\nОбращайся к пользователю на «вы» (с маленькой буквы)."

        if gender == "female":
            messages[0]["content"] += "\n\n## Пол пользователя\nПользователь женского пола. Используй соответствующие окончания глаголов и прилагательных."
        elif gender == "male":
            messages[0]["content"] += "\n\n## Пол пользователя\nПользователь мужского пола. Используй соответствующие окончания глаголов и прилагательных."

        if history:
            messages.extend(history[-10:])
        messages.append({"role": "user", "content": user_content})

        stream = await client.chat.completions.create(
            model=settings.ZAI_MODEL,
            max_tokens=3000,
            temperature=0.7,
            messages=messages,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield {"type": "token", "content": chunk.choices[0].delta.content}
