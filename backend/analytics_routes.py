from fastapi import APIRouter, HTTPException
from database import supabase
from datetime import datetime, timedelta
from logic_utils import get_now_utc
from typing import Dict, List, Any
import json

router = APIRouter()

@router.get("/health")
async def get_club_health(club_id: str):
    """
    Get club setup health metrics:
    - Verified Players %
    - Availability Set %
    - Skill Level Distribution
    """
    try:
        # 1. Fetch player IDs for this club from club_members
        members_res = supabase.table("club_members").select("player_id").eq("club_id", club_id).execute()
        member_ids = [m["player_id"] for m in (members_res.data or [])]
        
        if not member_ids:
            return {
                "total_players": 0,
                "verified_pct": 0,
                "availability_pct": 0,
                "skill_distribution": {}
            }

        # 2. Fetch data for these players
        result = supabase.table("players").select(
            "player_id, declared_skill_level, pro_verified, "
            "avail_weekday_morning, avail_weekday_afternoon, avail_weekday_evening, "
            "avail_weekend_morning, avail_weekend_afternoon, avail_weekend_evening"
        ).in_("player_id", member_ids).eq("active_status", True).execute()
        
        players = result.data or []
        total_players = len(players)
        
        if total_players == 0:
            return {
                "total_players": 0,
                "verified_pct": 0,
                "availability_pct": 0,
                "skill_distribution": {}
            }

        verified_count = 0
        avail_set_count = 0
        
        # Ranges: 2.0-2.5, 2.5-3.0, 3.0-3.5, 3.5-4.0, 4.0-4.5, 4.5-5.0, 5.0-5.5, > 5.5
        range_keys = [
            "2.0-2.5", "2.5-3.0", "3.0-3.5", "3.5-4.0", 
            "4.0-4.5", "4.5-5.0", "5.0-5.5", "> 5.5"
        ]
        skill_dist = {rk: 0 for rk in range_keys}

        for p in players:
            # Verified count
            if p.get("pro_verified"):
                verified_count += 1
            
            # Availability count
            has_avail = (
                p.get("avail_weekday_morning") or 
                p.get("avail_weekday_afternoon") or 
                p.get("avail_weekday_evening") or 
                p.get("avail_weekend_morning") or 
                p.get("avail_weekend_afternoon") or 
                p.get("avail_weekend_evening")
            )
            if has_avail:
                avail_set_count += 1
                
            # Range grouping
            level = p.get("declared_skill_level") or 0.0
            
            if level < 2.5:
                skill_dist["2.0-2.5"] += 1
            elif level < 3.0:
                skill_dist["2.5-3.0"] += 1
            elif level < 3.5:
                skill_dist["3.0-3.5"] += 1
            elif level < 4.0:
                skill_dist["3.5-4.0"] += 1
            elif level < 4.5:
                skill_dist["4.0-4.5"] += 1
            elif level < 5.0:
                skill_dist["4.5-5.0"] += 1
            elif level < 5.5:
                skill_dist["5.0-5.5"] += 1
            else:
                skill_dist["> 5.5"] += 1

        return {
            "total_players": total_players,
            "verified_pct": round((verified_count / total_players) * 100, 1),
            "availability_pct": round((avail_set_count / total_players) * 100, 1),
            "skill_distribution": skill_dist
        }

    except Exception as e:
        print(f"Error in analytics/health: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/activity")
async def get_activity_metrics(club_id: str):
    """
    Get match activity metrics (Last 30 Days):
    - Matches Requested vs Confirmed
    - Invite Acceptance Rate
    """
    try:
        thirty_days_ago = (get_now_utc() - timedelta(days=30)).isoformat()
        
        # 1. Match Stats
        matches_res = supabase.table("matches").select("status, match_id").eq("club_id", club_id).gte("created_at", thirty_days_ago).execute()
        matches = matches_res.data or []
        
        total_requested = len(matches)
        total_confirmed = sum(1 for m in matches if m["status"] in ["confirmed", "completed"])
        conversion_rate = round((total_confirmed / total_requested) * 100, 1) if total_requested > 0 else 0
        
        # 2. Invite Stats
        # We need to query invites for matches belonging to this club
        # This is slightly complex with RLS/joins, but we can do a broad query filtering by time 
        # and then preferably join or filter. 
        # Alternatively, we assume invites table has a way to filter, but it doesn't have club_id directly usually match_id -> club_id
        # Let's try to query match_invites linked to the matches we just found
        
        match_ids = [m["match_id"] for m in matches] if matches else []
        
        # If too many match IDs, we might need to change strategy, but for dashboard logical chunks (last 30 days) it should be fine
        if not match_ids:
             return {
                "matches_requested": 0,
                "matches_confirmed": 0,
                "match_conversion_rate": 0,
                "invites_sent": 0,
                "invites_accepted": 0,
                "invite_acceptance_rate": 0
            }

        # Batch query invites (chunks of IDs if needed, but keeping it simple for now)
        # Supabase limit is usually huge for IDs filter, but let's be safe via Python if needed
        # Actually, let's just query invites created_at > 30 days ago and FILTER in python for the match_ids we own 
        # (assuming we might fetch invites from other clubs? No, invites table doesn't have club_id)
        # Better: Filter invites where match_id is in our list
        
        invites_sent = 0
        invites_accepted = 0
        
        # Chunking to avoid URL length issues
        chunk_size = 50
        for i in range(0, len(match_ids), chunk_size):
            chunk = match_ids[i:i + chunk_size]
            inv_res = supabase.table("match_invites").select("status").in_("match_id", chunk).execute()
            chunk_invites = inv_res.data or []
            
            for inv in chunk_invites:
                invites_sent += 1
                if inv["status"] == "accepted":
                    invites_accepted += 1
                    
        invite_rate = round((invites_accepted / invites_sent) * 100, 1) if invites_sent > 0 else 0
        
        return {
            "matches_requested": total_requested,
            "matches_confirmed": total_confirmed,
            "match_conversion_rate": conversion_rate,
            "invites_sent": invites_sent,
            "invites_accepted": invites_accepted,
            "invite_acceptance_rate": invite_rate
        }

    except Exception as e:
        print(f"Error in analytics/activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/feedback")
async def get_feedback_metrics(club_id: str):
    """
    Get feedback insights:
    - Top rated players (by average rating received)
    """
    try:
        # Fetch feedback rows
        # We need to link match_id -> club_id = current club
        # 1. Fetch matches for club first
        matches_res = supabase.table("matches").select("match_id").eq("club_id", club_id).execute()
        match_ids = [m["match_id"] for m in matches_res.data]
        
        if not match_ids:
             return {"top_players": []}

        # 2. Fetch feedback for these matches
        # Chunk strategy again
        all_feedback = []
        chunk_size = 50
        for i in range(0, len(match_ids), chunk_size):
            chunk = match_ids[i:i + chunk_size]
            fb_res = supabase.table("match_feedback").select("individual_ratings").in_("match_id", chunk).execute()
            if fb_res.data:
                all_feedback.extend(fb_res.data)

        # 3. Aggregate Scores
        # individual_ratings is { "player_id_uuid": score_int, ... }
        player_scores: Dict[str, List[int]] = {}
        
        for record in all_feedback:
            ratings = record.get("individual_ratings") or {}
            for pid, score in ratings.items():
                if pid not in player_scores:
                    player_scores[pid] = []
                player_scores[pid].append(score)
        
        # 4. Calculate Averages
        player_stats = []
        for pid, scores in player_scores.items():
            avg = sum(scores) / len(scores)
            player_stats.append({
                "player_id": pid,
                "avg_rating": avg,
                "count": len(scores)
            })
            
        # 5. Get Player Names for the top ones
        # Sort by avg desc, then count desc
        player_stats.sort(key=lambda x: (x["avg_rating"], x["count"]), reverse=True)
        top_stats = player_stats[:10]
        
        if top_stats:
            top_ids = [s["player_id"] for s in top_stats]
            names_res = supabase.table("players").select("player_id, name").in_("player_id", top_ids).execute()
            name_map = {p["player_id"]: p["name"] for p in names_res.data}
            
            # Enrich stats
            for stat in top_stats:
                stat["name"] = name_map.get(stat["player_id"], "Unknown Player")
                stat["avg_rating"] = round(stat["avg_rating"], 1)

        return {
            "top_players": top_stats
        }

    except Exception as e:
        print(f"Error in analytics/feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))
