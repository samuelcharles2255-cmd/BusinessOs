from django.contrib.auth import views as auth_views
from django.urls import path

from . import views

urlpatterns = [
    # Home -- your businesses
    path("", views.BusinessListView.as_view(), name="business_list"),
    path("new/", views.BusinessCreateView.as_view(), name="business_create"),

    path("<int:business_id>/", views.BusinessDetailView.as_view(), name="business_detail"),
    path("<int:business_id>/edit/", views.BusinessUpdateView.as_view(), name="business_update"),
    path("<int:business_id>/dashboard/", views.business_dashboard, name="business_dashboard"),

    # --- People: staff / customers / suppliers, one nav grouping -------
    path("<int:business_id>/staff/", views.BusinessStaffListView.as_view(), name="staff_list"),
    path("<int:business_id>/staff/new/", views.add_staff, name="staff_create"),
    path("<int:business_id>/staff/<int:pk>/remove/", views.BusinessStaffDeleteView.as_view(), name="staff_delete"),

    path("<int:business_id>/customers/", views.CustomerListView.as_view(), name="customer_list"),
    path("<int:business_id>/customers/new/", views.CustomerCreateView.as_view(), name="customer_create"),
    path("<int:business_id>/customers/<int:pk>/edit/", views.CustomerUpdateView.as_view(), name="customer_update"),

    path("<int:business_id>/suppliers/", views.SupplierListView.as_view(), name="supplier_list"),
    path("<int:business_id>/suppliers/new/", views.SupplierCreateView.as_view(), name="supplier_create"),
    path("<int:business_id>/suppliers/<int:pk>/edit/", views.SupplierUpdateView.as_view(), name="supplier_update"),

    # --- Products: brand / category / product ---------------------------
    path("<int:business_id>/brands/", views.BrandListView.as_view(), name="brand_list"),
    path("<int:business_id>/brands/new/", views.BrandCreateView.as_view(), name="brand_create"),

    path("<int:business_id>/categories/", views.CategoryListView.as_view(), name="category_list"),
    path("<int:business_id>/categories/new/", views.CategoryCreateView.as_view(), name="category_create"),

    path("<int:business_id>/products/", views.ProductListView.as_view(), name="product_list"),
    path("<int:business_id>/products/new/", views.ProductCreateView.as_view(), name="product_create"),
    path("<int:business_id>/products/<int:pk>/edit/", views.ProductUpdateView.as_view(), name="product_update"),
    path("<int:business_id>/products/<int:product_id>/restock/", views.restock_product, name="restock_product"),

    # --- Sales + returns --------------------------------------------------
    path("<int:business_id>/sales/", views.SaleListView.as_view(), name="sale_list"),
    path("<int:business_id>/sales/new/", views.record_sale, name="record_sale"),
    path("sale/<int:sale_id>/", views.sale_detail, name="sale_detail"),
    path("sale/<int:sale_id>/return/", views.record_sale_return, name="record_sale_return"),

    # --- Purchases ----------------------------------------------------
    path("<int:business_id>/purchases/", views.PurchaseListView.as_view(), name="purchase_list"),
    path("<int:business_id>/purchases/new/", views.record_purchase, name="record_purchase"),
    path("purchase/<int:purchase_id>/", views.purchase_detail, name="purchase_detail"),

    # --- Payments (installments against sale / expense / purchase) -----
    path("<int:business_id>/pay/<str:target_type>/<int:target_id>/", views.add_payment, name="add_payment"),

    # --- Expenses -------------------------------------------------------
    path("<int:business_id>/expenses/", views.ExpenseListView.as_view(), name="expense_list"),
    path("<int:business_id>/expenses/new/", views.ExpenseCreateView.as_view(), name="expense_create"),
    path("<int:business_id>/expenses/<int:pk>/edit/", views.ExpenseUpdateView.as_view(), name="expense_update"),

    path("<int:business_id>/settings/", views.business_settings, name="business_settings"),
    path("<int:business_id>/delete/", views.BusinessDeleteView.as_view(), name="business_delete"),
    path("set-language/", views.set_language_preference, name="set_language"),

    # --- Auth -------------------------------------------------------------
    path("register/", views.register, name="register"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("login/", auth_views.LoginView.as_view(template_name="accounts/login.html"), name="login"),
    path("logout/", auth_views.LogoutView.as_view(next_page="login"), name="logout"),

    # --- Password Reset ---------------------------------------------------
    path(
        "password-reset/",
        auth_views.PasswordResetView.as_view(
            template_name="accounts/password_reset_form.html",
            email_template_name="accounts/password_reset_email.html",
            subject_template_name="accounts/password_reset_subject.txt",
        ),
        name="password_reset",
    ),
    path(
        "password-reset/done/",
        auth_views.PasswordResetDoneView.as_view(
            template_name="accounts/password_reset_done.html",
        ),
        name="password_reset_done",
    ),
    path(
        "reset/<uidb64>/<token>/",
        auth_views.PasswordResetConfirmView.as_view(
            template_name="accounts/password_reset_confirm.html",
        ),
        name="password_reset_confirm",
    ),
    path(
        "reset/done/",
        auth_views.PasswordResetCompleteView.as_view(
            template_name="accounts/password_reset_complete.html",
        ),
        name="password_reset_complete",
    ),
]