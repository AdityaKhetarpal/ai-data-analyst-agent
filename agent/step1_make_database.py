"""
STEP 1 - MAKE THE SAMPLE DATABASE
---------------------------------
What:  Create a realistic Indian online shop in SQLite: customers, products, orders and order items,
       from Jan 2025 to Sep 2026, with festive-season peaks (Diwali), cancellations and returns.
Why:   The agent needs a database to query, and the tests need questions whose answers we can know exactly.
       This is SAMPLE data, made by code with a fixed random seed, so it is identical every time it is built.
Out:   data/shop.db

Run:   python agent/step1_make_database.py
"""
import sqlite3

import numpy as np
import pandas as pd

import settings

rng = np.random.default_rng(42)       # fixed seed -> the same database every time

CITIES = [  # city, state, how many customers relative to others
    ("Mumbai", "Maharashtra", 14), ("Delhi", "Delhi", 14), ("Bengaluru", "Karnataka", 13), ("Hyderabad", "Telangana", 9),
    ("Chennai", "Tamil Nadu", 8), ("Pune", "Maharashtra", 8), ("Kolkata", "West Bengal", 7), ("Ahmedabad", "Gujarat", 6),
    ("Jaipur", "Rajasthan", 5), ("Lucknow", "Uttar Pradesh", 5), ("Kochi", "Kerala", 4), ("Chandigarh", "Chandigarh", 4),
    ("Indore", "Madhya Pradesh", 3), ("Bhubaneswar", "Odisha", 3), ("Guwahati", "Assam", 3)]
FIRST = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Arjun", "Rohan", "Kabir", "Ananya", "Diya", "Saanvi", "Isha", "Priya",
         "Meera", "Kavya", "Riya", "Neha", "Rahul", "Siddharth", "Nikhil", "Pooja", "Sneha", "Varun", "Tanvi", "Karan"]
LAST = ["Sharma", "Verma", "Iyer", "Reddy", "Nair", "Gupta", "Mehta", "Patel", "Singh", "Das", "Khan", "Joshi",
        "Kulkarni", "Banerjee", "Chopra", "Menon", "Rao", "Bhat"]
CATALOG = {  # category: (products, price range in rupees)
    "Electronics": (["Wireless Earbuds", "Smartwatch", "Bluetooth Speaker", "Power Bank 20000mAh", "Laptop Stand",
                     "Mechanical Keyboard", "4K Monitor 27in", "Noise Cancelling Headphones", "Smartphone 5G", "Tablet 10in"], (999, 34999)),
    "Fashion": (["Cotton Kurta", "Denim Jeans", "Running Shoes", "Silk Saree", "Leather Wallet", "Sunglasses",
                 "Linen Shirt", "Sneakers", "Handbag", "Winter Jacket"], (499, 6999)),
    "Home & Kitchen": (["Pressure Cooker 5L", "Non-stick Pan", "Mixer Grinder", "Air Fryer", "Bedsheet Set",
                        "Water Purifier", "LED Desk Lamp", "Storage Containers", "Dinner Set", "Vacuum Cleaner"], (399, 14999)),
    "Beauty": (["Face Serum", "Sunscreen SPF 50", "Hair Dryer", "Perfume", "Lipstick Set", "Beard Trimmer",
                "Moisturiser", "Shampoo 1L", "Kajal", "Face Wash"], (149, 3999)),
    "Books": (["Python Programming", "Indian History", "Business Strategy", "Cookbook", "Children's Stories",
               "Self-Help Classic", "Mystery Novel", "Exam Guide", "Poetry Collection", "Finance Basics"], (199, 1499)),
    "Grocery": (["Basmati Rice 5kg", "Green Tea", "Almonds 1kg", "Olive Oil 1L", "Masala Combo", "Dark Chocolate",
                 "Coffee Beans", "Honey 500g", "Dry Fruit Gift Box", "Organic Dal 2kg"], (149, 2499)),
    "Sports": (["Yoga Mat", "Cricket Bat", "Dumbbell Set", "Badminton Racket", "Football", "Cycling Helmet",
                "Resistance Bands", "Skipping Rope", "Tennis Balls", "Sports Bottle"], (199, 7999)),
}
BRANDS = ["Nova", "Zenith", "Aurum", "Kiran", "Urban Leaf", "Peak", "Saffron", "Vega", "Lotus", "Orbit"]   # made up


def make_customers(n=1500):
    weights = np.array([c[2] for c in CITIES], dtype=float)
    city_idx = rng.choice(len(CITIES), size=n, p=weights / weights.sum())
    signup = pd.to_datetime("2024-06-01") + pd.to_timedelta(rng.integers(0, 820, n), unit="D")
    return pd.DataFrame({
        "customer_id": np.arange(1, n + 1),
        "name": [f"{rng.choice(FIRST)} {rng.choice(LAST)}" for _ in range(n)],
        "city": [CITIES[i][0] for i in city_idx],
        "state": [CITIES[i][1] for i in city_idx],
        "segment": rng.choice(["Consumer", "Business"], size=n, p=[0.85, 0.15]),
        "signup_date": signup.strftime("%Y-%m-%d"),
    })


def make_products():
    rows, pid = [], 1
    for category, (names, (low, high)) in CATALOG.items():
        for name in names:
            price = round(float(np.exp(rng.uniform(np.log(low), np.log(high)))) / 10) * 10 - 1   # e.g. 2,499
            rows.append({"product_id": pid, "product_name": name, "category": category,
                         "brand": str(rng.choice(BRANDS)), "list_price_inr": max(price, 99)})
            pid += 1
    return pd.DataFrame(rows)


def make_orders(customers, products, n=12000):
    days = pd.date_range("2025-01-01", "2026-09-30", freq="D")
    # more orders over time (growth) and in Oct-Nov (Diwali season); fewer before signup is handled below
    weight = np.linspace(1.0, 1.8, len(days)) * np.where(days.month.isin([10, 11]), 1.9, 1.0) * np.where(days.dayofweek >= 5, 1.2, 1.0)
    order_days = rng.choice(days, size=n, p=weight / weight.sum())
    order_days = np.sort(order_days)
    customer_ids = rng.choice(customers["customer_id"], size=n)
    status = rng.choice(["delivered", "cancelled", "returned", "shipped"], size=n, p=[0.86, 0.07, 0.05, 0.02])
    delay = rng.integers(1, 8, n)
    orders = pd.DataFrame({
        "order_id": np.arange(100001, 100001 + n),
        "customer_id": customer_ids,
        "order_date": pd.to_datetime(order_days).strftime("%Y-%m-%d"),
        "delivery_date": (pd.to_datetime(order_days) + pd.to_timedelta(delay, unit="D")).strftime("%Y-%m-%d"),
        "status": status,
        "payment_method": rng.choice(["UPI", "Card", "Cash on Delivery", "Net Banking", "Wallet"], size=n, p=[0.48, 0.22, 0.17, 0.08, 0.05]),
    })
    orders.loc[orders["status"].isin(["cancelled", "shipped"]), "delivery_date"] = None   # never delivered (yet)
    # shipped orders are only the most recent ones
    orders.loc[(orders["status"] == "shipped") & (orders["order_date"] < "2026-09-20"), "status"] = "delivered"
    redo = orders["status"].eq("delivered") & orders["delivery_date"].isna()
    orders.loc[redo, "delivery_date"] = (pd.to_datetime(orders.loc[redo, "order_date"]) + pd.Timedelta(days=4)).dt.strftime("%Y-%m-%d")

    item_rows, item_id = [], 1
    popularity = rng.gamma(1.5, 1.0, len(products))          # some products sell much more than others
    for order_id in orders["order_id"]:
        for pid in rng.choice(products["product_id"], size=rng.choice([1, 1, 1, 2, 2, 3]), replace=False, p=popularity / popularity.sum()):
            price = int(products.loc[products["product_id"] == pid, "list_price_inr"].iloc[0])
            item_rows.append({"order_item_id": item_id, "order_id": int(order_id), "product_id": int(pid),
                              "quantity": int(rng.choice([1, 1, 1, 1, 2, 2, 3])), "unit_price_inr": price,
                              "discount_pct": int(rng.choice([0, 0, 0, 5, 10, 10, 15, 20, 30]))})
            item_id += 1
    return orders, pd.DataFrame(item_rows)


SCHEMA = """
CREATE TABLE customers (customer_id INTEGER PRIMARY KEY, name TEXT, city TEXT, state TEXT, segment TEXT, signup_date TEXT);
CREATE TABLE products (product_id INTEGER PRIMARY KEY, product_name TEXT, category TEXT, brand TEXT, list_price_inr INTEGER);
CREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(customer_id), order_date TEXT,
                     delivery_date TEXT, status TEXT, payment_method TEXT);
CREATE TABLE order_items (order_item_id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(order_id),
                          product_id INTEGER REFERENCES products(product_id), quantity INTEGER, unit_price_inr INTEGER, discount_pct INTEGER);
"""


def build(path=settings.DATABASE):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    customers, products = make_customers(), make_products()
    orders, items = make_orders(customers, products)
    with sqlite3.connect(path) as con:
        con.executescript(SCHEMA)
        for name, table in [("customers", customers), ("products", products), ("orders", orders), ("order_items", items)]:
            table.to_sql(name, con, if_exists="append", index=False)
        con.execute("VACUUM")
    return {"customers": len(customers), "products": len(products), "orders": len(orders), "order_items": len(items)}


if __name__ == "__main__":
    print("Step 1: making the sample database")
    print(build(), "->", settings.DATABASE.name)
