"""
api/serializers.py — DRF serializers for every Biashara OS model.
"""
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework import serializers

from BusinessOs.models import (
    Brand, Business, BusinessStaff, Category, Customer, Expense,
    Payment, Product, Purchase, PurchaseItem, Sale, SaleItem,
    SaleReturn, SaleReturnItem, StockMovement, Supplier, UserProfile,
)
from BusinessOs.utils import normalize_phone

User = get_user_model()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["phone"]


class UserSerializer(serializers.ModelSerializer):
    phone = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "phone"]
        read_only_fields = fields

    def get_phone(self, obj):
        try:
            return obj.profile.phone
        except Exception:
            return ""


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)
    phone = serializers.CharField(max_length=20)
    business_name = serializers.CharField(max_length=200)
    business_location = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_phone(self, value):
        return normalize_phone(value)


# ---------------------------------------------------------------------------
# Business
# ---------------------------------------------------------------------------

class BusinessSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(source="owner.id", read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)

    class Meta:
        model = Business
        fields = ["id", "name", "location", "phone", "owner_id", "owner_username"]


class BusinessStaffSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    name = serializers.CharField(source="user.get_full_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    phone = serializers.SerializerMethodField()

    class Meta:
        model = BusinessStaff
        fields = ["id", "user_id", "username", "name", "email", "phone", "role"]

    def get_phone(self, obj):
        try:
            return obj.user.profile.phone
        except Exception:
            return ""


class AddStaffSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    name = serializers.CharField(max_length=200)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)
    phone = serializers.CharField(max_length=20)
    role = serializers.ChoiceField(choices=[("owner", "Owner"), ("seller", "Seller")])

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_phone(self, value):
        return normalize_phone(value)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class DashboardSerializer(serializers.Serializer):
    period_label = serializers.CharField()
    summary = serializers.DictField()
    trend_labels = serializers.ListField(child=serializers.CharField())
    trend_revenue = serializers.ListField(child=serializers.FloatField())
    trend_units = serializers.ListField(child=serializers.IntegerField())
    recent_sales = serializers.ListField()
    recent_expenses = serializers.ListField()
    low_stock = serializers.ListField()
    customers_in_debt = serializers.ListField()


# ---------------------------------------------------------------------------
# Customer / Supplier
# ---------------------------------------------------------------------------

class CustomerSerializer(serializers.ModelSerializer):
    balance_owed = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "balance_owed"]

    def validate_phone(self, value):
        business = self.context.get("business")
        raw = value.strip()
        if not raw:
            return ""
        phone = normalize_phone(raw)
        if business:
            qs = Customer.objects.filter(business=business, phone=phone)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "A customer with this phone already exists for this business."
                )
        return phone


class SupplierSerializer(serializers.ModelSerializer):
    balance_owed = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = Supplier
        fields = ["id", "name", "phone", "balance_owed"]

    def validate_phone(self, value):
        business = self.context.get("business")
        raw = value.strip()
        if not raw:
            return ""
        phone = normalize_phone(raw)
        if business:
            qs = Supplier.objects.filter(business=business, phone=phone)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "A supplier with this phone already exists for this business."
                )
        return phone


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name"]

    def validate_name(self, value):
        business = self.context.get("business")
        if business:
            qs = Brand.objects.filter(business=business, name__iexact=value)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("A brand with this name already exists.")
        return value


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]

    def validate_name(self, value):
        business = self.context.get("business")
        if business:
            qs = Category.objects.filter(business=business, name__iexact=value)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("A category with this name already exists.")
        return value


class ProductSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True, default="")
    category_name = serializers.CharField(source="category.name", read_only=True, default="")
    is_low_stock = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "brand", "brand_name", "category", "category_name",
            "cost_price", "selling_price", "stock_quantity", "low_stock_threshold",
            "image", "image_url", "is_low_stock",
        ]
        extra_kwargs = {
            "brand": {"required": False, "allow_null": True},
            "category": {"required": False, "allow_null": True},
            "image": {"required": False, "allow_null": True, "write_only": True},
        }

    def get_is_low_stock(self, obj):
        return obj.stock_quantity <= obj.low_stock_threshold

    def get_image_url(self, obj):
        if obj.image:
            try:
                return obj.image.url
            except Exception:
                return None
        return None


class RestockSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)
    note = serializers.CharField(required=False, allow_blank=True, default="")


# ---------------------------------------------------------------------------
# Sales
# ---------------------------------------------------------------------------

class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    returned_quantity = serializers.IntegerField(read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = SaleItem
        fields = [
            "id", "product", "product_name", "quantity", "unit_price",
            "unit_cost", "returned_quantity", "subtotal",
        ]

    def get_subtotal(self, obj):
        return float(obj.quantity * obj.unit_price)


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "amount", "method", "reference", "created_at"]


class SaleReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="sale_item.product.name", read_only=True
    )

    class Meta:
        model = SaleReturnItem
        fields = ["id", "sale_item", "product_name", "quantity"]


class SaleReturnSerializer(serializers.ModelSerializer):
    items = SaleReturnItemSerializer(many=True, read_only=True)

    class Meta:
        model = SaleReturn
        fields = [
            "id", "discount", "refund_method", "note",
            "processed_by_id", "created_at", "items",
        ]


class SaleSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True, default="Walk-in")
    customer_phone = serializers.CharField(source="customer.phone", read_only=True, default="")
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    status = serializers.CharField(read_only=True)
    estimated_profit = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    items = SaleItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    returns = SaleReturnSerializer(many=True, read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id", "customer", "customer_name", "customer_phone",
            "total_amount", "amount_paid", "balance", "status",
            "estimated_profit", "items", "payments", "returns",
            "created_at",
        ]


class SaleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — no nested items."""
    customer_name = serializers.CharField(source="customer.name", read_only=True, default="Walk-in")
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id", "customer_name", "total_amount", "amount_paid",
            "balance", "status", "created_at",
        ]


class RecordSaleLineItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class RecordSaleSerializer(serializers.Serializer):
    items = RecordSaleLineItemSerializer(many=True, min_length=1)
    payment_method = serializers.ChoiceField(
        choices=Payment.METHOD_CHOICES, default=Payment.CASH
    )
    amount_received = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0")
    )
    customer_name = serializers.CharField(required=False, allow_blank=True, default="")
    customer_phone = serializers.CharField(required=False, allow_blank=True, default="")


class RecordSaleReturnSerializer(serializers.Serializer):
    discount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=Decimal("0")
    )
    refund_method = serializers.ChoiceField(choices=Payment.METHOD_CHOICES, required=False, allow_blank=True, default="")
    note = serializers.CharField(required=False, allow_blank=True, default="")
    return_items = serializers.ListField(
        child=serializers.DictField(), min_length=1
    )


# ---------------------------------------------------------------------------
# Purchases
# ---------------------------------------------------------------------------

class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = PurchaseItem
        fields = ["id", "product", "product_name", "quantity", "unit_cost"]


class PurchaseSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default="")
    items = PurchaseItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    total_cost = serializers.SerializerMethodField()
    amount_paid = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    status = serializers.CharField(read_only=True)

    class Meta:
        model = Purchase
        fields = [
            "id", "supplier", "supplier_name", "invoice_no", "purchase_date",
            "total_cost", "amount_paid", "balance", "status", "items", "payments", "created_at",
        ]

    def get_total_cost(self, obj):
        return float(obj.total_amount)

    def get_amount_paid(self, obj):
        return float(obj.amount_paid)

    def get_balance(self, obj):
        return float(obj.balance)


class PurchaseListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default="")
    total_cost = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    status = serializers.CharField(read_only=True)

    class Meta:
        model = Purchase
        fields = [
            "id", "supplier_name", "invoice_no", "purchase_date",
            "total_cost", "balance", "status", "created_at",
        ]

    def get_total_cost(self, obj):
        return float(obj.total_amount)

    def get_balance(self, obj):
        return float(obj.balance)


class RecordPurchaseLineSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))


class RecordPurchaseSerializer(serializers.Serializer):
    items = RecordPurchaseLineSerializer(many=True, min_length=1)
    supplier_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    invoice_no = serializers.CharField(required=False, allow_blank=True, default="")
    purchase_date = serializers.DateField(required=False)
    payment_method = serializers.ChoiceField(
        choices=Payment.METHOD_CHOICES, default=Payment.CASH
    )
    amount_paid = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), default=Decimal("0")
    )


# ---------------------------------------------------------------------------
# Expenses & Payments
# ---------------------------------------------------------------------------

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = ["id", "description", "category", "amount", "date"]


class AddPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    method = serializers.ChoiceField(choices=Payment.METHOD_CHOICES)
    reference = serializers.CharField(required=False, allow_blank=True, default="")
