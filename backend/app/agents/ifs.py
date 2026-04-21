from app.agents.base import BaseAgent


class IFSAgent(BaseAgent):
    @property
    def name(self) -> str:
        return "ifs"

    @property
    def system_prompt(self) -> str:
        return self._load_prompt("ifs.txt")
