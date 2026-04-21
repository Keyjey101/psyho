from app.agents.base import BaseAgent


class JungianAgent(BaseAgent):
    @property
    def name(self) -> str:
        return "jungian"

    @property
    def system_prompt(self) -> str:
        return self._load_prompt("jungian.txt")
