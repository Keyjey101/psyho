from app.agents.base import BaseAgent
from app.agents.registry import AgentFactory


@AgentFactory.register
class IFSAgent(BaseAgent):
    @property
    def name(self) -> str:
        return "ifs"

    @property
    def system_prompt(self) -> str:
        return self._load_prompt("ifs.txt")
