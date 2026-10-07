"""Guest experience scores and recommended actions.

The dataset has no review scores, so the Guest Satisfaction Score and the
Repeat Booking Likelihood are transparent rule-based indicators built from
booking signals. The weights are listed here and on the Guest Analytics page.
"""


def _num(booking, key):
    try:
        return float(booking.get(key) or 0)
    except (TypeError, ValueError):
        return 0.0


SATISFACTION_BASE = 55


def satisfaction_breakdown(booking):
    """The rules that apply to this booking, as (reason, points) pairs."""
    requests = min(_num(booking, "total_of_special_requests"), 3)
    completed = min(_num(booking, "previous_bookings_not_canceled"), 5)
    cancelled = min(_num(booking, "previous_cancellations"), 3)
    rules = [
        (f"{int(requests)} special request(s) - a personalised stay", 8 * requests),
        ("Returning guest", 10 if _num(booking, "is_repeated_guest") else 0),
        ("Parking booked - committed to arrive", 5 if _num(booking, "required_car_parking_spaces") > 0 else 0),
        (f"{int(completed)} earlier stay(s) completed", 2 * completed),
        (f"{int(cancelled)} earlier cancellation(s)", -6 * cancelled),
        ("Waited on the waiting list", -5 if _num(booking, "days_in_waiting_list") > 0 else 0),
    ]
    return [(reason, points) for reason, points in rules if points]


def satisfaction_score(booking):
    """0-100. Engaged, returning guests with a smooth booking score higher."""
    score = SATISFACTION_BASE + sum(points for _, points in satisfaction_breakdown(booking))
    return round(max(0, min(100, score)), 1)


def repeat_breakdown(booking, cancel_risk, satisfaction):
    """Blend of how likely the stay happens and how good it is likely to be, as (reason, points)."""
    rules = [
        ("40% of the chance the stay happens (100 - risk)", 0.4 * (100 - cancel_risk)),
        ("40% of the satisfaction score", 0.4 * satisfaction),
        ("Returning guest", 20 if _num(booking, "is_repeated_guest") else 0),
        ("Booked direct or corporate", 5 if booking.get("market_segment") in ("Corporate", "Direct") else 0),
    ]
    return [(reason, round(points, 1)) for reason, points in rules if points]


def repeat_likelihood(booking, cancel_risk, satisfaction):
    """0-100."""
    score = sum(points for _, points in repeat_breakdown(booking, cancel_risk, satisfaction))
    return round(max(0, min(100, score)), 1)


def risk_level(cancel_risk):
    if cancel_risk >= 65:
        return "High"
    if cancel_risk >= 35:
        return "Medium"
    return "Low"


def loyalty_tier(likelihood):
    if likelihood >= 75:
        return "Loyal"
    if likelihood >= 50:
        return "Promising"
    return "At risk"


def guest_experience(booking, cancel_risk):
    satisfaction = satisfaction_score(booking)
    likelihood = repeat_likelihood(booking, cancel_risk, satisfaction)
    return {
        "satisfaction": satisfaction,
        "satisfaction_base": SATISFACTION_BASE,
        "satisfaction_breakdown": [
            {"reason": reason, "points": points} for reason, points in satisfaction_breakdown(booking)
        ],
        "repeat_likelihood": likelihood,
        "repeat_breakdown": [
            {"reason": reason, "points": points}
            for reason, points in repeat_breakdown(booking, cancel_risk, satisfaction)
        ],
        "loyalty_tier": loyalty_tier(likelihood),
    }


def recommendations(booking, cancel_risk):
    """Up to four practical actions for the front desk, most important first."""
    tips = []
    lead = _num(booking, "lead_time")
    deposit = booking.get("deposit_type")

    if cancel_risk >= 65:
        tips.append("High risk: plan controlled overbooking for these dates to protect occupancy.")
    if deposit == "No Deposit" and cancel_risk >= 35:
        tips.append("Ask for a partial or refundable deposit - committed guests cancel far less.")
    if deposit == "Non Refund" and cancel_risk >= 65:
        tips.append("Non-refundable blocks in this data are often agent/group allotments that get released - confirm the rooming list early.")
    if _num(booking, "previous_cancellations") > 0:
        tips.append("This guest has cancelled before - offer a pre-paid rate or confirm a week ahead.")
    if lead > 90:
        tips.append(f"Booked {int(lead)} days ahead - send reminders 30 and 7 days before arrival.")
    if _num(booking, "total_of_special_requests") == 0:
        tips.append("Invite the guest to add room preferences - guests with special requests cancel less often.")
    if _num(booking, "adr") > 150 and cancel_risk >= 35:
        tips.append("High-value booking at risk - a personal confirmation call is worth it.")
    if _num(booking, "is_repeated_guest"):
        tips.append("Returning guest - a loyalty perk (late check-out, welcome drink) keeps them coming back.")
    if cancel_risk < 35 and not tips:
        tips.append("Low risk - a standard confirmation email is enough.")
    return tips[:4]
