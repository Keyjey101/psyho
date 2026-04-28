import json
import asyncio
import structlog
from enum import Enum
from pathlib import Path
from time import time

from app.agents.base import BaseAgent, client
from app.agents.cbt import CBTAgent
from app.agents.jungian import JungianAgent
from app.agents.act import ACTAgent
from app.agents.ifs import IFSAgent
from app.agents.narrative import NarrativeAgent
from app.agents.somatic import SomaticAgent
from app.config import get_settings

settings = get_settings()


class SessionPhase(Enum):
    INTAKE = "intake"
    FOCUS = "focus"
    WORK = "work"
    INTEGRATION = "integration"
    CLOSE = "close"


PHASE_INSTRUCTIONS = {
    SessionPhase.INTAKE: (
        "ЗАДАЧА INTAKE: Задай 1-2 уточняющих вопроса чтобы понять:\n"
        "1. Что именно беспокоит (конкретная ситуация, не общая тема)\n"
        "2. Чего человек хочет от этой сессии (понять / решить / просто выговориться)\n"
        "НЕ давай советов. НЕ анализируй. Слушай и уточняй."
    ),
    SessionPhase.FOCUS: "Фокусируйся на одной теме. Углубись, уточни.",
    SessionPhase.WORK: "Работай конкретно. Давай практические инструменты.",
    SessionPhase.INTEGRATION: (
        "ЗАДАЧА INTEGRATION: Начинай закреплять. Предложи 1 конкретное упражнение "
        "(если соматика — укажи технику из 4-7-8 или 5-4-3-2-1)."
    ),
    SessionPhase.CLOSE: (
        "ЗАДАЧА CLOSE: Мы подходим к завершению сессии, но НЕ прощайся и не заканчивай разговор — "
        "пользователь может ответить ещё. Сделай:\n"
        "1. Краткое резюме: что прояснилось в этой сессии\n"
        "2. 1 конкретная домашняя задача / практика\n"
        "3. Оставайся открытой — если человек ответит, продолжи естественно."
    ),
}

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
    "dreams": ["jungian", "somatic"],
    "trauma": ["somatic", "narrative"],
    "self_criticism": ["ifs", "cbt"],
    "identity": ["jungian", "narrative"],
    "procrastination": ["cbt", "act"],
    "anger": ["ifs", "somatic"],
    "stress": ["somatic", "act"],
    "emotions": ["ifs", "act"],
    "fear": ["cbt", "somatic"],
    "loneliness": ["narrative", "ifs"],
    "burnout": ["act", "somatic"],
    "grief": ["narrative", "act"],
    "self_esteem": ["cbt", "narrative"],
    "habits": ["cbt", "act"],
    "boundaries": ["ifs", "narrative"],
    "shame": ["ifs", "narrative"],
    "perfectionism": ["cbt", "ifs"],
}


def _check_crisis(message: str) -> bool:
    lower = message.lower()
    for kw in CRISIS_KEYWORDS_RU + CRISIS_KEYWORDS_EN:
        if kw in lower:
            return True
    return False


MEMORY_INJECTION_PATTERNS = [
    "запомни:", "запомни что", "запомни —",
    "always respond", "always reply", "ignore previous",
    "system:", "[system]", "new instruction",
    "отныне ты", "теперь ты", "забудь всё",
]


def _sanitize_memory(memory: str) -> str:
    lower = memory.lower()
    for pattern in MEMORY_INJECTION_PATTERNS:
        if pattern in lower:
            return ""
    return memory


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
        self._session_topic_cache: dict[str, tuple[list[str], int]] = {}
        self._load_orchestrator_prompt()

    def _load_orchestrator_prompt(self):
        path = Path(__file__).parent / "prompts" / "orchestrator.txt"
        self.system_prompt = path.read_text(encoding="utf-8")

    @staticmethod
    def _get_phase(exchange_number: int, max_exchanges: int) -> SessionPhase:
        if max_exchanges <= 0:
            return SessionPhase.WORK
        pct = exchange_number / max_exchanges
        if pct < 0.15:
            return SessionPhase.INTAKE
        if pct < 0.30:
            return SessionPhase.FOCUS
        if pct < 0.75:
            return SessionPhase.WORK
        if pct < 0.90:
            return SessionPhase.INTEGRATION
        return SessionPhase.CLOSE

    async def _classify_topics(self, message: str, history: list[dict], session_id: str = "") -> list[str]:
        msg_count = len(history)
        if session_id:
            cached = self._session_topic_cache.get(session_id)
            if cached and abs(msg_count - cached[1]) <= 2:
                return cached[0]

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
            max_tokens=settings.CLASSIFICATION_MAX_TOKENS,
            temperature=0.1,
            messages=[{"role": "user", "content": classify_prompt}],
        )
        topics: list[str] = []
        try:
            text = response.choices[0].message.content
            if text:
                text = text.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    topics = [t for t in parsed if isinstance(t, str) and t in TOPIC_AGENT_MAP]
        except (json.JSONDecodeError, IndexError, AttributeError):
            pass
        if session_id and topics:
            self._session_topic_cache[session_id] = (topics, msg_count)
        return topics

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
        exchange_number: int = 0,
        max_exchanges: int = 20,
        session_id: str = "",
    ):
        if _check_crisis(message):
            yield {"type": "agents_used", "agents": ["crisis"]}
            yield {"type": "token", "content": CRISIS_RESPONSE}
            return

        topics = await self._classify_topics(message, history, session_id)

        phase = self._get_phase(exchange_number, max_exchanges) if exchange_number > 0 and max_exchanges > 0 else SessionPhase.WORK
        if phase == SessionPhase.INTAKE:
            selected = []
        else:
            selected = self._select_agents(topics)

        perspectives: dict[str, str] = {}
        agent_names = [k for k, _ in selected]

        if selected:
            async def _run_agent(key: str, agent: BaseAgent):
                return key, await asyncio.wait_for(
                    agent.analyze(message, history),
                    timeout=settings.AGENT_TIMEOUT_SECONDS,
                )

            tasks = [_run_agent(k, a) for k, a in selected]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for result in results:
                if isinstance(result, Exception):
                    structlog.get_logger().warning(
                        "Agent analysis failed or timed out",
                        error=type(result).__name__ + (f": {result}" if str(result) else ""),
                    )
                    continue
                key, analysis = result
                perspectives[key] = analysis

        yield {"type": "agents_used", "agents": agent_names if agent_names else ["orchestrator"]}

        async for token in self._synthesize(
            message, history, perspectives, session_summary,
            preferred_style, long_term_memory, therapy_goals, address_form, gender,
            exchange_number, max_exchanges, phase,
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
        exchange_number: int = 0,
        max_exchanges: int = 20,
        phase: SessionPhase | None = None,
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

        history_text = ""
        for m in history[-10:]:
            role = "Пользователь" if m["role"] == "user" else "Ника"
            history_text += f"{role}: {m['content']}\n"

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

Синтезируй единый тёплый, профессиональный и эмпатичный ответ, органично интегрируя наиболее полезные инсайты от экспертов. Ответ должен звучать естественно, как от одного заботливого терапевта.

Если перспективы экспертов противоречат друг другу — выбери более безопасную или объедини последовательно: сначала телесное заземление, потом когнитивная работа."""

        if exchange_number > 0 and max_exchanges > 0:
            effective_phase = phase or self._get_phase(exchange_number, max_exchanges)
            remaining = max_exchanges - exchange_number
            phase_instruction = PHASE_INSTRUCTIONS.get(effective_phase, "")
            user_content += f"""

[ПРОГРЕСС СЕССИИ: обмен {exchange_number} из {max_exchanges}. Фаза: {effective_phase.value}. Осталось ~{remaining} обменов]
{phase_instruction}"""

        messages = [{"role": "system", "content": self.system_prompt}]

        if long_term_memory:
            sanitized_memory = _sanitize_memory(long_term_memory)
            if sanitized_memory:
                messages[0]["content"] += f"\n\n## Что я знаю об этом человеке\n{sanitized_memory}"

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
            messages[0]["content"] += (
                "\n\n## ФОРМА ОБРАЩЕНИЯ — ОБЯЗАТЕЛЬНО\n"
                "Обращайся к пользователю ИСКЛЮЧИТЕЛЬНО на «вы» (с маленькой буквы). "
                "Никогда не используй «ты», «тебя», «тебе», «твой», «тебе» при обращении к пользователю. "
                "Примеры: «Как вы себя чувствуете?», «Что вас беспокоит?», «Расскажите мне», «Вы упомянули»."
            )

        if gender == "female":
            messages[0]["content"] += (
                "\n\n## ПОЛ ПОЛЬЗОВАТЕЛЯ — ОБЯЗАТЕЛЬНО\n"
                "Пользователь женского пола. Строго используй женские окончания в глаголах и прилагательных: "
                "«вы сказали» → «вы почувствовали себя усталой», «расстроенной», «готовой», «замечали»."
            )
        elif gender == "male":
            messages[0]["content"] += (
                "\n\n## ПОЛ ПОЛЬЗОВАТЕЛЯ — ОБЯЗАТЕЛЬНО\n"
                "Пользователь мужского пола. Строго используй мужские окончания в глаголах и прилагательных: "
                "«вы сказали» → «вы почувствовали себя усталым», «расстроенным», «готовым», «замечали»."
            )

        if history:
            messages.extend(history[-10:])
        messages.append({"role": "user", "content": user_content})

        stream = await client.chat.completions.create(
            model=settings.ZAI_MODEL,
            max_tokens=settings.SYNTHESIS_MAX_TOKENS,
            temperature=0.7,
            messages=messages,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield {"type": "token", "content": chunk.choices[0].delta.content}
