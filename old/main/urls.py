from django.urls import path
from . import views


urlpatterns = [
    path('', views.home, name='home'),
    path('catalog/', views.catalog, name='catalog'),
    path('about/', views.about, name='about'),
    path('contacts/', views.contacts, name='contacts'),
    path('catalog/<int:subcategory_id>/', views.subcategory_products, name='subcategory_products'),
    path('catalog/subcategory/<int:subcategory_id>/', views.products_by_subcategory, name='products_by_subcategory'),
    path('product/<slug:product_slug>/', views.product_detail, name='product_detail'),
    path('privacy/', views.privacy_policy, name='privacy_policy'),
    path('custom-cakes/', views.custom_cakes, name='custom_cakes'),
    path('create-consultation/', views.create_consultation_request, name='create_consultation'),
    path('cart/add/<int:product_id>/', views.add_to_cart, name='add_to_cart'),
    path('cart/remove/<int:product_id>/', views.remove_from_cart, name='remove_from_cart'),
    path('cart/update/<int:product_id>/', views.update_cart_quantity, name='update_cart_quantity'),
    path('cart/count/', views.get_cart_count, name='get_cart_count'),
    path('cart/items/', views.get_cart_items, name='get_cart_items'),
    path('cart/', views.cart_view, name='cart_view'),
    path('checkout/', views.checkout, name='checkout'),
    path('order/success/<str:order_number>/', views.order_success, name='order_success'),
    path('cart/clear/', views.clear_cart, name='clear_cart'),

]