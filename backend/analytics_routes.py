from fastapi import APIRouter, HTTPException
from database import supabase
from datetime import datetime, timedelta
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
        # Fetch all active players for the club
        # We fetch columns needed for metrics
        result = supabase.table("players").select(
            "player_id, declared_skill_level, pro_verified, "
            "avail_weekday_morning, avail_weekday_afternoon, avail_weekday_evening, "
            "avail_weekend_morning, avail_weekend_afternoon, avail_weekend_evening"
        ).eq("club_id", club_id).eq("active_status", True).execute()
        
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
        skill_dist = {}

        for p in players:
            # Verified count
            if p.get("pro_verified"):
                verified_count += 1
            
            # Availability count (is ANY bucket true?)
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
                
            # Skill bucket
            level = p.get("declared_skill_level") or 0
            # Bucket into 0.5 increments for chart
            # e.g. 3.2 -> 3.0, 3.7 -> 3.5
            bucket = float(int(level * 2)) / 2.0
            bucket_str = f"{bucket:.1f}"
            skill_dist[bucket_str] = skill_dist.get(bucket_str, 0) + 1

        # Sort skill distribution
        sorted_dist = dict(sorted(skill_dist.items()))

        return {
            "total_players": total_players,
            "verified_pct": round((verified_count / total_players) * 100, 1),
            "availability_pct": round((avail_set_count / total_players) * 100, 1),
            "skill_distribution": sorted_dist
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
        thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
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
