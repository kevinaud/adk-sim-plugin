from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Default local path: ~/.adk-sim/simulator.db
_LOCAL_DB_PATH = Path.home() / ".adk-sim" / "simulator.db"


class Settings(BaseSettings):
  log_level: str = "INFO"
  # Use absolute path by default
  database_url: str = f"sqlite+aiosqlite:///{_LOCAL_DB_PATH}"
  # Loaded from GEMINI_API_KEY (without prefix)
  gemini_api_key: str | None = Field(
    default=None,
    validation_alias=AliasChoices("GEMINI_API_KEY", "gemini_api_key"),
  )

  model_config = SettingsConfigDict(
    env_prefix="ADK_AGENT_SIM_",
    env_file=(".env", ".env.secrets"),
    extra="ignore",
  )


settings = Settings()
