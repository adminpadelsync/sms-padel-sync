from datetime import datetime
from typing import Dict, List, Optional
import math

def calculate_responsiveness_score(player: Dict) -> int:
    """
    Calculate responsiveness score (0-100) based on invite history.
    
    Formula:
    - Base score starts at 50
    - Responsiveness Rate = (Accepted + Declined) / (Total - Pending)
    - If Rate > 80%, boost score.
    - If Rate < 50%, penalize score.
    - Fast response times (< 1 hour) give bonus.
    """
    total = player.get('total_invites_received', 0) or 0
    # strict assumption: total includes expired. 
    # accepted = player.get('total_invites_accepted', 0)
    # We might need to query actual invite counts if the cached columns aren't enough, 
    # but for now let's assume valid cached data or we compute it in the calculator.
    
    # For independent calculation (stateless), we need the raw stats passed in.
    # Let's assume 'player' dict has: 
    # total_invites, responded_count (accepted+declined), avg_response_time
    
    responded = player.get('responded_count', 0)
    
    if total == 0:
        return 50 # Neutral start
        
    rate = responded / total
    
    score = 50 + (rate - 0.5) * 100 # Map 0.5->50, 1.0->100, 0.0->0
    
    # Cap between 0 and 100
    return max(0, min(100, int(score)))

def calculate_reputation_score(player: Dict) -> int:
    """
    Calculate reputation score (0-100).
    
    Factors:
    - No-shows (Heavy penalty)
    - Late cancellations (Medium penalty) - NOT YET TRACKED
    - Matches played (Small bonus)
    """
    base_score = 75 # Everyone starts with good standing
    
    no_shows = player.get('total_no_shows', 0) or 0
    matches_played = player.get('total_matches_played', 0) or 0
    
    # Heavy penalty for no-shows
    penalty = no_shows * 20
    
    # Small bonus for consistency
    bonus = min(15, matches_played * 0.5)
    
    score = base_score - penalty + bonus
    return max(0, min(100, int(score)))

def calculate_compatibility_score(player: Dict, match_details: Dict) -> int:
    """
    Calculate compatibility (0-100) between a player and a match.
    
    Factors:
    - Skill Level (Most important): Gaussian decay from target level.
    - Gender preference: Binary match/mismatch (or partial penalty).
    """
    player_level = float(player.get('adjusted_skill_level') or player.get('declared_skill_level') or 3.0)
    # Ensure float conversion for target_level as well
    try:
        target_level = float(match_details.get('level_min') or 3.0) 
        # Ideally match has a 'target_level', but often it's min/max. 
        # Let's assume random/avg if not strict.
        if 'level_min' in match_details and 'level_max' in match_details:
             target_level = (float(match_details['level_min']) + float(match_details['level_max'])) / 2
    except (ValueError, TypeError):
        target_level = 3.0

    # 1. Skill Compatibility (Gaussian-ish)
    # Difference of 0.5 should be ~50% score?
    # Difference of 0.25 should be ~80% score?
    diff = abs(player_level - target_level)
    
    if diff <= 0.1:
        skill_score = 100
    elif diff <= 0.25:
        skill_score = 90
    elif diff <= 0.5:
        skill_score = 60
    elif diff <= 0.75:
        skill_score = 30
    else:
        skill_score = 0
        
    # 2. Gender Compatibility
    # match_details might have 'gender_preference' ('M', 'F', 'mixed', 'any')
    gender_score = 100
    req_gender = match_details.get('gender_preference')
    player_gender = player.get('gender', 'unknown').lower()
    
    if req_gender and req_gender.lower() not in ['any', 'mixed', 'everyone']:
        req = req_gender.lower()
        if req == 'm' and player_gender != 'male':
            gender_score = 0
        elif req == 'f' and player_gender != 'female':
            gender_score = 0
            
    # Composite
    # If gender doesn't match, score is usually 0 (hard filter), 
    # but strictly as a "score" we can just weight it.
    
    if gender_score == 0:
        return 0
        
    return int(skill_score)

def calculate_invite_score(player: Dict, match_details: Dict) -> int:
    """
    Calculate the final invite priority score (0-100).
    
    Weights:
    - Compatibility (Skill/Gender): 40%
    - Responsiveness: 35%
    - Reputation: 25%
    """
    comp = calculate_compatibility_score(player, match_details)
    resp = player.get('responsiveness_score', 50)
    rep = player.get('reputation_score', 50)
    
    # Weights
    W_COMP = 0.40
    W_RESP = 0.35
    W_REP  = 0.25
    
    score = (comp * W_COMP) + (resp * W_RESP) + (rep * W_REP)
    
    return int(score)

def rank_candidates(candidates: List[Dict], match_details: Dict) -> List[Dict]:
    """
    Rank a list of candidate players for a specific match.
    Injects '_invite_score' and '_score_breakdown' into each candidate dict.
    """
    ranked = []
    
    for p in candidates:
        score = calculate_invite_score(p, match_details)
        
        # Breakdown
        p['_invite_score'] = score
        p['_score_breakdown'] = {
            "compatibility": calculate_compatibility_score(p, match_details),
            "responsiveness": p.get('responsiveness_score', 50),
            "reputation": p.get('reputation_score', 50)
        }
        ranked.append(p)
        
    # Sort descending
    ranked.sort(key=lambda x: x['_invite_score'], reverse=True)
    return ranked
