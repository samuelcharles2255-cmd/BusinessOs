"""
api/permissions.py — DRF permission classes mirroring Django view guards.
"""
from rest_framework.permissions import BasePermission, IsAuthenticated
from django.shortcuts import get_object_or_404
from BusinessOs.models import Business


class IsBusinessMember(BasePermission):
    """Owner or staff of the business (can record sales)."""
    message = "You are not authorized for this business."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        business_id = view.kwargs.get("business_id")
        if not business_id:
            return True
        try:
            business = Business.objects.get(pk=business_id)
        except Business.DoesNotExist:
            return False
        return business.can_record_sales(request.user)


class IsBusinessOwner(BasePermission):
    """Only the business owner."""
    message = "Only the business owner can perform this action."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        business_id = view.kwargs.get("business_id")
        if not business_id:
            return True
        try:
            business = Business.objects.get(pk=business_id)
        except Business.DoesNotExist:
            return False
        return business.owner_id == request.user.id
