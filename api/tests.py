"""
api/tests.py — Unit tests for the Biashara OS REST API.
"""
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from BusinessOs.models import (
    Brand, Business, Category, Customer, Payment, Product, Sale, SaleItem
)

User = get_user_model()


class ApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="owner_api", password="password123", email="owner@test.com"
        )
        self.biz = Business.objects.create(
            owner=self.owner, name="Api Test Store", phone="0712345678"
        )
        self.brand = Brand.objects.create(business=self.biz, name="Api Brand")
        self.cat = Category.objects.create(business=self.biz, name="Api Cat")
        self.product = Product.objects.create(
            business=self.biz,
            name="Soda",
            brand=self.brand,
            category=self.cat,
            cost_price=Decimal("800"),
            selling_price=Decimal("1200"),
            stock_quantity=50,
        )
        # Authenticate
        login_res = self.client.post(
            "/api/auth/login/",
            {"username": "owner_api", "password": "password123"},
            format="json",
        )
        self.assertEqual(login_res.status_code, 200)
        self.token = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

    def test_dashboard_api(self):
        res = self.client.get(f"/api/businesses/{self.biz.id}/dashboard/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("summary", res.data)
        self.assertIn("trend_revenue", res.data)
        self.assertIn("recent_sales", res.data)

    def test_record_sale_api(self):
        sale_data = {
            "items": [{"product_id": self.product.id, "quantity": 5}],
            "payment_method": "cash",
            "amount_received": "6000.00",
        }
        res = self.client.post(
            f"/api/businesses/{self.biz.id}/sales/", sale_data, format="json"
        )
        self.assertEqual(res.status_code, 201)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 45)
        self.assertEqual(res.data["status"], "paid")

    def test_customer_debt_flow_api(self):
        # Sale with outstanding balance
        sale_data = {
            "items": [{"product_id": self.product.id, "quantity": 10}],
            "payment_method": "cash",
            "amount_received": "4000.00",
            "customer_name": "Hamisi",
            "customer_phone": "0711223344",
        }
        res = self.client.post(
            f"/api/businesses/{self.biz.id}/sales/", sale_data, format="json"
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "partial")

        # Check debtors filter
        cust_res = self.client.get(
            f"/api/businesses/{self.biz.id}/customers/?filter=debt"
        )
        self.assertEqual(cust_res.status_code, 200)
        self.assertEqual(len(cust_res.data), 1)
        self.assertEqual(float(cust_res.data[0]["balance_owed"]), 8000.0)

