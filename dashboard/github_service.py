import requests
import logging

logger = logging.getLogger(__name__)


def verify_github_user(username: str) -> dict:
    """
    Check whether a GitHub username exists and return basic profile info.
    Returns a dict with keys: valid, login, name, avatar_url, public_repos, html_url
    """
    if not username or not username.strip():
        return {"valid": False, "error": "Username is required"}

    username = username.strip()
    url = f"https://api.github.com/users/{username}"
    try:
        response = requests.get(
            url,
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10,
        )
        if response.status_code == 404:
            return {"valid": False, "error": f"GitHub user '{username}' not found"}
        response.raise_for_status()
        data = response.json()
        return {
            "valid": True,
            "login": data.get("login"),
            "name": data.get("name") or data.get("login"),
            "avatar_url": data.get("avatar_url"),
            "public_repos": data.get("public_repos", 0),
            "html_url": data.get("html_url"),
        }
    except requests.exceptions.HTTPError as e:
        logger.warning(f"GitHub verify HTTP error for {username}: {e}")
        return {"valid": False, "error": "GitHub API error"}
    except Exception as e:
        logger.warning(f"Failed to verify GitHub user {username}: {e}")
        return {"valid": False, "error": "Could not reach GitHub API"}


def get_public_repos(username: str) -> list:
    """
    Fetch public repositories for a given GitHub username.
    Returns a list of dicts containing repo details.
    """
    if not username:
        return []
        
    url = f"https://api.github.com/users/{username}/repos"
    try:
        response = requests.get(
            url, 
            params={"type": "public", "sort": "updated", "per_page": 100}, 
            timeout=10,
            headers={"Accept": "application/vnd.github.v3+json"}
        )
        response.raise_for_status()
        repos = response.json()
        result = []
        for repo in repos:
            result.append({
                "name": repo.get("name"),
                "full_name": repo.get("full_name"),
                "url": repo.get("clone_url") or repo.get("html_url"),
                "html_url": repo.get("html_url"),
                "default_branch": repo.get("default_branch") or "main",
                "updated_at": repo.get("updated_at"),
                "language": repo.get("language")
            })
        return result
    except Exception as e:
        logger.warning(f"Failed to fetch GitHub repos for {username}: {e}")
        return []
