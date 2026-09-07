from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import (
    Business, Brand, Category, Customer, Expense, Payment, Product,
    Purchase, PurchaseItem, Sale, SaleItem, SaleReturn, SaleReturnItem,
    Supplier,
)

User = get_user_model()


class BiasharaLogicTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="x")
        self.biz = Business.objects.create(owner=self.owner, name="Test Duka")
        self.brand = Brand.objects.create(business=self.biz, name="Azam")
        self.cat = Category.objects.create(business=self.biz, name="Beverages")
        self.product = Product.objects.create(
            business=self.biz, name="Soda 500ml", brand=self.brand, category=self.cat,
            cost_price=Decimal("800"), selling_price=Decimal("1200"), stock_quantity=50,
        )
        self.customer = Customer.objects.create(business=self.biz, name="Juma", phone="0712345678")
        self.supplier = Supplier.objects.create(business=self.biz, name="Bakhresa", phone="0754321111")

    def test_sale_reduces_stock_and_computes_correctly(self):
        sale = Sale.objects.create(business=self.biz, customer=self.customer, recorded_by=self.owner)
        SaleItem.objects.create(sale=sale, product=self.product, quantity=10,
                                 unit_price=self.product.selling_price, unit_cost=self.product.cost_price)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 40)
        self.assertEqual(sale.total_amount, Decimal("12000"))
        self.assertEqual(sale.estimated_profit, Decimal("4000"))
        self.assertEqual(sale.status, "unpaid")
        Payment.objects.create(business=self.biz, sale=sale, amount=Decimal("5000"), method=Payment.CASH)
        self.assertEqual(sale.status, "partial")
        self.assertEqual(sale.balance, Decimal("7000"))

    def test_customers_in_debt_uses_subqueries_not_fanout(self):
        sale1 = Sale.objects.create(business=self.biz, customer=self.customer, recorded_by=self.owner)
        SaleItem.objects.create(sale=sale1, product=self.product, quantity=5,
                                 unit_price=Decimal("1200"), unit_cost=Decimal("800"))
        sale2 = Sale.objects.create(business=self.biz, customer=self.customer, recorded_by=self.owner)
        SaleItem.objects.create(sale=sale2, product=self.product, quantity=3,
                                 unit_price=Decimal("1200"), unit_cost=Decimal("800"))
        Payment.objects.create(business=self.biz, sale=sale1, amount=Decimal("1000"), method=Payment.CASH)
        Payment.objects.create(business=self.biz, sale=sale1, amount=Decimal("500"), method=Payment.MPESA)

        total_revenue = Decimal("1200") * 8
        total_paid = Decimal("1500")
        expected_balance = total_revenue - total_paid

        debtors = self.biz.customers_in_debt()
        self.assertEqual(debtors.count(), 1)
        self.assertEqual(debtors.first().balance, expected_balance)
        self.assertEqual(self.customer.balance_owed, expected_balance)

    def test_purchase_increases_stock_and_updates_cost(self):
        purchase = Purchase.objects.create(
            business=self.biz, supplier=self.supplier, invoice_no="INV-001",
            purchase_date=date.today(), recorded_by=self.owner,
        )
        PurchaseItem.objects.create(purchase=purchase, product=self.product, quantity=20, unit_cost=Decimal("850"))
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 70)
        self.assertEqual(self.product.cost_price, Decimal("850"))
        self.assertEqual(purchase.total_amount, Decimal("17000"))
        self.assertEqual(purchase.status, "unpaid")

    def test_supplier_debt_tracked_independently_of_customer_debt(self):
        purchase = Purchase.objects.create(
            business=self.biz, supplier=self.supplier, purchase_date=date.today(), recorded_by=self.owner,
        )
        PurchaseItem.objects.create(purchase=purchase, product=self.product, quantity=10, unit_cost=Decimal("800"))
        Payment.objects.create(business=self.biz, purchase=purchase, amount=Decimal("3000"), method=Payment.CASH)
        self.assertEqual(self.supplier.balance_owed, Decimal("5000"))
        owed = self.biz.suppliers_owed()
        self.assertEqual(owed.count(), 1)
        self.assertEqual(owed.first().balance, Decimal("5000"))

    def test_sale_return_reverses_stock_and_profit(self):
        sale = Sale.objects.create(business=self.biz, customer=self.customer, recorded_by=self.owner)
        item = SaleItem.objects.create(sale=sale, product=self.product, quantity=10,
                                        unit_price=Decimal("1200"), unit_cost=Decimal("800"))
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 40)

        start, end = date.today(), date.today()
        summary_before = self.biz.profit_summary(start, end)
        self.assertEqual(summary_before["revenue"], Decimal("12000"))
        self.assertEqual(summary_before["gross_profit"], Decimal("4000"))

        ret = SaleReturn.objects.create(sale=sale, return_date=date.today(),
                                         discount=Decimal("200"), processed_by=self.owner)
        SaleReturnItem.objects.create(sale_return=ret, sale_item=item, quantity=4)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 44)
        self.assertEqual(ret.refund_subtotal, Decimal("4800"))
        self.assertEqual(ret.refund_amount, Decimal("4600"))

        summary_after = self.biz.profit_summary(start, end)
        self.assertEqual(summary_after["revenue"], Decimal("12000") - Decimal("4600"))
        self.assertEqual(summary_after["cost_of_goods_sold"], Decimal("8000") - Decimal("3200"))

    def test_sale_return_cannot_exceed_quantity_sold(self):
        sale = Sale.objects.create(business=self.biz, customer=self.customer, recorded_by=self.owner)
        item = SaleItem.objects.create(sale=sale, product=self.product, quantity=3,
                                        unit_price=Decimal("1200"), unit_cost=Decimal("800"))
        ret = SaleReturn.objects.create(sale=sale, return_date=date.today(), processed_by=self.owner)
        bad_item = SaleReturnItem(sale_return=ret, sale_item=item, quantity=5)
        with self.assertRaises(ValidationError):
            bad_item.full_clean(exclude=["sale_return"])

    def test_payment_must_have_exactly_one_target(self):
        expense = Expense.objects.create(business=self.biz, description="Rent",
                                          amount=Decimal("50000"), date=date.today())
        sale = Sale.objects.create(business=self.biz, recorded_by=self.owner)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Payment.objects.create(business=self.biz, amount=Decimal("100"), method=Payment.CASH)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Payment.objects.create(business=self.biz, sale=sale, expense=expense,
                                        amount=Decimal("100"), method=Payment.CASH)
        p = Payment(business=self.biz, sale=sale, expense=expense, amount=Decimal("100"), method=Payment.CASH)
        with self.assertRaises(ValidationError):
            p.clean()

    def test_low_stock_and_debt_helpers_no_python_loops_needed(self):
        Product.objects.create(business=self.biz, name="Low Item", cost_price=100,
                                selling_price=150, stock_quantity=2, low_stock_threshold=5)
        self.assertEqual(self.biz.low_stock_products().count(), 1)
        self.assertEqual(self.biz.customers_in_debt().count(), 0)


class ViewIntegrationTests(TestCase):
    """These exercise the actual HTTP layer (client, POST parsing, redirects,
    permission checks) for the function-based views on their success paths.
    GET requests to most views need templates that don't exist yet (out of
    scope here), so this focuses on what's testable without them: full
    POST round-trips, which redirect on success without rendering."""

    def setUp(self):
        self.owner = User.objects.create_user(username="owner2", password="x")
        self.other = User.objects.create_user(username="rando", password="x")
        self.biz = Business.objects.create(owner=self.owner, name="Test Duka 2")
        self.product = Product.objects.create(
            business=self.biz, name="Sugar 1kg", cost_price=Decimal("2000"),
            selling_price=Decimal("2800"), stock_quantity=100,
        )
        self.supplier = Supplier.objects.create(business=self.biz, name="Supplier X", phone="0765551234")
        self.client.login(username="owner2", password="x")

    def test_record_purchase_end_to_end(self):
        resp = self.client.post(f"/{self.biz.id}/purchases/new/", {
            "product_id": [str(self.product.id)],
            "quantity": ["50"],
            "unit_cost": ["1900"],
            "supplier_id": str(self.supplier.id),
            "invoice_no": "INV-777",
            "purchase_date": str(date.today()),
            "amount_paid": "50000",
            "payment_method": Payment.MPESA,
        })
        self.assertEqual(resp.status_code, 302)
        purchase = Purchase.objects.get(invoice_no="INV-777")
        self.assertEqual(purchase.total_amount, Decimal("95000"))  # 50*1900
        self.assertEqual(purchase.amount_paid, Decimal("50000"))
        self.assertEqual(purchase.balance, Decimal("45000"))
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 150)
        self.assertEqual(self.product.cost_price, Decimal("1900"))
        self.assertEqual(self.supplier.balance_owed, Decimal("45000"))

    def test_record_purchase_rejects_negative_cost(self):
        resp = self.client.post(f"/{self.biz.id}/purchases/new/", {
            "product_id": [str(self.product.id)], "quantity": ["10"], "unit_cost": ["-5"],
            "purchase_date": str(date.today()), "amount_paid": "0",
        })
        self.assertEqual(resp.status_code, 200)  # re-renders with error, no redirect
        self.assertEqual(Purchase.objects.count(), 0)

    def test_record_sale_then_return_end_to_end(self):
        sale_resp = self.client.post(f"/{self.biz.id}/sales/new/", {
            "product_id": [str(self.product.id)], "quantity": ["5"], "amount_received": "14000",
            "payment_method": Payment.CASH,
        })
        self.assertEqual(sale_resp.status_code, 302)
        sale = Sale.objects.latest("id")
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 95)

        sale_item = sale.items.first()
        ret_resp = self.client.post(f"/sale/{sale.id}/return/", {
            "return_date": str(date.today()), "discount": "0", "refund_method": Payment.CASH,
            "sale_item_id": [str(sale_item.id)], "return_quantity": ["2"],
        })
        self.assertEqual(ret_resp.status_code, 302)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 97)  # 95 + 2 back
        self.assertEqual(sale.returns.first().refund_amount, Decimal("5600"))  # 2*2800

    def test_record_sale_return_blocks_over_return(self):
        sale = Sale.objects.create(business=self.biz, recorded_by=self.owner)
        item = SaleItem.objects.create(sale=sale, product=self.product, quantity=3,
                                        unit_price=Decimal("2800"), unit_cost=Decimal("2000"))
        resp = self.client.post(f"/sale/{sale.id}/return/", {
            "return_date": str(date.today()), "discount": "0", "refund_method": Payment.CASH,
            "sale_item_id": [str(item.id)], "return_quantity": ["10"],  # only 3 sold
        })
        self.assertEqual(resp.status_code, 200)  # rejected, re-rendered with error
        self.assertEqual(SaleReturn.objects.count(), 0)

    def test_stranger_cannot_record_sale_for_someone_elses_business(self):
        self.client.logout()
        self.client.login(username="rando", password="x")
        resp = self.client.post(f"/{self.biz.id}/sales/new/", {
            "product_id": [str(self.product.id)], "quantity": ["1"], "amount_received": "2800",
        })
        self.assertEqual(resp.status_code, 403)


class PasswordResetDirectTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="shopkeeper",
            email="shopkeeper@example.com",
            password="oldpassword123",
        )

    def test_get_password_reset_page(self):
        resp = self.client.get("/password-reset/")
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Reset Your Password")

    def test_direct_password_reset_redirects_to_confirm_in_browser(self):
        # Submitting username or email directly redirects to the browser password confirm URL
        resp = self.client.post("/password-reset/", {"identifier": "shopkeeper"})
        self.assertEqual(resp.status_code, 302)
        redirect_url = resp["Location"]
        self.assertIn("/reset/", redirect_url)

        # Follow redirect in browser
        confirm_resp = self.client.get(redirect_url, follow=True)
        self.assertEqual(confirm_resp.status_code, 200)
        self.assertContains(confirm_resp, "Set New Password")

    def test_direct_password_reset_by_email(self):
        resp = self.client.post("/password-reset/", {"identifier": "shopkeeper@example.com"})
        self.assertEqual(resp.status_code, 302)
        self.assertIn("/reset/", resp["Location"])

    def test_direct_password_reset_invalid_identifier(self):
        resp = self.client.post("/password-reset/", {"identifier": "nonexistent_person"})
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "No active account found")

    def test_password_reset_done_has_no_developer_console_warning(self):
        resp = self.client.get("/password-reset/done/")
        self.assertEqual(resp.status_code, 200)
        self.assertNotContains(resp, "Developer Mode — Console Email")
        self.assertNotContains(resp, "terminal/console")


class LanguageSwitcherTests(TestCase):
    def test_switch_language_to_swahili(self):
        resp = self.client.get("/set-language/?lang=sw")
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(self.client.session.get("biashara_lang"), "sw")
        self.assertEqual(resp.cookies["biashara_lang"].value, "sw")

    def test_switch_language_to_english(self):
        resp = self.client.get("/set-language/?lang=en")
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(self.client.session.get("biashara_lang"), "en")
        self.assertEqual(resp.cookies["biashara_lang"].value, "en")

    def test_swahili_content_rendered(self):
        # Set cookie to sw
        self.client.cookies["biashara_lang"] = "sw"
        resp = self.client.get("/password-reset/")
        self.assertEqual(resp.status_code, 200)
        # Verify Swahili language attribute is present in rendered HTML
        self.assertContains(resp, 'lang="sw"')
        self.assertContains(resp, "Biashara OS")