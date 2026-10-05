"""
URL configuration for BusinessSys project.
"""
import os
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path
from django.views.generic import RedirectView

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('django.contrib.auth.urls')),
    path('assistant/', include('ai.urls')),
    path('api/', include('api.urls')),
    # Root redirects to Next.js frontend if configured, or BusinessOs
    path('', include('BusinessOs.urls')),
]

urlpatterns += staticfiles_urlpatterns()
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)