from app.agents.base import BaseAgent
from app.agents.registry import AgentFactory


@AgentFactory.register
class SomaticAgent(BaseAgent):
    @property
    def name(self) -> str:
        return "somatic"

    @property
    def system_prompt(self) -> str:
        return self._load_prompt("somatic.txt")
