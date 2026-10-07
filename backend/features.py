"""Feature definitions shared by training (train_model.py) and the API (app.py).

Categorical columns are label-encoded with the fixed mappings below, so the
codes used at training time are exactly the codes used at prediction time.
The frontend sends the human-readable labels; the API also accepts the codes.
"""

CATEGORY_MAPS = {
    "hotel": {"City Hotel": 0, "Resort Hotel": 1},
    # Refundable (24% cancel) and No Deposit (27%) behave alike; Non Refund (95%) is the outlier.
    # Tree models split on "code <= x", so Non Refund goes at the end, away from the rare
    # Refundable rows, or the model lumps Refundable in with Non Refund.
    "deposit_type": {"Refundable": 0, "No Deposit": 1, "Non Refund": 2},
    "market_segment": {
        "Online TA": 0,
        "Offline TA/TO": 1,
        "Direct": 2,
        "Corporate": 3,
        "Groups": 4,
        "Complementary": 5,
        "Aviation": 6,
        "Undefined": 7,
    },
    "distribution_channel": {"TA/TO": 0, "Direct": 1, "Corporate": 2, "GDS": 3, "Undefined": 4},
    "customer_type": {"Transient": 0, "Transient-Party": 1, "Contract": 2, "Group": 3},
}

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# Every column the model is trained on, in training order.
MODEL_FEATURES = [
    "hotel",
    "lead_time",
    "arrival_date_month",
    "stays_in_weekend_nights",
    "stays_in_week_nights",
    "adults",
    "children",
    "babies",
    "market_segment",
    "distribution_channel",
    "is_repeated_guest",
    "previous_cancellations",
    "previous_bookings_not_canceled",
    "booking_changes",
    "deposit_type",
    "days_in_waiting_list",
    "customer_type",
    "adr",
    "required_car_parking_spaces",
    "total_of_special_requests",
]

# Fields a user can enter in the UI or a CSV: (min, max, display label).
# The first six are the core form fields from the project spec; the rest are
# optional "more details". Anything not supplied falls back to the training
# baseline (median for numbers, most common value for categories).
INPUT_FIELDS = {
    "lead_time": (0, 750, "Lead time"),
    "adr": (0, 1000, "Average daily rate"),
    "deposit_type": (None, None, "Deposit type"),
    "is_repeated_guest": (0, 1, "Repeated guest"),
    "previous_cancellations": (0, 30, "Previous cancellations"),
    "total_of_special_requests": (0, 5, "Special requests"),
    "hotel": (None, None, "Hotel type"),
    "arrival_date_month": (1, 12, "Arrival month"),
    "stays_in_weekend_nights": (0, 20, "Weekend nights"),
    "stays_in_week_nights": (0, 50, "Week nights"),
    "adults": (0, 10, "Adults"),
    "children": (0, 10, "Children"),
    "market_segment": (None, None, "Market segment"),
    "customer_type": (None, None, "Customer type"),
    "required_car_parking_spaces": (0, 3, "Parking spaces"),
    "booking_changes": (0, 20, "Booking changes"),
}

CORE_FIELDS = list(INPUT_FIELDS)[:6]


def encode_value(field, raw):
    """Turn one user-supplied value into the number the model expects.

    Raises ValueError with a readable message when the value is not valid.
    """
    if field in CATEGORY_MAPS:
        mapping = CATEGORY_MAPS[field]
        if isinstance(raw, str) and raw.strip() in mapping:
            return mapping[raw.strip()]
        try:
            code = int(float(raw))
        except (TypeError, ValueError):
            raise ValueError(f"must be one of: {', '.join(mapping)}")
        if code not in mapping.values():
            raise ValueError(f"must be one of: {', '.join(mapping)}")
        return code

    if field == "arrival_date_month" and isinstance(raw, str) and raw.strip().title() in MONTHS:
        return MONTHS.index(raw.strip().title()) + 1

    low, high, _ = INPUT_FIELDS[field]
    try:
        number = float(raw)
    except (TypeError, ValueError):
        raise ValueError("must be a number")
    if number != number:  # NaN
        raise ValueError("must be a number")
    if number < low or number > high:
        raise ValueError(f"must be between {low} and {high}")
    return number if field == "adr" else int(round(number))


def decode_value(field, code):
    """Readable label for an encoded value (used in explanations)."""
    if field in CATEGORY_MAPS:
        for label, value in CATEGORY_MAPS[field].items():
            if value == int(code):
                return label
    if field == "arrival_date_month":
        return MONTHS[int(code) - 1]
    if field == "is_repeated_guest":
        return "Yes" if int(code) else "No"
    if field == "adr":
        return f"{float(code):.2f}"
    return str(int(code))
