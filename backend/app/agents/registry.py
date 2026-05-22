from __future__ import annotations
from typing import Type, TYPE_CHECKING

if TYPE_CHECKING:
    from app.agents.base import BaseAgent


class AgentFactory:
    _registry: dict[str, Type["BaseAgent"]] = {}
    _instances: dict[str, "BaseAgent"] = {}

    @classmethod
    def register(cls, agent_class: Type["BaseAgent"]) -> Type["BaseAgent"]:
        # Instantiate once to get the name from the property
        instance = agent_class()
        cls._registry[instance.name] = agent_class
        cls._instances[instance.name] = instance
        return agent_class

    @classmethod
    def get(cls, name: str) -> "BaseAgent":
        if name not in cls._instances:
            if name not in cls._registry:
                raise KeyError(f"Agent '{name}' not registered")
            cls._instances[name] = cls._registry[name]()
        return cls._instances[name]

    @classmethod
    def therapy_agents(cls) -> dict[str, "BaseAgent"]:
        names = ["cbt", "jungian", "act", "ifs", "narrative", "somatic"]
        return {n: cls.get(n) for n in names}
