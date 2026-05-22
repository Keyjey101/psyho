from app.agents.base import BaseAgent
from app.agents.registry import AgentFactory


@AgentFactory.register
class NarrativeAgent(BaseAgent):
    @property
    def name(self) -> str:
        return "narrative"

    @property
    def system_prompt(self) -> str:
        return self._load_prompt("narrative.txt")
