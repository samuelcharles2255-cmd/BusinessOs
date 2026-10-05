"""
api/views.py — All REST API views for Biashara OS.

Auth:     JWT (access token in Authorization header or httpOnly cookie)
Patterns: APIView for complex logic, generics for simple CRUD
"""
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from BusinessOs.models import (
    Brand, Business, BusinessStaff, Category, Customer, Expense,
    Payment, Product, Purchase, PurchaseItem, Sale, SaleItem,
    SaleReturn, SaleReturnItem, StockMovement, Supplier, UserProfile,
)
from BusinessOs.utils import normalize_phone

from .permissions import IsBusinessMember, IsBusinessOwner
from .serializers import (
    AddPaymentSerializer, AddStaffSerializer, BrandSerializer,
    BusinessSerializer, BusinessStaffSerializer, CategorySerializer,
    CustomerSerializer, ExpenseSerializer, ProductSerializer,
    PurchaseListSerializer, PurchaseSerializer, RecordPurchaseSerializer,
    RecordSaleReturnSerializer, RecordSaleSerializer, RegisterSerializer,
    RestockSerializer, SaleListSerializer, SaleSerializer,
    SupplierSerializer, UserSerializer,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


def _get_business_or_403(user, business_id):
    business = get_object_or_404(Business, pk=business_id)
    if not business.can_record_sales(user):
        raise PermissionDenied("You are not authorized for this business.")
    return business


def _require_owner(user, business):
    if business.owner_id != user.id:
        raise PermissionDenied("Only the business owner can do this.")


class StandardPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 200


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        with transaction.atomic():
            user = User.objects.create_user(
                username=data["username"],
                email=data.get("email", ""),
                password=data["password"],
            )
            UserProfile.objects.update_or_create(
                user=user, defaults={"phone": data["phone"]}
            )
            business = Business.objects.create(
                owner=user,
                name=data["business_name"],
                location=data.get("business_location", ""),
                phone=data["phone"],
            )
        tokens = _get_tokens(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "business_id": business.id,
                **tokens,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = (request.data.get("username") or "").strip()
        password = (request.data.get("password") or "").strip()
        if not identifier or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Try all three auth backends
        user = authenticate(
            request, username=identifier, password=password
        )
        if not user:
            # Try email
            user = authenticate(request, email=identifier, password=password)
        if not user:
            # Try phone via the custom backend directly
            from BusinessOs.backends import PhoneOrUsernameBackend
            user = PhoneOrUsernameBackend().authenticate(
                request, username=identifier, password=password
            )
        if not user or not user.is_active:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        tokens = _get_tokens(user)
        # Find user's businesses
        businesses = list(
            (Business.objects.filter(owner=user) | Business.objects.filter(staff__user=user))
            .distinct()
            .values("id", "name")
        )
        return Response(
            {
                "user": UserSerializer(user).data,
                "businesses": businesses,
                **tokens,
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass
        return Response({"detail": "Logged out."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = User.objects.select_related("profile").get(pk=request.user.pk)
        businesses = list(
            (Business.objects.filter(owner=user) | Business.objects.filter(staff__user=user))
            .distinct()
            .values("id", "name")
        )
        return Response({"user": UserSerializer(user).data, "businesses": businesses})


class PasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        identifier = (request.data.get("identifier") or "").strip()
        if not identifier:
            return Response({"detail": "Enter your email, username, or phone."}, status=400)

        user = User.objects.filter(username__iexact=identifier).first()
        if not user:
            user = User.objects.filter(email__iexact=identifier).first()
        if not user:
            try:
                phone = normalize_phone(identifier)
                user = User.objects.filter(profile__phone=phone).first()
            except Exception:
                pass

        if not user or not user.is_active:
            return Response({"detail": "No active account found."}, status=404)

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        return Response({"uid": uid, "token": token})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode

        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")

        if not all([uid, token, new_password]):
            return Response({"detail": "uid, token, and new_password are required."}, status=400)

        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_pk)
        except Exception:
            return Response({"detail": "Invalid reset link."}, status=400)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Reset link is invalid or has expired."}, status=400)

        user.set_password(new_password)
        user.save()
        return Response({"detail": "Password updated successfully."})


# ---------------------------------------------------------------------------
# Business
# ---------------------------------------------------------------------------

class BusinessListCreateView(generics.ListCreateAPIView):
    serializer_class = BusinessSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (
            Business.objects.filter(owner=user) | Business.objects.filter(staff__user=user)
        ).distinct().select_related("owner")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class BusinessDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def get(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        return Response(BusinessSerializer(business).data)

    def put(self, request, business_id):
        business = get_object_or_404(Business, pk=business_id)
        _require_owner(request.user, business)
        serializer = BusinessSerializer(business, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, business_id):
        business = get_object_or_404(Business, pk=business_id)
        _require_owner(request.user, business)
        business.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def get(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        today = date.today()
        start_of_month = today.replace(day=1)

        summary = business.profit_summary(start_of_month, today)
        # Make summary JSON-serializable
        summary_data = {k: float(v) if hasattr(v, "__float__") else v for k, v in summary.items()}

        recent_sales_qs = (
            business.sales.select_related("customer")
            .prefetch_related("items", "payments")[:10]
        )
        recent_sales = [
            {
                "id": s.id,
                "created_at": s.created_at,
                "customer_name": s.customer.name if s.customer else "Walk-in",
                "total_amount": float(s.total_amount),
                "status": s.status,
            }
            for s in recent_sales_qs
        ]

        recent_expenses = list(
            business.expenses.all()[:10].values(
                "id", "description", "category", "amount", "date"
            )
        )
        for e in recent_expenses:
            e["amount"] = float(e["amount"])
            if e["date"]:
                e["date"] = e["date"].isoformat()

        low_stock = list(
            business.low_stock_products()[:10].values(
                "id", "name", "stock_quantity", "low_stock_threshold"
            )
        )
        customers_in_debt = []
        for c in business.customers_in_debt()[:10]:
            customers_in_debt.append({
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "balance": float(c.balance),
            })

        raw_trend = list(business.performance_trend(start_of_month, today, granularity="daily"))
        trend_labels = [row["period"].strftime("%d %b") if row["period"] else "" for row in raw_trend]
        trend_revenue = [float(row["revenue"] or 0) for row in raw_trend]
        trend_units = [int(row["units_sold"] or 0) for row in raw_trend]

        period_label = f"{start_of_month:%d %b} – {today:%d %b %Y}"

        return Response({
            "period_label": period_label,
            "summary": summary_data,
            "trend_labels": trend_labels,
            "trend_revenue": trend_revenue,
            "trend_units": trend_units,
            "recent_sales": recent_sales,
            "recent_expenses": recent_expenses,
            "low_stock": low_stock,
            "customers_in_debt": customers_in_debt,
        })


# ---------------------------------------------------------------------------
# Staff
# ---------------------------------------------------------------------------

class StaffListView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessOwner]

    def get(self, request, business_id):
        business = get_object_or_404(Business, pk=business_id)
        _require_owner(request.user, business)
        staff = business.staff.select_related("user", "user__profile")
        return Response(BusinessStaffSerializer(staff, many=True).data)

    def post(self, request, business_id):
        business = get_object_or_404(Business, pk=business_id)
        _require_owner(request.user, business)
        serializer = AddStaffSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        with transaction.atomic():
            user = User.objects.create_user(
                username=data["username"],
                email=data.get("email", ""),
                password=data["password"],
                first_name=data["name"],
            )
            UserProfile.objects.update_or_create(
                user=user, defaults={"phone": data["phone"]}
            )
            staff_member = BusinessStaff.objects.create(
                business=business, user=user, role=data["role"]
            )
        return Response(
            BusinessStaffSerializer(staff_member).data,
            status=status.HTTP_201_CREATED,
        )


class StaffDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessOwner]

    def delete(self, request, business_id, pk):
        business = get_object_or_404(Business, pk=business_id)
        _require_owner(request.user, business)
        staff_member = get_object_or_404(BusinessStaff, pk=pk, business=business)
        staff_member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------

class CustomerListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def get(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        qs = business.customers.all()
        filter_param = request.query_params.get("filter")
        if filter_param == "debt":
            qs = business.customers_in_debt()
        else:
            qs = business.customers_with_balances()
        serializer = CustomerSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        serializer = CustomerSerializer(data=request.data, context={"business": business})
        if serializer.is_valid():
            serializer.save(business=business)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomerDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def _get(self, request, business_id, pk):
        business = _get_business_or_403(request.user, business_id)
        return business, get_object_or_404(business.customers_with_balances(), pk=pk)

    def get(self, request, business_id, pk):
        _, customer = self._get(request, business_id, pk)
        return Response(CustomerSerializer(customer).data)

    def put(self, request, business_id, pk):
        business, customer = self._get(request, business_id, pk)
        serializer = CustomerSerializer(
            customer, data=request.data, partial=True, context={"business": business}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, business_id, pk):
        _, customer = self._get(request, business_id, pk)
        customer.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Supplier
# ---------------------------------------------------------------------------

class SupplierListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def get(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        if request.query_params.get("filter") == "owed":
            qs = business.suppliers_owed()
        else:
            qs = business.suppliers_with_balances()
        return Response(SupplierSerializer(qs, many=True).data)

    def post(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        serializer = SupplierSerializer(data=request.data, context={"business": business})
        if serializer.is_valid():
            serializer.save(business=business)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SupplierDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def _get(self, request, business_id, pk):
        business = _get_business_or_403(request.user, business_id)
        return business, get_object_or_404(business.suppliers_with_balances(), pk=pk)

    def put(self, request, business_id, pk):
        business, supplier = self._get(request, business_id, pk)
        serializer = SupplierSerializer(
            supplier, data=request.data, partial=True, context={"business": business}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, business_id, pk):
        _, supplier = self._get(request, business_id, pk)
        supplier.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Brands / Categories
# ---------------------------------------------------------------------------

class BrandListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def get(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        return Response(BrandSerializer(business.brands.all(), many=True).data)

    def post(self, request, business_id):
        business = get_object_or_404(Business, pk=business_id)
        _require_owner(request.user, business)
        serializer = BrandSerializer(data=request.data, context={"business": business})
        if serializer.is_valid():
            serializer.save(business=business)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BrandDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessOwner]

    def delete(self, request, business_id, pk):
        business = get_object_or_404(Business, pk=business_id)
        _require_owner(request.user, business)
        brand = get_object_or_404(Brand, pk=pk, business=business)
        brand.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CategoryListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def get(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        return Response(CategorySerializer(business.categories.all(), many=True).data)

    def post(self, request, business_id):
        business = get_object_or_404(Business, pk=business_id)
        _require_owner(request.user, business)
        serializer = CategorySerializer(data=request.data, context={"business": business})
        if serializer.is_valid():
            serializer.save(business=business)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CategoryDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessOwner]

    def delete(self, request, business_id, pk):
        business = get_object_or_404(Business, pk=business_id)
        _require_owner(request.user, business)
        cat = get_object_or_404(Category, pk=pk, business=business)
        cat.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

class ProductListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def get(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        qs = business.products.select_related("brand", "category")
        brand_id = request.query_params.get("brand")
        category_id = request.query_params.get("category")
        if brand_id:
            qs = qs.filter(brand_id=brand_id)
        if category_id:
            qs = qs.filter(category_id=category_id)
        return Response(ProductSerializer(qs, many=True).data)

    def post(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        serializer = ProductSerializer(data=request.data, context={"business": business})
        if serializer.is_valid():
            product = serializer.save(business=business)
            if product.stock_quantity:
                StockMovement.objects.create(
                    product=product,
                    quantity_change=product.stock_quantity,
                    reason=StockMovement.RESTOCK,
                    note="Opening stock",
                )
            return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProductDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def _get_product(self, request, business_id, pk):
        business = _get_business_or_403(request.user, business_id)
        return business, get_object_or_404(
            Product.objects.select_related("brand", "category"),
            pk=pk,
            business=business,
        )

    def get(self, request, business_id, pk):
        _, product = self._get_product(request, business_id, pk)
        return Response(ProductSerializer(product).data)

    def put(self, request, business_id, pk):
        business, product = self._get_product(request, business_id, pk)
        serializer = ProductSerializer(
            product, data=request.data, partial=True, context={"business": business}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, business_id, pk):
        _, product = self._get_product(request, business_id, pk)
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RestockView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def post(self, request, business_id, pk):
        business = _get_business_or_403(request.user, business_id)
        product = get_object_or_404(Product, pk=pk, business=business)
        serializer = RestockSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        qty = serializer.validated_data["quantity"]
        note = serializer.validated_data.get("note", "")
        with transaction.atomic():
            Product.objects.filter(pk=product.pk).update(stock_quantity=F("stock_quantity") + qty)
            StockMovement.objects.create(
                product=product, quantity_change=qty,
                reason=StockMovement.RESTOCK, note=note,
            )
        product.refresh_from_db()
        return Response(ProductSerializer(product).data)


# ---------------------------------------------------------------------------
# Sales
# ---------------------------------------------------------------------------

class SaleListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def get(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        paginator = StandardPagination()
        qs = (
            business.sales.select_related("customer")
            .prefetch_related("items", "payments")
            .order_by("-created_at")
        )
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(SaleListSerializer(page, many=True).data)

    def post(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        serializer = RecordSaleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        parsed_items = {}
        for item in data["items"]:
            p_id = item["product_id"]
            parsed_items[p_id] = parsed_items.get(p_id, 0) + item["quantity"]

        with transaction.atomic():
            sorted_ids = sorted(parsed_items.keys())
            locked_products = list(
                Product.objects.select_for_update()
                .filter(pk__in=sorted_ids, business=business)
                .order_by("pk")
            )
            if len(locked_products) != len(sorted_ids):
                return Response(
                    {"detail": "One or more products not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            line_items = []
            for product in locked_products:
                qty = parsed_items[product.pk]
                if qty > product.stock_quantity:
                    return Response(
                        {"detail": f"Only {product.stock_quantity} units of '{product.name}' in stock."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                line_items.append((product, qty))

            total = sum(p.selling_price * q for p, q in line_items)
            amount_received = data["amount_received"]
            has_balance = amount_received < total

            if has_balance:
                customer_name = data.get("customer_name", "").strip()
                customer_phone = data.get("customer_phone", "").strip()
                if not customer_name or not customer_phone:
                    return Response(
                        {"detail": "Customer name and phone required when sale has an outstanding balance."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                try:
                    normalized_phone = normalize_phone(customer_phone)
                except ValidationError as e:
                    return Response({"detail": str(e.message)}, status=status.HTTP_400_BAD_REQUEST)

            sale = Sale.objects.create(business=business, recorded_by=request.user)
            for product, quantity in line_items:
                SaleItem.objects.create(
                    sale=sale, product=product, quantity=quantity,
                    unit_price=product.selling_price, unit_cost=product.cost_price,
                )

            if has_balance:
                customer, _ = Customer.objects.get_or_create(
                    business=business, phone=normalized_phone,
                    defaults={"name": customer_name},
                )
                sale.customer = customer
                sale.save(update_fields=["customer"])

            if amount_received > 0:
                Payment.objects.create(
                    business=business, sale=sale,
                    amount=amount_received, method=data["payment_method"],
                )

        return Response(
            SaleSerializer(
                Sale.objects.select_related("customer")
                .prefetch_related("items__product", "payments", "returns")
                .get(pk=sale.pk)
            ).data,
            status=status.HTTP_201_CREATED,
        )


class SaleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, sale_id):
        sale = get_object_or_404(
            Sale.objects.select_related("business", "customer")
            .prefetch_related("items__product", "payments", "returns__items__sale_item__product"),
            pk=sale_id,
        )
        if not sale.business.can_record_sales(request.user):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        return Response(SaleSerializer(sale).data)


class SaleReturnView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, sale_id):
        sale = get_object_or_404(
            Sale.objects.select_related("business").prefetch_related(
                "items__product", "items__return_items"
            ),
            pk=sale_id,
        )
        if not sale.business.can_record_sales(request.user):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        serializer = RecordSaleReturnSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        sale_items_by_id = {item.id: item for item in sale.items.all()}
        return_lines = []
        for line in data["return_items"]:
            sale_item_id = line.get("sale_item_id")
            qty = line.get("quantity", 0)
            if not sale_item_id or not qty:
                continue
            sale_item = sale_items_by_id.get(sale_item_id)
            if not sale_item:
                return Response(
                    {"detail": f"Sale item {sale_item_id} not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            remaining = sale_item.quantity - sale_item.returned_quantity
            if qty > remaining:
                return Response(
                    {"detail": f"Only {remaining} unit(s) of '{sale_item.product.name}' can be returned."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return_lines.append((sale_item, qty))

        if not return_lines:
            return Response({"detail": "No valid return items provided."}, status=400)

        with transaction.atomic():
            sale_return = SaleReturn.objects.create(
                sale=sale,
                discount=data.get("discount", Decimal("0")),
                refund_method=data.get("refund_method", ""),
                note=data.get("note", ""),
                processed_by=request.user,
            )
            for sale_item, quantity in return_lines:
                SaleReturnItem.objects.create(
                    sale_return=sale_return, sale_item=sale_item, quantity=quantity
                )

        return Response({"detail": "Return recorded.", "return_id": sale_return.id}, status=201)


class AddPaymentView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def post(self, request, business_id, target_type, target_id):
        business = _get_business_or_403(request.user, business_id)
        if target_type == "sale":
            target = get_object_or_404(
                Sale.objects.prefetch_related("items", "payments"),
                pk=target_id,
                business=business,
            )
            outstanding = target.balance
        elif target_type == "expense":
            target = get_object_or_404(
                Expense.objects.prefetch_related("payments"),
                pk=target_id,
                business=business,
            )
            outstanding = target.balance_owed
        elif target_type == "purchase":
            target = get_object_or_404(
                Purchase.objects.prefetch_related("items", "payments"),
                pk=target_id,
                business=business,
            )
            outstanding = target.balance
        else:
            return Response({"detail": "Unknown payment target."}, status=400)

        serializer = AddPaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data
        if data["amount"] > outstanding:
            return Response(
                {"detail": f"Amount exceeds outstanding balance of {outstanding}."},
                status=400,
            )
        payment = Payment(business=business, amount=data["amount"], method=data["method"])
        if data.get("reference"):
            payment.reference = data["reference"]
        setattr(payment, target_type, target)
        payment.save()
        return Response({"detail": "Payment recorded.", "payment_id": payment.id}, status=201)


# ---------------------------------------------------------------------------
# Purchases
# ---------------------------------------------------------------------------

class PurchaseListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def get(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        paginator = StandardPagination()
        qs = (
            business.purchases.select_related("supplier")
            .prefetch_related("items", "payments")
            .order_by("-created_at")
        )
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(PurchaseListSerializer(page, many=True).data)

    def post(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        serializer = RecordPurchaseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        supplier = None
        if data.get("supplier_id"):
            supplier = get_object_or_404(Supplier, pk=data["supplier_id"], business=business)

        line_items = []
        for line in data["items"]:
            product = get_object_or_404(Product, pk=line["product_id"], business=business)
            line_items.append((product, line["quantity"], line["unit_cost"]))

        with transaction.atomic():
            purchase_date = data.get("purchase_date") or date.today()
            purchase = Purchase.objects.create(
                business=business, supplier=supplier,
                invoice_no=data.get("invoice_no", ""),
                purchase_date=purchase_date,
                recorded_by=request.user,
            )
            for product, quantity, unit_cost in line_items:
                PurchaseItem.objects.create(
                    purchase=purchase, product=product,
                    quantity=quantity, unit_cost=unit_cost,
                )
            if data["amount_paid"] > 0:
                Payment.objects.create(
                    business=business, purchase=purchase,
                    amount=data["amount_paid"], method=data["payment_method"],
                )

        purchase_full = Purchase.objects.prefetch_related("items__product", "payments").get(pk=purchase.pk)
        return Response(PurchaseSerializer(purchase_full).data, status=201)


class PurchaseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, purchase_id):
        purchase = get_object_or_404(
            Purchase.objects.select_related("business", "supplier").prefetch_related("items__product", "payments"),
            pk=purchase_id,
        )
        if not purchase.business.can_record_sales(request.user):
            return Response({"detail": "Forbidden."}, status=403)
        return Response(PurchaseSerializer(purchase).data)


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------

class ExpenseListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def get(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        return Response(ExpenseSerializer(business.expenses.all(), many=True).data)

    def post(self, request, business_id):
        business = _get_business_or_403(request.user, business_id)
        serializer = ExpenseSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(business=business)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class ExpenseDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBusinessMember]

    def _get(self, request, business_id, pk):
        business = _get_business_or_403(request.user, business_id)
        return business, get_object_or_404(Expense, pk=pk, business=business)

    def put(self, request, business_id, pk):
        business, expense = self._get(request, business_id, pk)
        serializer = ExpenseSerializer(expense, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, business_id, pk):
        _, expense = self._get(request, business_id, pk)
        expense.delete()
        return Response(status=204)
