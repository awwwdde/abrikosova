from django.shortcuts import render
from django.shortcuts import render, get_object_or_404
from .models import Category, SubCategory, Product, CustomCake, Filling, CustomCakePageContent, AboutPageContent, \
    ContactPageContent, PopularProduct, Order, OrderItem
import json
from .forms import ConsultationForm
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.shortcuts import redirect
from .telegram_service import TelegramService
from django.contrib import messages
import random
import string


def home(request):
    # Получаем популярные товары (обновляются раз в 24 часа)
    popular_products = PopularProduct.objects.get_current_popular_products()

    # Отладочная информация
    print(f"Popular products count: {popular_products.count()}")
    for product in popular_products:
        print(f"Product: {product.name}")

    context = {
        'popular_products': popular_products,
    }
    return render(request, 'main/index.html', context)


def catalog(request):
    categories = Category.objects.filter(is_active=True).order_by('order')

    for category in categories:
        category.active_subcategories = category.subcategories.filter(is_active=True).order_by('order')

    # Получаем товары для отображения (первые 12 товаров)
    products = Product.objects.filter(
        is_active=True,
        is_available=True
    ).select_related('category', 'subcategory').prefetch_related('images').order_by('order')[:12]

    return render(request, 'main/catalog.html', {
        'categories': categories,
        'products': products
    })


def contacts(request):
    page_content = ContactPageContent.objects.first()

    if request.method == 'POST':
        form = ConsultationForm(request.POST)
        if form.is_valid():
            consultation = form.save()
            messages.success(request, 'Спасибо! Ваша заявка отправлена. Мы свяжемся с вами в ближайшее время.')
            return redirect('contacts')
    else:
        form = ConsultationForm()

    context = {
        'page_content': page_content,
        'form': form,
    }
    return render(request, 'main/contacts.html', context)


def subcategory_products(request, subcategory_id):
    subcategory = get_object_or_404(SubCategory, id=subcategory_id)
    products = Product.objects.filter(subcategory=subcategory, is_available=True)
    return render(request, 'main/subcategory_products.html', {
        'subcategory': subcategory,
        'products': products
    })


def products_by_subcategory(request, subcategory_id):
    subcategory = get_object_or_404(SubCategory, id=subcategory_id, is_active=True)

    # Получаем все товары выбранной подкатегории
    products = Product.objects.filter(
        subcategory=subcategory,
        is_active=True,
        is_available=True
    ).select_related('category', 'subcategory').prefetch_related('images').order_by('order')

    categories = Category.objects.filter(is_active=True).order_by('order')
    for category in categories:
        category.active_subcategories = category.subcategories.filter(is_active=True).order_by('order')

    return render(request, 'main/catalog.html', {
        'categories': categories,
        'products': products,
        'current_subcategory': subcategory
    })


def product_detail(request, product_slug):
    product = get_object_or_404(
        Product,
        slug=product_slug,
        is_active=True
    )

    # Получаем все изображения товара
    images = product.images.all().order_by('-is_main', 'order')

    # Получаем похожие товары из той же подкатегории
    related_products = Product.objects.filter(
        subcategory=product.subcategory,
        is_active=True,
        is_available=True
    ).exclude(id=product.id).select_related('category', 'subcategory').prefetch_related('images')[:4]

    # Получаем начинки, если товар относится к тортам
    fillings = None
    cake_subcategories = ['торт', 'cake', 'торты']  # Добавляем ключевые слова

    # Проверяем по названию подкатегории и товара
    if (product.subcategory and
        any(keyword in product.subcategory.name.lower() for keyword in cake_subcategories)) or \
            any(keyword in product.name.lower() for keyword in cake_subcategories):
        fillings = Filling.objects.filter(is_available=True).order_by('order')

    return render(request, 'main/product_detail.html', {
        'product': product,
        'images': images,
        'related_products': related_products,
        'fillings': fillings
    })


def privacy_policy(request):
    return render(request, 'main/privacy_policy.html')


def custom_cakes(request):
    custom_cakes = CustomCake.objects.filter(is_active=True)
    fillings = Filling.objects.filter(is_available=True)
    page_content = CustomCakePageContent.objects.all()

    context = {
        'custom_cakes': custom_cakes,
        'fillings': fillings,
        'page_content': page_content,
    }
    return render(request, 'main/custom_cakes.html', context)


# Консультация
@csrf_exempt
@require_POST
def create_consultation_request(request):
    try:
        data = json.loads(request.body)
        form = ConsultationForm(data)

        if form.is_valid():
            consultation = form.save()
            return JsonResponse({
                'success': True,
                'message': 'Спасибо! Мы свяжемся с вами в ближайшее время.'
            })
        else:
            return JsonResponse({
                'success': False,
                'errors': form.errors
            })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': 'Произошла ошибка. Пожалуйста, попробуйте еще раз.'
        })


# О нас

def about(request):
    page_content = AboutPageContent.objects.first()
    context = {
        'page_content': page_content,
    }
    return render(request, 'main/about.html', context)


# Корзина

def get_cart_count(request):
    """Получает количество товаров в корзине"""
    cart = request.session.get('cart', {})
    total_count = sum(item['quantity'] for item in cart.values())
    return JsonResponse({'count': total_count})


def add_to_cart(request, product_id):
    """Добавляет товар в корзину"""
    try:
        product = Product.objects.get(id=product_id, is_active=True, is_available=True)

        # Получаем корзину из сессии
        cart = request.session.get('cart', {})

        # Добавляем товар в корзину
        if str(product_id) in cart:
            cart[str(product_id)]['quantity'] += 1
        else:
            cart[str(product_id)] = {
                'id': product.id,
                'name': product.name,
                'price': str(product.price),
                'image': product.get_main_image(),
                'quantity': 1,
                'slug': product.slug
            }

        # Сохраняем корзину в сессии
        request.session['cart'] = cart
        request.session.modified = True

        # Считаем общее количество
        total_count = sum(item['quantity'] for item in cart.values())

        return JsonResponse({
            'success': True,
            'message': 'Товар добавлен в корзину',
            'count': total_count
        })

    except Product.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Товар не найден'
        })


def remove_from_cart(request, product_id):
    """Удаляет товар из корзины"""
    cart = request.session.get('cart', {})

    if str(product_id) in cart:
        del cart[str(product_id)]
        request.session['cart'] = cart
        request.session.modified = True

    total_count = sum(item['quantity'] for item in cart.values())

    return JsonResponse({
        'success': True,
        'message': 'Товар удален из корзины',
        'count': total_count
    })


def update_cart_quantity(request, product_id):
    """Обновляет количество товара в корзине"""
    try:
        quantity = int(request.POST.get('quantity', 1))
        cart = request.session.get('cart', {})

        if str(product_id) in cart:
            if quantity <= 0:
                del cart[str(product_id)]
            else:
                cart[str(product_id)]['quantity'] = quantity

            request.session['cart'] = cart
            request.session.modified = True

        total_count = sum(item['quantity'] for item in cart.values())

        return JsonResponse({
            'success': True,
            'count': total_count
        })

    except ValueError:
        return JsonResponse({
            'success': False,
            'message': 'Неверное количество'
        })


def get_cart_items(request):
    """Получает все товары из корзины"""
    cart = request.session.get('cart', {})
    return JsonResponse({'cart': cart})


def cart_view(request):
    """Отображение страницы корзины"""
    cart = request.session.get('cart', {})
    cart_items = []
    total_price = 0

    for item in cart.values():
        try:
            product = Product.objects.get(id=item['id'])
            item_total = float(item['price']) * item['quantity']
            cart_items.append({
                'product': product,
                'quantity': item['quantity'],
                'total_price': item_total,
                'cart_data': item
            })
            total_price += item_total
        except Product.DoesNotExist:
            # Если товар не найден, удаляем его из корзины
            if str(item['id']) in cart:
                del cart[str(item['id'])]
                request.session['cart'] = cart
                request.session.modified = True

    context = {
        'cart_items': cart_items,
        'total_price': total_price,
        'cart_empty': len(cart_items) == 0
    }
    return render(request, 'main/cart.html', context)


@require_POST
def clear_cart(request):
    """Полностью очищает корзину"""
    request.session['cart'] = {}
    request.session.modified = True

    return JsonResponse({
        'success': True,
        'message': 'Корзина очищена'
    })


# оформление заказа

def checkout(request):
    """Страница оформления заказа"""
    cart = request.session.get('cart', {})
    cart_items = []
    total_price = 0

    for item in cart.values():
        try:
            product = Product.objects.get(id=item['id'])
            item_total = float(item['price']) * item['quantity']
            cart_items.append({
                'product': product,
                'quantity': item['quantity'],
                'total_price': item_total,
                'cart_data': item
            })
            total_price += item_total
        except Product.DoesNotExist:
            continue

    # Генерируем номер заказа
    order_number = generate_order_number()

    if request.method == 'POST':
        # Получаем данные из формы
        name = request.POST.get('name', '').strip()
        phone = request.POST.get('phone', '').strip()
        comment = request.POST.get('comment', '').strip()
        delivery_method = request.POST.get('delivery', 'pickup')

        # Валидация
        if not name or not phone:
            messages.error(request, 'Пожалуйста, заполните все обязательные поля')
            return redirect('checkout')

        try:
            # Создаем заказ
            order = Order.objects.create(
                order_number=order_number,
                customer_name=name,
                customer_phone=phone,
                customer_comment=comment,
                delivery_method=delivery_method,
                total_price=total_price
            )

            # Создаем элементы заказа
            for item in cart_items:
                product_price = item['product'].price
                if product_price is None:
                    product_price = 0

                OrderItem.objects.create(
                    order=order,
                    product=item['product'],
                    quantity=item['quantity'],
                    price=product_price
                )

            # Отправляем уведомление в Telegram
            telegram_service = TelegramService()
            telegram_message = telegram_service.format_order_message(order)
            telegram_service.send_message(telegram_message)

            # Очищаем корзину
            request.session['cart'] = {}
            request.session.modified = True

            # Возвращаем JSON ответ для AJAX запроса
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': True,
                    'order_number': order_number,
                    'redirect_url': '/'
                })

            messages.success(request, f'Заказ #{order_number} успешно оформлен! Мы свяжемся с вами в ближайшее время.')
            return redirect('order_success', order_number=order_number)

        except Exception as e:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'message': f'Произошла ошибка при оформлении заказа: {str(e)}'
                })

            messages.error(request, f'Произошла ошибка при оформлении заказа: {str(e)}')
            return redirect('checkout')

    context = {
        'cart_items': cart_items,
        'total_price': total_price,
        'order_number': order_number,
        'cart_empty': len(cart_items) == 0
    }
    return render(request, 'main/checkout.html', context)


def generate_order_number():
    """Генерирует уникальный номер заказа"""
    while True:
        number = ''.join(random.choices(string.digits, k=8))
        if not Order.objects.filter(order_number=number).exists():
            return number


def order_success(request, order_number):
    """Страница успешного оформления заказа"""
    try:
        order = Order.objects.get(order_number=order_number)
    except Order.DoesNotExist:
        messages.error(request, 'Заказ не найден')
        return redirect('catalog')

    context = {
        'order': order
    }
    return render(request, 'main/order_success.html', context)
