from app.agents.base import BaseAgent
from app.agents.registry import AgentFactory


@AgentFactory.register
class CBTAgent(BaseAgent):
    @property
    def name(self) -> str:
        return "cbt"

    @property
    def system_prompt(self) -> str:
        return self._load_prompt("cbt.txt")
