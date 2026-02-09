import os
from dotenv import load_dotenv

load_dotenv()

class LLMConfig:
    @staticmethod
    def get_api_key() -> str:
        """
        Retrieves the Gemini API Key from environment variables.
        """
        return os.getenv("GEMINI_API_KEY")

    @staticmethod
    def get_model_name() -> str:
        """
        Returns the configured Model Name.
        Defaults to 'gemini-2.5-flash'.
        """
        return os.getenv("LLM_MODEL_NAME", "gemini-2.5-flash")

    @staticmethod
    def get_timeout() -> int:
        """
        Returns the API timeout in seconds.
        """
        return int(os.getenv("GEMINI_API_TIMEOUT", 25))
