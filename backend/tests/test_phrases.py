"""
Tests for Phrase Library — SM-2 algorithm + endpoint logic
"""

import pytest
from app.api.routes.phrases import sm2_update


class TestSM2Algorithm:
    """Test SM-2 spaced repetition algorithm."""

    def test_perfect_review_increases_interval(self):
        """Quality=5 should increase interval and repetitions."""
        ef, interval, reps = sm2_update(quality=5, ease_factor=2.5, interval=1, repetitions=0)
        assert reps == 1
        assert interval == 1  # First review: always 1 day
        assert ef >= 2.5  # EF should increase or stay for quality=5

    def test_second_review_six_days(self):
        """Second successful review should give 6-day interval."""
        ef, interval, reps = sm2_update(quality=5, ease_factor=2.5, interval=1, repetitions=1)
        assert reps == 2
        assert interval == 6

    def test_third_review_uses_ef(self):
        """Third+ review should multiply interval by ease factor."""
        ef, interval, reps = sm2_update(quality=4, ease_factor=2.5, interval=6, repetitions=2)
        assert reps == 3
        assert interval == 15  # ceil(6 * 2.5) = 15

    def test_failed_review_resets(self):
        """Quality<3 should reset repetitions and interval."""
        ef, interval, reps = sm2_update(quality=1, ease_factor=2.5, interval=15, repetitions=5)
        assert reps == 0
        assert interval == 1
        assert ef == 2.3  # 2.5 - 0.2

    def test_quality_zero_resets(self):
        """Quality=0 (total blackout) should also reset."""
        ef, interval, reps = sm2_update(quality=0, ease_factor=2.5, interval=30, repetitions=10)
        assert reps == 0
        assert interval == 1

    def test_ef_never_below_1_3(self):
        """Ease factor should never go below 1.3."""
        ef, interval, reps = sm2_update(quality=1, ease_factor=1.3, interval=1, repetitions=0)
        assert ef == 1.3  # max(1.3, 1.3 - 0.2) = 1.3

    def test_quality_3_borderline_success(self):
        """Quality=3 is borderline success — should not reset."""
        ef, interval, reps = sm2_update(quality=3, ease_factor=2.5, interval=6, repetitions=2)
        assert reps == 3
        assert interval > 0

    def test_quality_3_ef_decreases(self):
        """Quality=3 should decrease ease factor (difficult recall)."""
        ef, _, _ = sm2_update(quality=3, ease_factor=2.5, interval=1, repetitions=0)
        assert ef < 2.5

    def test_quality_5_ef_increases(self):
        """Quality=5 should increase ease factor."""
        ef, _, _ = sm2_update(quality=5, ease_factor=2.5, interval=1, repetitions=0)
        assert ef > 2.5

    def test_progressive_intervals(self):
        """Simulate a sequence of perfect reviews and check interval growth."""
        ef = 2.5
        interval = 1
        reps = 0

        # Review 1: quality 5
        ef, interval, reps = sm2_update(5, ef, interval, reps)
        assert interval == 1 and reps == 1

        # Review 2: quality 5
        ef, interval, reps = sm2_update(5, ef, interval, reps)
        assert interval == 6 and reps == 2

        # Review 3: quality 5
        ef, interval, reps = sm2_update(5, ef, interval, reps)
        assert interval > 6 and reps == 3

        # Review 4: quality 5 — interval should keep growing
        prev_interval = interval
        ef, interval, reps = sm2_update(5, ef, interval, reps)
        assert interval > prev_interval and reps == 4

    def test_fail_after_long_streak_resets(self):
        """Even after a long streak, failing should reset to 1 day."""
        ef, interval, reps = sm2_update(quality=2, ease_factor=2.8, interval=60, repetitions=10)
        assert reps == 0
        assert interval == 1
