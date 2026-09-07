from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

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
    Supplier,
    UserProfile,
)
from .utils import normalize_phone

User = get_user_model()

TEXT_ATTRS = {"class": "input"}


class BusinessForm(forms.ModelForm):
    class Meta:
        model = Business
        fields = ["name", "location", "phone"]
        widgets = {
            "name": forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. Mama Neema Duka"}),
            "location": forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. Kariakoo, Dar es Salaam"}),
            "phone": forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. 0712345678"}),
        }


class BusinessStaffForm(forms.ModelForm):
    class Meta:
        model = BusinessStaff
        fields = ["user", "role"]
        widgets = {"user": forms.Select(attrs=TEXT_ATTRS), "role": forms.Select(attrs=TEXT_ATTRS)}

    def __init__(self, *args, business=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.business = business
        if business is not None:
            taken_ids = list(business.staff.values_list("user_id", flat=True)) + [business.owner_id]
            self.fields["user"].queryset = User.objects.exclude(id__in=taken_ids)

    def clean(self):
        cleaned = super().clean()
        user = cleaned.get("user")
        if self.business is not None and user is not None:
            if BusinessStaff.objects.filter(business=self.business, user=user).exists():
                raise forms.ValidationError("This person is already staff on this business.")
        return cleaned


# ---------------------------------------------------------------------------
# People: Customer / Supplier -- deliberately two forms, not one "Person"
# form with a type switch. See the comment on the Customer/Supplier models
# for why. A shared base class pulls out the actual duplication (name +
# phone + business-scoped duplicate check) without forcing one schema.
# ---------------------------------------------------------------------------

class _PersonForm(forms.ModelForm):
    """Not registered directly -- Customer/SupplierForm inherit this."""

    def __init__(self, *args, business=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.business = business

    def clean_phone(self):
        raw = (self.cleaned_data.get("phone") or "").strip()
        if not raw:
            return ""
        phone = normalize_phone(raw)
        if self.business is not None:
            existing = self._meta.model.objects.filter(business=self.business, phone=phone)
            if self.instance.pk:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise forms.ValidationError(
                    f"A {self._meta.model.__name__.lower()} with this phone number already exists "
                    "for this business."
                )
        return phone


class CustomerForm(_PersonForm):
    class Meta:
        model = Customer
        fields = ["name", "phone"]
        widgets = {
            "name": forms.TextInput(attrs=TEXT_ATTRS),
            "phone": forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. 0712345678"}),
        }


class SupplierForm(_PersonForm):
    class Meta:
        model = Supplier
        fields = ["name", "phone"]
        widgets = {
            "name": forms.TextInput(attrs=TEXT_ATTRS),
            "phone": forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. 0712345678"}),
        }


# ---------------------------------------------------------------------------
# Product catalog
# ---------------------------------------------------------------------------

class BrandForm(forms.ModelForm):
    class Meta:
        model = Brand
        fields = ["name"]
        widgets = {"name": forms.TextInput(attrs=TEXT_ATTRS)}


class CategoryForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = ["name"]
        widgets = {"name": forms.TextInput(attrs=TEXT_ATTRS)}


class ProductForm(forms.ModelForm):
    confirm_below_cost = forms.BooleanField(required=False, widget=forms.HiddenInput())

    class Meta:
        model = Product
        fields = [
            "name", "brand", "category", "image",
            "cost_price", "selling_price", "stock_quantity", "low_stock_threshold",
        ]
        widgets = {
            "name": forms.TextInput(attrs=TEXT_ATTRS),
            "brand": forms.Select(attrs=TEXT_ATTRS),
            "category": forms.Select(attrs=TEXT_ATTRS),
            "cost_price": forms.NumberInput(attrs={**TEXT_ATTRS, "step": "0.01", "min": "0"}),
            "selling_price": forms.NumberInput(attrs={**TEXT_ATTRS, "step": "0.01", "min": "0"}),
            "stock_quantity": forms.NumberInput(attrs={**TEXT_ATTRS, "min": "0"}),
            "low_stock_threshold": forms.NumberInput(attrs={**TEXT_ATTRS, "min": "0"}),
        }

    def __init__(self, *args, business=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.business = business
        if business is not None:
            # Scope the dropdowns so one business never sees another's
            # brands/categories -- easy to miss since Brand/Category have
            # no other natural scoping in a plain ModelChoiceField.
            self.fields["brand"].queryset = business.brands.all()
            self.fields["category"].queryset = business.categories.all()
        self.fields["brand"].required = False
        self.fields["category"].required = False

    def clean(self):
        cleaned = super().clean()
        cost = cleaned.get("cost_price")
        selling = cleaned.get("selling_price")
        if cost is not None and selling is not None and selling < cost and not cleaned.get("confirm_below_cost"):
            self.add_error(
                "selling_price",
                "This is below cost price (%s). If that's intentional (e.g. "
                "a loss-leader), confirm and resubmit -- otherwise check for "
                "a typo." % cost,
            )
        return cleaned


class RestockForm(forms.Form):
    quantity = forms.IntegerField(
        min_value=1,
        widget=forms.NumberInput(attrs={**TEXT_ATTRS, "min": "1"}),
        help_text="Units coming IN. This gets added to current stock.",
    )
    note = forms.CharField(
        max_length=200, required=False,
        widget=forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. supplier invoice #, delivery date"}),
    )


# ---------------------------------------------------------------------------
# Expense
# ---------------------------------------------------------------------------

class ExpenseForm(forms.ModelForm):
    class Meta:
        model = Expense
        fields = ["description", "category", "amount", "date"]
        widgets = {
            "description": forms.TextInput(attrs=TEXT_ATTRS),
            "category": forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "rent, transport, supplies…"}),
            "amount": forms.NumberInput(attrs={**TEXT_ATTRS, "step": "0.01", "min": "0"}),
            "date": forms.DateInput(attrs={**TEXT_ATTRS, "type": "date"}),
        }


# ---------------------------------------------------------------------------
# Payment
# ---------------------------------------------------------------------------

class PaymentForm(forms.ModelForm):
    class Meta:
        model = Payment
        fields = ["amount", "method", "reference", "description"]
        widgets = {
            "amount": forms.NumberInput(attrs={**TEXT_ATTRS, "step": "0.01", "min": "0.01"}),
            "method": forms.Select(attrs=TEXT_ATTRS),
            "reference": forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "mobile money transaction code (optional)"}),
            "description": forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "what this payment is for (optional)"}),
        }

    def __init__(self, *args, outstanding=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.outstanding = outstanding

    def clean_amount(self):
        amount = self.cleaned_data["amount"]
        if self.outstanding is not None and amount > self.outstanding:
            raise forms.ValidationError(
                "That's more than the outstanding balance (%s). Reduce the amount, "
                "or if it's a genuine overpayment handle it as a separate note for now -- "
                "this form doesn't model credit balances." % self.outstanding
            )
        return amount


# ---------------------------------------------------------------------------
# Purchases -- formset kept as the documented upgrade path, same status as
# SaleItemFormSet below: not wired into the function-based view, which
# parses POST data directly the way record_sale already does, for the same
# reason (validating "how much is left to receive/return" needs
# cross-row logic that a plain formset doesn't give you for free). If you
# outgrow the manual-parsing approach, this is what you switch to.
# ---------------------------------------------------------------------------

class PurchaseForm(forms.ModelForm):
    class Meta:
        model = Purchase
        fields = ["supplier", "invoice_no", "purchase_date"]
        widgets = {
            "supplier": forms.Select(attrs=TEXT_ATTRS),
            "invoice_no": forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "supplier invoice number (optional)"}),
            "purchase_date": forms.DateInput(attrs={**TEXT_ATTRS, "type": "date"}),
        }

    def __init__(self, *args, business=None, **kwargs):
        super().__init__(*args, **kwargs)
        if business is not None:
            self.fields["supplier"].queryset = business.suppliers.all()
        self.fields["supplier"].required = False


class PurchaseItemForm(forms.ModelForm):
    class Meta:
        model = PurchaseItem
        fields = ["product", "quantity", "unit_cost"]
        widgets = {
            "product": forms.Select(attrs=TEXT_ATTRS),
            "quantity": forms.NumberInput(attrs={**TEXT_ATTRS, "min": "1"}),
            "unit_cost": forms.NumberInput(attrs={**TEXT_ATTRS, "step": "0.01", "min": "0"}),
        }


PurchaseItemFormSet = forms.inlineformset_factory(
    Purchase, PurchaseItem, form=PurchaseItemForm, extra=1, can_delete=True,
)


# ---------------------------------------------------------------------------
# Sale return
# ---------------------------------------------------------------------------

class SaleReturnForm(forms.ModelForm):
    class Meta:
        model = SaleReturn
        fields = ["return_date", "discount", "refund_method"]
        widgets = {
            "return_date": forms.DateInput(attrs={**TEXT_ATTRS, "type": "date"}),
            "discount": forms.NumberInput(attrs={**TEXT_ATTRS, "step": "0.01", "min": "0"}),
            "refund_method": forms.Select(attrs=TEXT_ATTRS),
        }


# ---------------------------------------------------------------------------
# Sale items -- documented upgrade path, not wired into record_sale (which
# parses POST lists directly, same pattern the original file used).
# ---------------------------------------------------------------------------

class SaleItemForm(forms.ModelForm):
    class Meta:
        model = SaleItem
        fields = ["product", "quantity"]
        widgets = {
            "product": forms.Select(attrs=TEXT_ATTRS),
            "quantity": forms.NumberInput(attrs={**TEXT_ATTRS, "min": "1"}),
        }


SaleItemFormSet = forms.inlineformset_factory(
    Sale, SaleItem, form=SaleItemForm, extra=1, can_delete=True,
)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterForm(forms.Form):
    username = forms.CharField(
        max_length=150,
        label="Username",
        widget=forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. juma_kiosk", "autofocus": "autofocus"}),
        help_text="Choose a unique username to identify your account.",
    )
    email = forms.EmailField(
        label="Email address",
        widget=forms.EmailInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. juma@example.com"}),
        help_text="Used for account recovery and password resets.",
    )
    phone = forms.CharField(
        max_length=20,
        label="Phone number",
        widget=forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. 0712345678"}),
        help_text="Your mobile contact number for SMS and notifications.",
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs=TEXT_ATTRS),
        label="Password",
    )
    password_confirm = forms.CharField(
        widget=forms.PasswordInput(attrs=TEXT_ATTRS),
        label="Confirm password",
    )
    business_name = forms.CharField(
        max_length=150,
        label="Business name",
        widget=forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. Mama Neema Duka"}),
    )
    business_location = forms.CharField(
        max_length=200,
        required=False,
        label="Location",
        widget=forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. Kariakoo, Dar es Salaam"}),
    )

    def clean_username(self):
        raw_username = (self.cleaned_data.get("username") or "").strip()
        if not raw_username:
            raise ValidationError("Username is required.")
        if User.objects.filter(username__iexact=raw_username).exists():
            raise ValidationError("An account with this username already exists.")
        return raw_username

    def clean_email(self):
        raw_email = (self.cleaned_data.get("email") or "").strip().lower()
        if not raw_email:
            raise ValidationError("Email address is required.")
        if User.objects.filter(email__iexact=raw_email).exists():
            raise ValidationError("An account with this email address already exists.")
        return raw_email

    def clean_phone(self):
        raw_phone = (self.cleaned_data.get("phone") or "").strip()
        if not raw_phone:
            raise ValidationError("Phone number is required.")
        phone = normalize_phone(raw_phone)
        from .models import UserProfile
        if UserProfile.objects.filter(phone=phone).exists():
            raise ValidationError("An account with this phone number already exists.")
        return phone

    def clean(self):
        cleaned = super().clean()
        password = cleaned.get("password")
        confirm = cleaned.get("password_confirm")
        if password and confirm and password != confirm:
            raise ValidationError("Passwords do not match.")
        if password:
            validate_password(password)
        return cleaned


class AddStaffForm(forms.Form):
    username = forms.CharField(
        max_length=150,
        label="Staff username",
        widget=forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. seller_john"}),
    )
    name = forms.CharField(
        max_length=150,
        label="Staff member's name",
        widget=forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. John Doe"}),
    )
    email = forms.EmailField(
        required=False,
        label="Their email address",
        widget=forms.EmailInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. john@example.com (optional)"}),
    )
    phone = forms.CharField(
        max_length=20,
        label="Their phone number",
        widget=forms.TextInput(attrs={**TEXT_ATTRS, "placeholder": "e.g. 0712345678"}),
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs=TEXT_ATTRS),
        label="Set their password",
    )
    role = forms.ChoiceField(
        choices=BusinessStaff.ROLE_CHOICES,
        initial=BusinessStaff.SELLER,
        widget=forms.Select(attrs=TEXT_ATTRS),
    )

    def clean_username(self):
        raw = (self.cleaned_data.get("username") or "").strip()
        if User.objects.filter(username__iexact=raw).exists():
            raise ValidationError("An account with this username already exists.")
        return raw

    def clean_email(self):
        raw = (self.cleaned_data.get("email") or "").strip().lower()
        if raw and User.objects.filter(email__iexact=raw).exists():
            raise ValidationError("An account with this email address already exists.")
        return raw

    def clean_phone(self):
        phone = normalize_phone(self.cleaned_data["phone"])
        if User.objects.filter(username=phone).exists():
            raise ValidationError("An account with this phone number already exists.")
        if UserProfile.objects.filter(phone=phone).exists():
            raise ValidationError("An account with this phone number already exists.")
        return phone

    def clean_password(self):
        password = self.cleaned_data["password"]
        validate_password(password)
        return password