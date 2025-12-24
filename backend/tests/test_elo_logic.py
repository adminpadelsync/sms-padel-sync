import sys
import os
# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from logic.elo_service import get_expected_score, calculate_elo_delta, get_initial_elo, elo_to_sync_rating

def test_elo_math():
    print("Testing Elo Math...")
    
    # 1. Expected Score
    # Same rating should be 0.5
    assert get_expected_score(1500, 1500) == 0.5
    # Stronger team should have higher expected score
    assert get_expected_score(2000, 1500) > 0.5
    assert get_expected_score(1500, 2000) < 0.5
    print("✅ Expected Score math OK")
    
    # 2. Delta calculation
    # Even match, winner team 1
    delta = calculate_elo_delta(1500, 1500, 1.0, 32)
    assert delta == 16
    # Even match, lose team 1
    delta = calculate_elo_delta(1500, 1500, 0.0, 32)
    assert delta == -16
    
    # Underdog win
    delta_underdog = calculate_elo_delta(1500, 2000, 1.0, 32)
    delta_favorite = calculate_elo_delta(2000, 1500, 1.0, 32)
    assert delta_underdog > delta_favorite
    print("✅ Underdog vs Favorite deltas OK")
    
    # 3. Seeding
    assert get_initial_elo(2.5) == 1500
    assert get_initial_elo(5.0) == 2500
    print("✅ Seeding logic OK")
    
    # 4. Inversion (Display)
    assert elo_to_sync_rating(1500) == 2.5
    assert elo_to_sync_rating(2500) == 5.0
    assert elo_to_sync_rating(1700) == 3.0
    print("✅ Display rating conversion OK")

if __name__ == "__main__":
    try:
        test_elo_math()
        print("\nALL ELO MATH TESTS PASSED!")
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        sys.exit(1)
