from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.models import Customer, FinancialFact, Order, OrderItem, Product, User


def seed_data(db: Session) -> None:
    if not db.query(User).first():
        demo = User(
            email="admin@example.com",
            username="admin",
            hashed_password=get_password_hash("admin123"),
            full_name="Demo Admin",
        )
        db.add(demo)
        db.commit()

    if not db.query(Customer).first():
        customers = [
            Customer(name="Alice Johnson", email="alice@example.com"),
            Customer(name="Bob Smith", email="bob@example.com"),
        ]
        products = [
            Product(name="Laptop", category="Electronics", price=1200.0),
            Product(name="Mouse", category="Electronics", price=25.0),
            Product(name="Desk Chair", category="Furniture", price=180.0),
        ]
        db.add_all(customers + products)
        db.flush()

        orders = [
            Order(customer_id=customers[0].id),
            Order(customer_id=customers[1].id),
        ]
        db.add_all(orders)
        db.flush()

        db.add_all(
            [
                OrderItem(order_id=orders[0].id, product_id=products[0].id, quantity=1, unit_price=1200.0),
                OrderItem(order_id=orders[0].id, product_id=products[1].id, quantity=2, unit_price=25.0),
                OrderItem(order_id=orders[1].id, product_id=products[2].id, quantity=1, unit_price=180.0),
            ]
        )

    # A fresh local install should demonstrate charts immediately, without requiring an upload.
    if not db.query(FinancialFact).first():
        values = {
            "2023": (1_240_000, 830_000, 210_000),
            "2024": (1_510_000, 970_000, 295_000),
            "2025": (1_860_000, 1_170_000, 390_000),
            "2026": (2_240_000, 1_390_000, 510_000),
        }
        facts = []
        for period, (revenue, expenses, net_income) in values.items():
            for metric, value in (("revenue", revenue), ("expenses", expenses), ("net_income", net_income)):
                facts.append(
                    FinancialFact(
                        company="Asklytics Demo Co.",
                        statement_type="income_statement",
                        metric=metric,
                        period=period,
                        value=float(value),
                        unit="USD",
                        level="consolidated",
                        currency="USD",
                        source_file="asklytics_demo_seed",
                        source_page=1,
                        is_valid=True,
                        extraction_method="seed",
                        confidence=1.0,
                    )
                )
        db.add_all(facts)

    db.commit()
