"""
Biashara OS -- views.

Layered on top of the original record_sale / restock_product pattern:
function-based views that parse POST data directly for anything with
variable-length line items (sales, purchases, returns), class-based views
for straightforward CRUD (products, customers, suppliers, expenses,
brands, categories). Kept consistent rather than mixing patterns
arbitrarily -- picking one style per "shape of problem" and sticking to
it is worth more than either style alone.

Access rule used everywhere: Business.can_record_sales(user) -- owner or
staff. Business settings, staff management, and deleting a product's
brand/category stay owner-only, same reasoning as before: a seller must
never be able to grant themselves or someone else more access.
"""
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth import login as auth_login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import F
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import translation
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from .forms import (
    AddStaffForm,
    BrandForm,
    BusinessForm,
    BusinessStaffForm,
    CategoryForm,
    CustomerForm,
    ExpenseForm,
    PaymentForm,
    ProductForm,
    PurchaseForm,
    RegisterForm,
    RestockForm,
    SaleReturnForm,
    SupplierForm,
)
from .models import (
    Brand,
    Business,
    BusinessStaff,
    Category,
    Customer,
    Expense,
    Payment,
    Product,
    Purchase,
    PurchaseItem,
    Sale,
    SaleItem,
    SaleReturn,
    SaleReturnItem,
    StockMovement,
    Supplier,
    UserProfile,
)
from .utils import normalize_phone

User = get_user_model()


# ---------------------------------------------------------------------------
# Access mixins
# ---------------------------------------------------------------------------

class BusinessAccessMixin(LoginRequiredMixin):
    """Owner or staff. Sets self.business from <int:business_id> in the URL."""

    def dispatch(self, request, *args, **kwargs):
        self.business = get_object_or_404(Business, pk=kwargs["business_id"])
        if not self.business.can_record_sales(request.user):
            raise PermissionDenied("You are not authorized for this business.")
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["business"] = self.business
        return ctx


class BusinessOwnerMixin(LoginRequiredMixin):
    """Owner only -- for staff management, business settings, and catalog
    upkeep (brands/categories) where letting a seller silently rename a
    brand everyone else relies on for filtering is a real footgun."""

    def dispatch(self, request, *args, **kwargs):
        self.business = get_object_or_404(Business, pk=kwargs["business_id"])
        if self.business.owner_id != request.user.id:
            raise PermissionDenied("Only the business owner can do this.")
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["business"] = self.business
        return ctx


# ---------------------------------------------------------------------------
# Auth: Register / dashboard landing
# ---------------------------------------------------------------------------

def register(request):
    if request.user.is_authenticated:
        return redirect("dashboard")

    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            with transaction.atomic():
                user = User.objects.create_user(
                    username=data["username"],
                    email=data["email"],
                    password=data["password"],
                )
                UserProfile.objects.update_or_create(
                    user=user,
                    defaults={"phone": data["phone"]},
                )
                business = Business.objects.create(
                    owner=user,
                    name=data["business_name"],
                    location=data.get("business_location", ""),
                    phone=data["phone"],
                )
            auth_login(request, user, backend="BusinessOs.backends.PhoneOrUsernameBackend")
            return redirect("business_dashboard", business_id=business.id)
    else:
        form = RegisterForm()

    return render(request, "accounts/register.html", {"form": form})


@login_required
def dashboard(request):
    owned_or_staffed = Business.objects.filter(owner=request.user) | Business.objects.filter(
        staff__user=request.user
    )
    owned_or_staffed = owned_or_staffed.distinct()

    if owned_or_staffed.count() == 1:
        return redirect("business_dashboard", business_id=owned_or_staffed.first().id)
    return redirect("business_list")


@login_required
def business_dashboard(request, business_id):
    """
    The actual working dashboard: quick access to record a sale, a rolling
    view of recent orders, expenses, revenue, and profit/loss -- everything
    computed via the aggregate methods on Business, never a Python loop
    over the full sales/expense history.
    """
    business = get_object_or_404(Business, pk=business_id)
    if not business.can_record_sales(request.user):
        raise PermissionDenied("You are not authorized for this business.")

    today = date.today()
    start_of_month = today.replace(day=1)

    summary = business.profit_summary(start_of_month, today)
    recent_sales = business.sales.select_related("customer")[:10]
    recent_expenses = business.expenses.all()[:10]
    low_stock = business.low_stock_products()[:10]
    customers_in_debt = business.customers_in_debt()[:10]

    raw_trend = list(business.performance_trend(start_of_month, today, granularity="daily"))
    import json
    trend_labels = json.dumps([row["period"].strftime("%d %b") if row["period"] else "" for row in raw_trend])
    trend_revenue = json.dumps([float(row["revenue"] or 0) for row in raw_trend])
    trend_units = json.dumps([row["units_sold"] or 0 for row in raw_trend])

    return render(request, "sales/dashboard.html", {
        "business": business,
        "period_label": f"{start_of_month:%d %b} – {today:%d %b %Y}",
        "summary": summary,
        "recent_sales": recent_sales,
        "recent_expenses": recent_expenses,
        "low_stock": low_stock,
        "customers_in_debt": customers_in_debt,
        "trend_labels": trend_labels,
        "trend_revenue": trend_revenue,
        "trend_units": trend_units,
    })


# ---------------------------------------------------------------------------
# Business
# ---------------------------------------------------------------------------

class BusinessListView(LoginRequiredMixin, ListView):
    model = Business
    template_name = "sales/business_list.html"
    context_object_name = "businesses"

    def get_queryset(self):
        user = self.request.user
        return (Business.objects.filter(owner=user) | Business.objects.filter(staff__user=user)).distinct()


class BusinessCreateView(LoginRequiredMixin, CreateView):
    model = Business
    form_class = BusinessForm
    template_name = "sales/business_form.html"

    def form_valid(self, form):
        form.instance.owner = self.request.user
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("business_detail", kwargs={"business_id": self.object.id})


class BusinessDetailView(BusinessAccessMixin, DetailView):
    model = Business
    template_name = "sales/business_detail.html"
    context_object_name = "business_obj"
    pk_url_kwarg = "business_id"

    def get_object(self, queryset=None):
        return self.business


class BusinessUpdateView(BusinessOwnerMixin, UpdateView):
    model = Business
    form_class = BusinessForm
    template_name = "sales/business_form.html"
    pk_url_kwarg = "business_id"

    def get_object(self, queryset=None):
        return self.business

    def get_success_url(self):
        return reverse("business_detail", kwargs={"business_id": self.object.id})


class BusinessDeleteView(BusinessOwnerMixin, DeleteView):
    model = Business
    template_name = "sales/business_confirm_delete.html"
    pk_url_kwarg = "business_id"

    def get_object(self, queryset=None):
        return self.business

    def get_success_url(self):
        return reverse("business_list")


@login_required
def business_settings(request, business_id):
    business = get_object_or_404(Business, pk=business_id)
    if not business.can_record_sales(request.user):
        raise PermissionDenied("You are not authorized for this business.")

    is_owner = (business.owner_id == request.user.id)
    if request.method == "POST" and is_owner:
        form = BusinessForm(request.POST, instance=business)
        if form.is_valid():
            form.save()
            from django.contrib import messages
            messages.success(request, "Business settings updated successfully.")
            return redirect("business_settings", business_id=business.id)
    else:
        form = BusinessForm(instance=business)

    current_lang = request.session.get("biashara_lang", request.COOKIES.get("biashara_lang", "en"))

    return render(request, "sales/settings.html", {
        "business": business,
        "form": form,
        "is_owner": is_owner,
        "current_lang": current_lang,
    })


def set_language_preference(request):
    lang = request.GET.get("lang") or request.POST.get("lang") or "en"
    if lang not in ["en", "sw"]:
        lang = "en"
    request.session["biashara_lang"] = lang
    request.session["_language"] = lang
    translation.activate(lang)
    referer = request.META.get("HTTP_REFERER") or "/"
    response = redirect(referer)
    response.set_cookie("biashara_lang", lang, max_age=365*24*60*60)
    cookie_name = getattr(settings, "LANGUAGE_COOKIE_NAME", "biashara_lang")
    response.set_cookie(cookie_name, lang, max_age=365*24*60*60)
    return response


def direct_password_reset(request):
    """
    Direct in-browser password reset:
    User enters their email, username, or phone number.
    If matching account is found, generates a secure one-time cryptographic token
    and redirects directly to password_reset_confirm so the user can set their new
    password immediately in their browser, eliminating the need for terminal console access.
    """
    error = None
    identifier = ""
    if request.method == "POST":
        identifier = request.POST.get("identifier", "").strip() or request.POST.get("email", "").strip()
        if not identifier:
            error = "Please enter your email, username, or phone number."
        else:
            User = get_user_model()
            user = User.objects.filter(username__iexact=identifier).first()
            if not user:
                user = User.objects.filter(email__iexact=identifier).first()
            if not user:
                try:
                    from .utils import normalize_phone
                    norm_phone = normalize_phone(identifier)
                    user = User.objects.filter(profile__phone=norm_phone).first()
                except Exception:
                    pass
            if not user:
                from django.db.models import Q
                user = User.objects.filter(
                    Q(profile__phone=identifier) | Q(username=identifier)
                ).first()

            if user and user.is_active:
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                return redirect("password_reset_confirm", uidb64=uid, token=token)
            else:
                error = "No active account found matching that email, username, or phone number. Please check and try again."

    return render(request, "accounts/password_reset_form.html", {
        "error": error,
        "identifier": identifier,
    })



# ---------------------------------------------------------------------------
# People -- Staff (Customer and Supplier CRUD are further down, grouped
# with their own natural neighbors; all three sit under one "People" menu
# entry in the nav/urls, per the model-layer comment on why they're not
# merged into one table).
# ---------------------------------------------------------------------------

class BusinessStaffListView(BusinessOwnerMixin, ListView):
    template_name = "sales/staff_list.html"
    context_object_name = "staff_members"

    def get_queryset(self):
        return self.business.staff.select_related("user")


class BusinessStaffDeleteView(BusinessOwnerMixin, DeleteView):
    model = BusinessStaff
    template_name = "sales/staff_confirm_delete.html"

    def get_queryset(self):
        return self.business.staff.all()

    def get_success_url(self):
        return reverse("staff_list", kwargs={"business_id": self.business.id})


@login_required
def add_staff(request, business_id):
    business = get_object_or_404(Business, pk=business_id)
    if request.user != business.owner:
        raise PermissionDenied("Only the business owner can add staff.")

    if request.method == "POST":
        form = AddStaffForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            with transaction.atomic():
                user = User.objects.create_user(
                    username=data["username"],
                    email=data.get("email") or "",
                    password=data["password"],
                    first_name=data["name"],
                )
                UserProfile.objects.update_or_create(
                    user=user,
                    defaults={"phone": data["phone"]},
                )
                BusinessStaff.objects.create(business=business, user=user, role=data["role"])
            return redirect("staff_list", business_id=business.id)
    else:
        form = AddStaffForm()

    return render(request, "accounts/add_staff.html", {"form": form, "business": business})


# ---------------------------------------------------------------------------
# People -- Customers (with in-debt filtering for the "added automatically
# to their section" behaviour you asked for)
# ---------------------------------------------------------------------------

class CustomerListView(BusinessAccessMixin, ListView):
    template_name = "sales/customer_list.html"
    context_object_name = "customers"

    def get_queryset(self):
        qs = self.business.customers.all()
        if self.request.GET.get("filter") == "debt":
            # Swap to the set-wide aggregate query when filtering, instead
            # of self.business.customers.all() + a Python-side balance
            # check per row -- same N+1 trap flagged on Customer.balance_owed.
            return self.business.customers_in_debt()
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["debt_filter_active"] = self.request.GET.get("filter") == "debt"
        return ctx


class CustomerCreateView(BusinessAccessMixin, CreateView):
    model = Customer
    form_class = CustomerForm
    template_name = "sales/customer_form.html"

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["business"] = self.business
        return kwargs

    def form_valid(self, form):
        form.instance.business = self.business
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("customer_list", kwargs={"business_id": self.business.id})


class CustomerUpdateView(BusinessAccessMixin, UpdateView):
    model = Customer
    form_class = CustomerForm
    template_name = "sales/customer_form.html"

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["business"] = self.business
        return kwargs

    def get_queryset(self):
        return self.business.customers.all()

    def get_success_url(self):
        return reverse("customer_list", kwargs={"business_id": self.business.id})


# ---------------------------------------------------------------------------
# People -- Suppliers (mirrors Customer views; same reasoning, opposite
# direction of debt)
# ---------------------------------------------------------------------------

class SupplierListView(BusinessAccessMixin, ListView):
    template_name = "sales/supplier_list.html"
    context_object_name = "suppliers"

    def get_queryset(self):
        if self.request.GET.get("filter") == "owed":
            return self.business.suppliers_owed()
        return self.business.suppliers.all()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["owed_filter_active"] = self.request.GET.get("filter") == "owed"
        return ctx


class SupplierCreateView(BusinessAccessMixin, CreateView):
    model = Supplier
    form_class = SupplierForm
    template_name = "sales/supplier_form.html"

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["business"] = self.business
        return kwargs

    def form_valid(self, form):
        form.instance.business = self.business
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("supplier_list", kwargs={"business_id": self.business.id})


class SupplierUpdateView(BusinessAccessMixin, UpdateView):
    model = Supplier
    form_class = SupplierForm
    template_name = "sales/supplier_form.html"

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["business"] = self.business
        return kwargs

    def get_queryset(self):
        return self.business.suppliers.all()

    def get_success_url(self):
        return reverse("supplier_list", kwargs={"business_id": self.business.id})


# ---------------------------------------------------------------------------
# Product catalog: Brand / Category (lightweight, owner-managed) / Product
# ---------------------------------------------------------------------------

class BrandListView(BusinessAccessMixin, ListView):
    template_name = "sales/brand_list.html"
    context_object_name = "brands"

    def get_queryset(self):
        return self.business.brands.all()


class BrandCreateView(BusinessOwnerMixin, CreateView):
    model = Brand
    form_class = BrandForm
    template_name = "sales/brand_form.html"

    def form_valid(self, form):
        form.instance.business = self.business
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("brand_list", kwargs={"business_id": self.business.id})


class CategoryListView(BusinessAccessMixin, ListView):
    template_name = "sales/category_list.html"
    context_object_name = "categories"

    def get_queryset(self):
        return self.business.categories.all()


class CategoryCreateView(BusinessOwnerMixin, CreateView):
    model = Category
    form_class = CategoryForm
    template_name = "sales/category_form.html"

    def form_valid(self, form):
        form.instance.business = self.business
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("category_list", kwargs={"business_id": self.business.id})


class ProductListView(BusinessAccessMixin, ListView):
    """
    Supports ?brand=<id> and ?category=<id> so the "arranged according to
    brand and category" requirement is a real filter, not just a sort
    order -- sorting alone still shows every product on one long page.
    """
    template_name = "sales/product_list.html"
    context_object_name = "products"

    def get_queryset(self):
        qs = self.business.products.select_related("brand", "category")
        brand_id = self.request.GET.get("brand")
        category_id = self.request.GET.get("category")
        if brand_id:
            qs = qs.filter(brand_id=brand_id)
        if category_id:
            qs = qs.filter(category_id=category_id)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["brands"] = self.business.brands.all()
        ctx["categories"] = self.business.categories.all()
        return ctx


class ProductCreateView(BusinessAccessMixin, CreateView):
    model = Product
    form_class = ProductForm
    template_name = "sales/product_form.html"

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["business"] = self.business
        return kwargs

    def form_valid(self, form):
        form.instance.business = self.business
        response = super().form_valid(form)
        if self.object.stock_quantity:
            StockMovement.objects.create(
                product=self.object,
                quantity_change=self.object.stock_quantity,
                reason=StockMovement.RESTOCK,
                note="Opening stock",
            )
        return response

    def get_success_url(self):
        return reverse("product_list", kwargs={"business_id": self.business.id})


class ProductUpdateView(BusinessAccessMixin, UpdateView):
    model = Product
    form_class = ProductForm
    template_name = "sales/product_form.html"

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["business"] = self.business
        return kwargs

    def get_queryset(self):
        return self.business.products.all()

    def get_success_url(self):
        return reverse("product_list", kwargs={"business_id": self.business.id})


@login_required
def restock_product(request, business_id, product_id):
    """Manual, no-paperwork restock. If this stock came from a real
    purchase you want tracked against a supplier and paid off over time,
    use record_purchase instead -- this view deliberately stays simple
    and doesn't touch Supplier/Purchase at all."""
    business = get_object_or_404(Business, pk=business_id)
    if not business.can_record_sales(request.user):
        raise PermissionDenied("You are not authorized for this business.")
    product = get_object_or_404(Product, pk=product_id, business=business)

    if request.method == "POST":
        form = RestockForm(request.POST)
        if form.is_valid():
            qty = form.cleaned_data["quantity"]
            note = form.cleaned_data["note"]
            with transaction.atomic():
                Product.objects.filter(pk=product.pk).update(stock_quantity=F("stock_quantity") + qty)
                StockMovement.objects.create(
                    product=product, quantity_change=qty, reason=StockMovement.RESTOCK, note=note
                )
            return redirect("product_list", business_id=business.id)
    else:
        form = RestockForm()

    return render(request, "sales/restock_form.html", {"business": business, "product": product, "form": form})


# ---------------------------------------------------------------------------
# Expense
# ---------------------------------------------------------------------------

class ExpenseListView(BusinessAccessMixin, ListView):
    template_name = "sales/expense_list.html"
    context_object_name = "expenses"

    def get_queryset(self):
        return self.business.expenses.all()


class ExpenseCreateView(BusinessAccessMixin, CreateView):
    model = Expense
    form_class = ExpenseForm
    template_name = "sales/expense_form.html"

    def form_valid(self, form):
        form.instance.business = self.business
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("expense_list", kwargs={"business_id": self.business.id})


class ExpenseUpdateView(BusinessAccessMixin, UpdateView):
    model = Expense
    form_class = ExpenseForm
    template_name = "sales/expense_form.html"

    def get_queryset(self):
        return self.business.expenses.all()

    def get_success_url(self):
        return reverse("expense_list", kwargs={"business_id": self.business.id})


# ---------------------------------------------------------------------------
# Sale
# ---------------------------------------------------------------------------

class SaleListView(BusinessAccessMixin, ListView):
    """This was missing entirely from what you sent -- sale_detail existed
    but there was no page listing sales, so "view orders" from the
    dashboard had nowhere to link to."""
    template_name = "sales/sale_list.html"
    context_object_name = "sale_list"
    paginate_by = 30

    def get_queryset(self):
        return self.business.sales.select_related("customer")


@login_required
def record_sale(request, business_id):
    business = get_object_or_404(Business, pk=business_id)
    if not business.can_record_sales(request.user):
        raise PermissionDenied("You are not authorized to record sales for this business.")

    products_qs = list(business.products.all())

    def _err(msg):
        return render(request, "sales/record_sale.html", {
            "business": business, "products": products_qs, "error": msg,
        })

    if request.method != "POST":
        return render(request, "sales/record_sale.html", {"business": business, "products": products_qs})

    product_ids = request.POST.getlist("product_id")
    quantities = request.POST.getlist("quantity")
    payment_method = request.POST.get("payment_method", Payment.CASH)
    customer_name = request.POST.get("customer_name", "").strip()
    customer_phone = request.POST.get("customer_phone", "").strip()

    try:
        amount_received = Decimal(request.POST.get("amount_received", "0"))
    except InvalidOperation:
        return _err("Amount received must be a number.")

    if not product_ids:
        return _err("Add at least one product to the sale.")

    line_items = []
    for product_id, qty in zip(product_ids, quantities):
        product = get_object_or_404(Product, pk=product_id, business=business)
        try:
            quantity = int(qty)
        except (ValueError, TypeError):
            return _err("Quantity must be a whole number.")
        if quantity <= 0:
            return _err("Quantity must be at least 1.")
        if quantity > product.stock_quantity:
            return _err(f"Only {product.stock_quantity} units of {product.name} left in stock.")
        line_items.append((product, quantity))

    total = sum(p.selling_price * q for p, q in line_items)
    has_balance = amount_received < total

    normalized_phone = None
    if has_balance:
        if not customer_name or not customer_phone:
            return _err("This sale has a balance. Enter the customer's name and phone to record the debt.")
        try:
            normalized_phone = normalize_phone(customer_phone)
        except ValidationError as e:
            return _err(f"Invalid phone number: {e.message}")

    with transaction.atomic():
        sale = Sale.objects.create(business=business, recorded_by=request.user)

        for product, quantity in line_items:
            SaleItem.objects.create(
                sale=sale, product=product, quantity=quantity,
                unit_price=product.selling_price, unit_cost=product.cost_price,
            )

        if has_balance:
            customer, _ = Customer.objects.get_or_create(
                business=business, phone=normalized_phone, defaults={"name": customer_name},
            )
            sale.customer = customer
            sale.save(update_fields=["customer"])

        if amount_received > 0:
            Payment.objects.create(business=business, sale=sale, amount=amount_received, method=payment_method)

    return redirect("sale_detail", sale_id=sale.id)


@login_required
def sale_detail(request, sale_id):
    sale = get_object_or_404(Sale, pk=sale_id)
    if not sale.business.can_record_sales(request.user):
        raise PermissionDenied("You are not authorized for this business.")
    return render(request, "sales/sale_detail.html", {"business": sale.business, "sale": sale})


# ---------------------------------------------------------------------------
# Sale returns -- tied to a Sale, not free-text customer info; see the long
# comment on the SaleReturn model for why that override was made.
# ---------------------------------------------------------------------------

@login_required
def record_sale_return(request, sale_id):
    sale = get_object_or_404(Sale, pk=sale_id)
    business = sale.business
    if not business.can_record_sales(request.user):
        raise PermissionDenied("You are not authorized for this business.")

    # Only line items that still have returnable quantity remaining --
    # computed via the property, fine here since one sale has a small,
    # bounded number of line items (same reasoning as Sale.total_amount).
    returnable_items = [item for item in sale.items.all() if item.returned_quantity < item.quantity]

    def _err(msg):
        return render(request, "sales/record_sale_return.html", {
            "business": business, "sale": sale, "returnable_items": returnable_items, "error": msg,
        })

    if request.method != "POST":
        return render(request, "sales/record_sale_return.html", {
            "business": business, "sale": sale, "returnable_items": returnable_items,
        })

    form = SaleReturnForm(request.POST)
    if not form.is_valid():
        return _err("; ".join(f"{f}: {e}" for f, errs in form.errors.items() for e in errs))

    sale_item_ids = request.POST.getlist("sale_item_id")
    quantities = request.POST.getlist("return_quantity")

    if not sale_item_ids:
        return _err("Select at least one item to return.")

    return_lines = []
    for sale_item_id, qty in zip(sale_item_ids, quantities):
        if not qty:
            continue
        sale_item = get_object_or_404(SaleItem, pk=sale_item_id, sale=sale)
        try:
            quantity = int(qty)
        except (ValueError, TypeError):
            return _err("Return quantity must be a whole number.")
        if quantity <= 0:
            continue
        remaining = sale_item.quantity - sale_item.returned_quantity
        if quantity > remaining:
            return _err(f"Only {remaining} unit(s) of {sale_item.product.name} can still be returned.")
        return_lines.append((sale_item, quantity))

    if not return_lines:
        return _err("Enter a return quantity for at least one item.")

    with transaction.atomic():
        sale_return = form.save(commit=False)
        sale_return.sale = sale
        sale_return.processed_by = request.user
        sale_return.save()

        for sale_item, quantity in return_lines:
            SaleReturnItem.objects.create(sale_return=sale_return, sale_item=sale_item, quantity=quantity)

    return redirect("sale_detail", sale_id=sale.id)


# ---------------------------------------------------------------------------
# Purchases
# ---------------------------------------------------------------------------

class PurchaseListView(BusinessAccessMixin, ListView):
    template_name = "sales/purchase_list.html"
    context_object_name = "purchases"
    paginate_by = 30

    def get_queryset(self):
        return self.business.purchases.select_related("supplier")


@login_required
def record_purchase(request, business_id):
    """
    Mirrors record_sale's shape on purpose: validate every line fully
    before writing anything, then do the whole write in one transaction.
    The one real difference is there's no "not enough stock" check to run
    first, since a purchase only ever adds stock.
    """
    business = get_object_or_404(Business, pk=business_id)
    if not business.can_record_sales(request.user):
        raise PermissionDenied("You are not authorized for this business.")

    products_qs = list(business.products.all())
    suppliers_qs = list(business.suppliers.all())

    def _err(msg):
        return render(request, "sales/record_purchase.html", {
            "business": business, "products": products_qs, "suppliers": suppliers_qs, "error": msg,
        })

    if request.method != "POST":
        return render(request, "sales/record_purchase.html", {
            "business": business, "products": products_qs, "suppliers": suppliers_qs,
        })

    product_ids = request.POST.getlist("product_id")
    quantities = request.POST.getlist("quantity")
    unit_costs = request.POST.getlist("unit_cost")
    supplier_id = request.POST.get("supplier_id") or None
    invoice_no = request.POST.get("invoice_no", "").strip()
    purchase_date_str = request.POST.get("purchase_date") or str(date.today())
    payment_method = request.POST.get("payment_method", Payment.CASH)

    try:
        amount_paid = Decimal(request.POST.get("amount_paid", "0"))
    except InvalidOperation:
        return _err("Amount paid must be a number.")

    if not product_ids:
        return _err("Add at least one product to the purchase.")

    supplier = None
    if supplier_id:
        supplier = get_object_or_404(Supplier, pk=supplier_id, business=business)

    line_items = []
    for product_id, qty, cost in zip(product_ids, quantities, unit_costs):
        product = get_object_or_404(Product, pk=product_id, business=business)
        try:
            quantity = int(qty)
            unit_cost = Decimal(cost)
        except (ValueError, TypeError, InvalidOperation):
            return _err("Quantity and unit cost must be numbers.")
        if quantity <= 0:
            return _err("Quantity must be at least 1.")
        if unit_cost < 0:
            return _err("Unit cost can't be negative.")
        line_items.append((product, quantity, unit_cost))

    with transaction.atomic():
        purchase = Purchase.objects.create(
            business=business, supplier=supplier, invoice_no=invoice_no,
            purchase_date=purchase_date_str, recorded_by=request.user,
        )
        for product, quantity, unit_cost in line_items:
            PurchaseItem.objects.create(purchase=purchase, product=product, quantity=quantity, unit_cost=unit_cost)

        if amount_paid > 0:
            Payment.objects.create(business=business, purchase=purchase, amount=amount_paid, method=payment_method)

    return redirect("purchase_detail", purchase_id=purchase.id)


@login_required
def purchase_detail(request, purchase_id):
    purchase = get_object_or_404(Purchase, pk=purchase_id)
    if not purchase.business.can_record_sales(request.user):
        raise PermissionDenied("You are not authorized for this business.")
    return render(request, "sales/purchase_detail.html", {"business": purchase.business, "purchase": purchase})


# ---------------------------------------------------------------------------
# Payment (installments against an existing Sale, Expense, or Purchase)
# ---------------------------------------------------------------------------

@login_required
def add_payment(request, business_id, target_type, target_id):
    business = get_object_or_404(Business, pk=business_id)
    if not business.can_record_sales(request.user):
        raise PermissionDenied("You are not authorized for this business.")

    if target_type == "sale":
        target = get_object_or_404(Sale, pk=target_id, business=business)
        outstanding = target.balance
    elif target_type == "expense":
        target = get_object_or_404(Expense, pk=target_id, business=business)
        outstanding = target.balance_owed
    elif target_type == "purchase":
        target = get_object_or_404(Purchase, pk=target_id, business=business)
        outstanding = target.balance
    else:
        raise Http404("Unknown payment target.")

    if request.method == "POST":
        form = PaymentForm(request.POST, outstanding=outstanding)
        if form.is_valid():
            payment = form.save(commit=False)
            payment.business = business
            setattr(payment, target_type, target)
            payment.save()
            if target_type == "sale":
                return redirect("sale_detail", sale_id=target.id)
            if target_type == "purchase":
                return redirect("purchase_detail", purchase_id=target.id)
            return redirect("expense_list", business_id=business.id)
    else:
        form = PaymentForm(outstanding=outstanding)

    return render(request, "sales/payment_form.html", {
        "business": business, "target": target, "target_type": target_type,
        "outstanding": outstanding, "form": form,
    })