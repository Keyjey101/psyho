from app.agents.base import BaseAgent


class SomaticAgent(BaseAgent):
    @property
    def name(self) -> str:
        return "somatic"

    @property
    def system_prompt(self) -> str:
        return self._load_prompt("somatic.txt")
