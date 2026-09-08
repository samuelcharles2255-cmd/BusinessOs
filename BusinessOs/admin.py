"""
Biashara OS — admin site.

Rules followed here (match the reasoning in models.py):
1. Computed properties (total_amount, balance, status, balance_owed, is_low_stock)
   are shown directly in list_display. Django's admin can read a @property
   straight off the model — no wrapper methods needed. Don't add ceremony
   you don't need.
2. Editing surfaces are NOT duplicated for data that must stay consistent.
   SaleItem is only edited inside its Sale (never standalone) because a
   SaleItem with no parent Sale context is meaningless.
3. Anything computed (money totals) can't be sorted or searched on in the
   list view — that's a real Django limitation, not a bug in this file.
"""

from django.contrib import admin

from .models import (
    Business,
    BusinessStaff,
    Product,
    StockMovement,
    Customer,
    Sale,
    SaleItem,
    Expense,
    Payment,
)


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "location", "phone", "created_at")
    search_fields = ("name", "owner__username", "phone")
    list_filter = ("created_at",)
    autocomplete_fields = ("owner",)


@admin.register(BusinessStaff)
class BusinessStaffAdmin(admin.ModelAdmin):
    list_display = ("user", "business", "role", "created_at")
    list_filter = ("role", "business")
    search_fields = ("user__username", "business__name")
    autocomplete_fields = ("user", "business")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "cost_price", "selling_price", "stock_quantity", "is_low_stock")
    list_filter = ("business",)
    search_fields = ("name",)

    @admin.display(boolean=True, description="Low stock")
    def is_low_stock(self, obj):
        return obj.is_low_stock


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    """
    Movements with reason='sale' are created automatically by SaleItem.save().
    Editing or deleting those here would make your audit trail lie — don't.
    'restock' and 'adjustment' entries are the only ones you should be
    typing in by hand.

    Heads up: there is currently no dedicated "restock" screen anywhere in
    this app. Right now, THIS admin page is your only restock tool — when
    stock arrives, you manually bump Product.stock_quantity AND add a
    matching StockMovement here. That's two manual steps a tired shopkeeper
    will forget. Build a real restock form before you hand this to a real
    business owner.
    """
    list_display = ("product", "quantity_change", "reason", "note", "created_at")
    list_filter = ("reason", "created_at")
    search_fields = ("product__name", "note")

    def has_change_permission(self, request, obj=None):
        if obj and obj.reason == StockMovement.SALE:
            return False
        return True

    def has_delete_permission(self, request, obj=None):
        if obj and obj.reason == StockMovement.SALE:
            return False
        return True


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "phone", "balance_owed")
    list_filter = ("business",)
    search_fields = ("name", "phone")


class SaleItemInline(admin.TabularInline):
    """
    unit_price and unit_cost are required here on purpose. The model's
    save() will auto-fill them from the product ONLY if left as None — but
    Django admin forms won't submit required fields blank. That's correct
    behavior: in the admin you should be typing the exact price the item
    sold at, not silently trusting whatever the product's current price is.
    """
    model = SaleItem
    extra = 1
    autocomplete_fields = ("product",)
    fields = ("product", "quantity", "unit_price", "unit_cost")


class SalePaymentInline(admin.TabularInline):
    model = Payment
    fk_name = "sale"
    extra = 0
    fields = ("amount", "method", "reference", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = (
        "id", "business", "customer", "total_amount",
        "amount_paid", "balance", "status", "created_at",
    )
    list_filter = ("business", "created_at")
    search_fields = ("customer__name", "customer__phone", "id")
    autocomplete_fields = ("business", "customer", "recorded_by")
    inlines = [SaleItemInline, SalePaymentInline]


class ExpensePaymentInline(admin.TabularInline):
    model = Payment
    fk_name = "expense"
    extra = 0
    fields = ("amount", "method", "reference", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("description", "business", "category", "amount", "amount_paid", "balance_owed", "date")
    list_filter = ("business", "category", "date")
    search_fields = ("description",)
    inlines = [ExpensePaymentInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """
    Standalone view of every shilling that moved, across both sales and
    expenses — your full cash ledger in one place. The inlines on Sale and
    Expense are for convenience when you're already looking at one record;
    this is for reviewing cash flow as a whole (feeds your Dashboard).
    """
    list_display = ("id", "business", "sale", "expense", "amount", "method", "reference", "created_at")
    list_filter = ("method", "business")
    search_fields = ("reference", "sale__id", "expense__description")
    autocomplete_fields = ("business", "sale", "expense")