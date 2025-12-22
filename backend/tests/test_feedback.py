"""
Test cases for the feedback collection system.
"""

from handlers.feedback_handler import parse_ratings, update_compatibility_scores



class TestParseRatings:
    """Test the parse_ratings function."""
    
    def test_valid_space_separated(self):
        """Test valid space-separated ratings."""
        assert parse_ratings("8 7 9") == [8, 7, 9]
    
    def test_valid_comma_separated(self):
        """Test valid comma-separated ratings."""
        assert parse_ratings("8,7,9") == [8, 7, 9]
    
    def test_valid_mixed_separators(self):
        """Test mixed separators."""
        assert parse_ratings("8, 7, 9") == [8, 7, 9]
    
    def test_valid_extreme_values(self):
        """Test edge values 1 and 10."""
        assert parse_ratings("1 10 5") == [1, 10, 5]
    
    def test_invalid_too_few(self):
        """Test with only 2 numbers."""
        assert parse_ratings("8 7") is None
    
    def test_invalid_too_many(self):
        """Test with 4 numbers."""
        assert parse_ratings("8 7 9 10") is None
    
    def test_invalid_out_of_range_high(self):
        """Test with number > 10."""
        assert parse_ratings("8 7 11") is None
    
    def test_invalid_out_of_range_low(self):
        """Test with number < 1."""
        assert parse_ratings("8 7 0") is None
    
    def test_invalid_non_numeric(self):
        """Test with non-numeric input."""
        assert parse_ratings("8 seven 9") is None
    
    def test_invalid_empty(self):
        """Test with empty string."""
        assert parse_ratings("") is None
    
    def test_valid_with_extra_spaces(self):
        """Test with extra whitespace."""
        assert parse_ratings("  8   7   9  ") == [8, 7, 9]


if __name__ == "__main__":
    # Quick manual test
    test_cases = [
        ("8 7 9", [8, 7, 9]),
        ("10,1,5", [10, 1, 5]),
        ("8 7", None),
        ("8 7 11", None),
        ("", None),
    ]
    
    for input_str, expected in test_cases:
        result = parse_ratings(input_str)
        status = "✅" if result == expected else "❌"
        print(f"{status} parse_ratings('{input_str}') = {result} (expected {expected})")
