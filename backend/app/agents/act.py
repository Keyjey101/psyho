from app.agents.base import BaseAgent


class ACTAgent(BaseAgent):
    @property
    def name(self) -> str:
        return "act"

    @property
    def system_prompt(self) -> str:
        return self._load_prompt("act.txt")
