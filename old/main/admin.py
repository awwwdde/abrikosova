from django.contrib import admin
from django.utils.html import format_html
from .models import Category, SubCategory, Product, ProductImage, CustomCakePageContent, Filling, ConsultationRequest, \
    ContactPageContent, PopularProduct, Order, OrderItem


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ['image', 'is_main', 'order']
    readonly_fields = ['image_preview']

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="100" height="100" style="object-fit: cover;" />', obj.image.url)
        return "Нет изображения"

    image_preview.short_description = 'Предпросмотр'


class SubCategoryInline(admin.TabularInline):
    model = SubCategory
    extra = 1
    ordering = ['order']


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'order', 'is_active', 'subcategories_count']
    list_editable = ['order', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name']
    inlines = [SubCategoryInline]

    def subcategories_count(self, obj):
        return obj.subcategories.count()

    subcategories_count.short_description = 'Кол-во подкатегорий'


@admin.register(SubCategory)
class SubCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'order', 'is_active']
    list_editable = ['order', 'is_active']
    list_filter = ['category', 'is_active']
    search_fields = ['name', 'category__name']
    ordering = ['category__order', 'order']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'subcategory', 'price', 'is_available', 'is_active', 'image_preview']
    list_editable = ['price', 'is_available', 'is_active']
    list_filter = ['category', 'subcategory', 'is_available', 'is_active']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ProductImageInline]
    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'slug', 'category', 'subcategory')
        }),
        ('Цена и наличие', {
            'fields': ('price', 'is_available', 'weight')
        }),
        ('Описание', {
            'fields': ('description', 'composition')
        }),
        ('Служебные поля', {
            'fields': ('order', 'is_active')
        }),
    )

    def image_preview(self, obj):
        main_image = obj.get_main_image()
        if main_image:
            return format_html('<img src="{}" width="50" height="50" style="object-fit: cover;" />', main_image)
        return "Нет изображения"

    image_preview.short_description = 'Изображение'


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ['product', 'image_preview', 'is_main', 'order']
    list_editable = ['is_main', 'order']
    list_filter = ['product__category', 'is_main']

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="80" height="80" style="object-fit: cover;" />', obj.image.url)
        return "Нет изображения"

    image_preview.short_description = 'Предпросмотр'


@admin.register(Filling)
class FillingAdmin(admin.ModelAdmin):
    list_display = ['name', 'price_per_kg', 'is_available', 'order']
    list_editable = ['price_per_kg', 'is_available', 'order']
    list_filter = ['is_available']
    search_fields = ['name']


@admin.register(CustomCakePageContent)
class CustomCakePageContentAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not CustomCakePageContent.objects.exists()


# Консультация
@admin.register(ConsultationRequest)
class ConsultationRequestAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    list_editable = ['status']
    search_fields = ['name', 'phone']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('Информация о клиенте', {
            'fields': ('name', 'phone', 'description')
        }),
        ('Статус заявки', {
            'fields': ('status', 'created_at', 'updated_at')
        }),
    )


# О нас

@admin.register(ContactPageContent)
class ContactPageContentAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not ContactPageContent.objects.exists()


# модель для управления популярными товарами
@admin.register(PopularProduct)
class PopularProductAdmin(admin.ModelAdmin):
    list_display = ['last_updated', 'is_active', 'products_count']
    list_editable = ['is_active']
    readonly_fields = ['last_updated']
    filter_horizontal = ['products']

    def products_count(self, obj):
        return obj.products.count()

    products_count.short_description = 'Количество товаров'

    def has_add_permission(self, request):
        return not PopularProduct.objects.exists()


# Оформление заказа

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['get_total_price']

    def get_total_price(self, obj):
        return obj.get_total_price()

    get_total_price.short_description = 'Общая цена'


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'customer_name', 'customer_phone', 'total_price', 'status', 'created_at']
    list_filter = ['status', 'created_at', 'delivery_method']
    list_editable = ['status']
    search_fields = ['order_number', 'customer_name', 'customer_phone']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'product', 'quantity', 'price', 'get_total_price']
    list_filter = ['order__status']


