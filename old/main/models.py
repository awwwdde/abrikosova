from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone


class Category(models.Model):
    name = models.CharField(max_length=100, verbose_name='Название категории')
    order = models.IntegerField(default=0, verbose_name='Порядок отображения')
    is_active = models.BooleanField(default=True, verbose_name='Активна')

    class Meta:
        verbose_name = 'Категория'
        verbose_name_plural = 'Категории'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class SubCategory(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='subcategories',
                                 verbose_name='Категория')
    name = models.CharField(max_length=100, verbose_name='Название подкатегории')
    order = models.IntegerField(default=0, verbose_name='Порядок отображения')
    is_active = models.BooleanField(default=True, verbose_name='Активна')

    class Meta:
        verbose_name = 'Подкатегория'
        verbose_name_plural = 'Подкатегории'
        ordering = ['category__order', 'order', 'name']

    def __str__(self):
        return f"{self.category.name} - {self.name}"


class Product(models.Model):
    # Основная информация
    name = models.CharField(max_length=200, verbose_name='Название товара')
    slug = models.SlugField(max_length=200, unique=True, verbose_name='URL')

    # Категории
    category = models.ForeignKey(Category, on_delete=models.CASCADE, verbose_name='Категория')
    subcategory = models.ForeignKey(SubCategory, on_delete=models.CASCADE, verbose_name='Подкатегория')

    # Цена и наличие
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Цена',
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    is_available = models.BooleanField(default=True, verbose_name='В наличии')

    # Описание
    description = models.TextField(verbose_name='Описание товара')
    composition = models.TextField(verbose_name='Состав', help_text='Перечислите ингредиенты через запятую')
    weight = models.CharField(max_length=50, blank=True, verbose_name='Вес/Размер',
                              help_text='Например: 1 кг, 500 г, 6 шт')

    # Служебные поля
    order = models.IntegerField(default=0, verbose_name='Порядок отображения')
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')

    class Meta:
        verbose_name = 'Товар'
        verbose_name_plural = 'Товары'
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['is_active', 'is_available']),
            models.Index(fields=['category', 'subcategory']),
        ]

    def __str__(self):
        return self.name

    def get_main_image(self):
        """Возвращает главное изображение товара"""
        main_image = self.images.filter(is_main=True).first()
        if main_image and main_image.image:
            return main_image.image.url
        return None

    def get_main_image_url(self):
        """Альтернативный метод с проверкой"""
        try:
            main_image = self.images.filter(is_main=True).first()
            if main_image and main_image.image:
                return main_image.image.url
        except:
            pass
        return None


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images', verbose_name='Товар')
    image = models.ImageField(upload_to='products/%Y/%m/%d/', verbose_name='Изображение')
    is_main = models.BooleanField(default=False, verbose_name='Главное изображение')
    order = models.IntegerField(default=0, verbose_name='Порядок отображения')

    class Meta:
        verbose_name = 'Изображение товара'
        verbose_name_plural = 'Изображения товаров'
        ordering = ['-is_main', 'order']

    def __str__(self):
        return f"Изображение для {self.product.name}"

    def save(self, *args, **kwargs):
        # Если это главное изображение, снимаем флаг с других изображений этого товара
        if self.is_main:
            ProductImage.objects.filter(product=self.product, is_main=True).update(is_main=False)
        super().save(*args, **kwargs)


class CustomCake(models.Model):
    title = models.CharField(max_length=200, verbose_name="Название торта")
    description = models.TextField(verbose_name="Описание")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Цена от")
    image = models.ImageField(upload_to='custom_cakes/', verbose_name="Изображение")
    is_active = models.BooleanField(default=True, verbose_name="Активный")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок отображения")

    class Meta:
        verbose_name = "Торт по индивидуальному заказу"
        verbose_name_plural = "Торты по индивидуальному заказу"
        ordering = ['order', 'title']

    def __str__(self):
        return self.title


class Filling(models.Model):
    name = models.CharField(max_length=100, verbose_name="Название начинки")
    description = models.TextField(verbose_name="Описание")
    image = models.ImageField(upload_to='fillings/', verbose_name="Изображение")
    price_per_kg = models.DecimalField(max_digits=8, decimal_places=2, verbose_name="Цена за кг")
    is_available = models.BooleanField(default=True, verbose_name="Доступна")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок")

    class Meta:
        verbose_name = "Начинка"
        verbose_name_plural = "Начинки"
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class CustomCakePageContent(models.Model):
    title = models.CharField(max_length=200, verbose_name="Заголовок страницы")
    subtitle = models.TextField(verbose_name="Подзаголовок")
    hero_image = models.ImageField(upload_to='custom_cakes_page/', verbose_name="Главное изображение")
    process_title = models.CharField(max_length=200, verbose_name="Заголовок процесса")
    process_description = models.TextField(verbose_name="Описание процесса")
    consultation_text = models.TextField(verbose_name="Текст для консультации")

    class Meta:
        verbose_name = "Контент страницы тортов на заказ"
        verbose_name_plural = "Контент страницы тортов на заказ"

    def __str__(self):
        return "Контент страницы тортов на заказ"


# Консультация
class ConsultationRequest(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новая'),
        ('contacted', 'Связались'),
        ('completed', 'Завершена'),
    ]

    name = models.CharField(max_length=200, verbose_name="Имя")
    phone = models.CharField(max_length=20, verbose_name="Телефон")
    description = models.TextField(verbose_name="Описание торта", blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        verbose_name="Статус"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        verbose_name = "Заявка на консультацию"
        verbose_name_plural = "Заявки на консультацию"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.phone} ({self.created_at.strftime('%d.%m.%Y')})"


# О нас

class AboutPageContent(models.Model):
    title = models.CharField(max_length=200, verbose_name="Заголовок страницы", default="О нас")
    main_text = models.TextField(verbose_name="Основной текст")
    image = models.ImageField(upload_to='about/', verbose_name="Основное изображение")
    values_title = models.CharField(max_length=200, verbose_name="Заголовок ценностей", default="Наши ценности")

    class Meta:
        verbose_name = "Контент страницы О нас"
        verbose_name_plural = "Контент страницы О нас"

    def __str__(self):
        return "Контент страницы О нас"


# Контакты

class ContactPageContent(models.Model):
    title = models.CharField(max_length=200, verbose_name="Заголовок страницы", default="Контакты")
    address = models.TextField(verbose_name="Адрес",
                               default="г. Москва\nул. Гжатская 5, корпус 8\nКондитерская Елены Абрикосовой")
    phone = models.CharField(max_length=20, verbose_name="Телефон", default="8-962-352-22-77")
    work_days_weekdays = models.CharField(max_length=100, verbose_name="Рабочие дни пн-пт", default="пн-пт 08:00-20:00")
    work_days_weekend = models.CharField(max_length=100, verbose_name="Рабочие дни сб, вс",
                                         default="сб, вс 09:00-20:00")
    delivery_hours = models.CharField(max_length=100, verbose_name="Доставка", default="доставка: 09:00 - 21:00")
    map_embed_code = models.TextField(verbose_name="Код карты", blank=True, help_text="HTML код для вставки карты")

    class Meta:
        verbose_name = "Контент страницы контактов"
        verbose_name_plural = "Контент страницы контактов"

    def __str__(self):
        return "Контент страницы контактов"


# модель для управления популярными товарами
class PopularProductManager(models.Manager):
    def get_current_popular_products(self):
        """Получает актуальные популярные товары (обновляются раз в 24 часа)"""
        from django.utils import timezone
        from datetime import timedelta
        from random import sample

        # Проверяем, есть ли сохраненные популярные товары и не устарели ли они
        popular_products_record = PopularProduct.objects.filter(
            is_active=True
        ).first()

        if popular_products_record and popular_products_record.last_updated >= timezone.now() - timedelta(hours=24):
            return popular_products_record.products.all()[:8]
        else:
            # Генерируем новые популярные товары
            return self._generate_popular_products()

    def _generate_popular_products(self):
        """Генерирует новые популярные товары"""
        from random import sample

        # Получаем доступные товары
        available_products = Product.objects.filter(
            is_active=True,
            is_available=True
        )[:20]

        if not available_products:
            return Product.objects.none()

        # Выбираем случайные 8 товаров
        popular_products_list = list(available_products)
        selected_products = sample(popular_products_list, min(8, len(popular_products_list)))

        # Создаем или обновляем запись популярных товаров
        popular_record = PopularProduct.objects.filter(is_active=True).first()
        if not popular_record:
            popular_record = PopularProduct.objects.create(is_active=True)

        popular_record.products.set(selected_products)
        popular_record.save()

        return selected_products


class PopularProduct(models.Model):
    products = models.ManyToManyField(Product, verbose_name="Популярные товары")
    last_updated = models.DateTimeField(auto_now=True, verbose_name="Последнее обновление")
    is_active = models.BooleanField(default=True, verbose_name="Активно")

    objects = PopularProductManager()

    class Meta:
        verbose_name = "Популярные товары"
        verbose_name_plural = "Популярные товары"

    def __str__(self):
        return f"Популярные товары ({self.last_updated.strftime('%d.%m.%Y %H:%M')})"


# Оформление заказа

class Order(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новый'),
        ('confirmed', 'Подтвержден'),
        ('in_progress', 'В работе'),
        ('ready', 'Готов'),
        ('completed', 'Завершен'),
        ('cancelled', 'Отменен'),
    ]

    order_number = models.CharField(max_length=20, unique=True, verbose_name="Номер заказа")
    customer_name = models.CharField(max_length=200, verbose_name="Имя клиента")
    customer_phone = models.CharField(max_length=20, verbose_name="Телефон клиента")
    customer_comment = models.TextField(blank=True, verbose_name="Комментарий клиента")
    delivery_method = models.CharField(max_length=20, default='pickup', verbose_name="Способ получения")

    total_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Общая сумма")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new', verbose_name="Статус")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Дата обновления")

    class Meta:
        verbose_name = "Заказ"
        verbose_name_plural = "Заказы"
        ordering = ['-created_at']

    def __str__(self):
        return f"Заказ #{self.order_number} - {self.customer_name}"

    def get_delivery_method_display(self):
        """Безопасное получение отображаемого значения способа доставки"""
        delivery_methods = {
            'pickup': 'Самовывоз',
            'delivery': 'Доставка'
        }
        return delivery_methods.get(self.delivery_method, self.delivery_method)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items', verbose_name="Заказ")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name="Товар")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Количество")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Цена")

    class Meta:
        verbose_name = "Элемент заказа"
        verbose_name_plural = "Элементы заказа"

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"

    def get_total_price(self):
        """Безопасный расчет общей цены"""
        if self.price is not None:
            return self.quantity * self.price
        return 0