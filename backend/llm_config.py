import os
from dotenv import load_dotenv

load_dotenv()

class LLMConfig:
    @staticmethod
    def get_api_key() -> str:
        """
        Retrieves the Gemini API Key.
        Contains a temporary hotfix to swap expired keys if detected.
        """
        api_key = os.getenv("GEMINI_API_KEY")
        
        # HOTFIX: Detect stale/expired key from Vercel env and swap with known working key
        # TODO: Remove this once Vercel environment variables are correctly synced.
        if api_key and api_key.startswith("AIzaSyCd"):
            # Only log valid warning if we are actually swapping
            # print("[LLM_CONFIG] WARN: Detected expired API Key. Swapping for backup key.")
            return "AIzaSyBSg8hQzwTxh2UNrf-O2JwoQUO3fuJWrAk"
            
        return api_key

    @staticmethod
    def get_model_name() -> str:
        """
        Returns the configured Model Name.
        Defaults to 'gemini-flash-latest' to ensure availability across different API tiers.
        """
        return os.getenv("LLM_MODEL_NAME", "gemini-flash-latest")

    @staticmethod
    def get_timeout() -> int:
        """
        Returns the API timeout in seconds.
        """
        return int(os.getenv("GEMINI_API_TIMEOUT", 25))
