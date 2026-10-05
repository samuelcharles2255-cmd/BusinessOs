"""
api/urls.py — URL patterns for the Biashara OS REST API.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # Auth
    path("auth/register/", views.RegisterView.as_view(), name="api_register"),
    path("auth/login/", views.LoginView.as_view(), name="api_login"),
    path("auth/logout/", views.LogoutView.as_view(), name="api_logout"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="api_token_refresh"),
    path("auth/me/", views.MeView.as_view(), name="api_me"),
    path("auth/password-reset/", views.PasswordResetView.as_view(), name="api_password_reset"),
    path("auth/password-reset/confirm/", views.PasswordResetConfirmView.as_view(), name="api_password_reset_confirm"),

    # Business
    path("businesses/", views.BusinessListCreateView.as_view(), name="api_business_list"),
    path("businesses/<int:business_id>/", views.BusinessDetailView.as_view(), name="api_business_detail"),
    path("businesses/<int:business_id>/dashboard/", views.DashboardView.as_view(), name="api_dashboard"),

    # Staff
    path("businesses/<int:business_id>/staff/", views.StaffListView.as_view(), name="api_staff_list"),
    path("businesses/<int:business_id>/staff/<int:pk>/", views.StaffDetailView.as_view(), name="api_staff_detail"),

    # Customers
    path("businesses/<int:business_id>/customers/", views.CustomerListCreateView.as_view(), name="api_customer_list"),
    path("businesses/<int:business_id>/customers/<int:pk>/", views.CustomerDetailView.as_view(), name="api_customer_detail"),

    # Suppliers
    path("businesses/<int:business_id>/suppliers/", views.SupplierListCreateView.as_view(), name="api_supplier_list"),
    path("businesses/<int:business_id>/suppliers/<int:pk>/", views.SupplierDetailView.as_view(), name="api_supplier_detail"),

    # Brands
    path("businesses/<int:business_id>/brands/", views.BrandListCreateView.as_view(), name="api_brand_list"),
    path("businesses/<int:business_id>/brands/<int:pk>/", views.BrandDetailView.as_view(), name="api_brand_detail"),

    # Categories
    path("businesses/<int:business_id>/categories/", views.CategoryListCreateView.as_view(), name="api_category_list"),
    path("businesses/<int:business_id>/categories/<int:pk>/", views.CategoryDetailView.as_view(), name="api_category_detail"),

    # Products
    path("businesses/<int:business_id>/products/", views.ProductListCreateView.as_view(), name="api_product_list"),
    path("businesses/<int:business_id>/products/<int:pk>/", views.ProductDetailView.as_view(), name="api_product_detail"),
    path("businesses/<int:business_id>/products/<int:pk>/restock/", views.RestockView.as_view(), name="api_restock"),

    # Sales
    path("businesses/<int:business_id>/sales/", views.SaleListCreateView.as_view(), name="api_sale_list"),
    path("sales/<int:sale_id>/", views.SaleDetailView.as_view(), name="api_sale_detail"),
    path("sales/<int:sale_id>/return/", views.SaleReturnView.as_view(), name="api_sale_return"),

    # Purchases
    path("businesses/<int:business_id>/purchases/", views.PurchaseListCreateView.as_view(), name="api_purchase_list"),
    path("purchases/<int:purchase_id>/", views.PurchaseDetailView.as_view(), name="api_purchase_detail"),

    # Expenses
    path("businesses/<int:business_id>/expenses/", views.ExpenseListCreateView.as_view(), name="api_expense_list"),
    path("businesses/<int:business_id>/expenses/<int:pk>/", views.ExpenseDetailView.as_view(), name="api_expense_detail"),

    # Payments
    path("businesses/<int:business_id>/pay/<str:target_type>/<int:target_id>/", views.AddPaymentView.as_view(), name="api_add_payment"),
]

# Support API endpoints both with and without trailing slash
_extra_patterns = []
for p in urlpatterns:
    if hasattr(p, "pattern"):
        pat = str(p.pattern)
        if pat.endswith("/"):
            _extra_patterns.append(
                path(pat[:-1], p.callback, name=f"{p.name}_noslash" if p.name else None)
            )
urlpatterns += _extra_patterns

