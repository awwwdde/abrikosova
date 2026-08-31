// Функция для обновления счетчика корзины
function updateCartCount() {
    fetch('/cart/count/')
        .then(response => response.json())
        .then(data => {
            const cartCount = document.getElementById('cartCount');
            if (cartCount) {
                cartCount.textContent = data.count;

                // Показываем/скрываем иконку в зависимости от наличия товаров
                const cartIcon = document.getElementById('cartIcon');
                if (cartIcon) {
                    if (data.count > 0) {
                        cartIcon.style.display = 'flex';
                    } else {
                        cartIcon.style.display = 'none';
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error updating cart count:', error);
        });
}
// Функция для обновления состояния кнопки корзины
function updateCartButtonState(productId, isInCart) {
    const button = document.querySelector(`[data-product-id="${productId}"] .cart-btn`);
    if (button) {
        if (isInCart) {
            button.classList.add('in-cart');
            button.textContent = 'В корзине';
        } else {
            button.classList.remove('in-cart');
            button.textContent = 'В корзину';
        }
    }
}
// Функция для проверки наличия товара в корзине
function isProductInCart(productId) {
    const cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
    return cartItems.includes(productId);
}

// Функция для добавления в корзину
function addToCart(productId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    fetch(`/cart/add/${productId}/`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Обновляем счетчик
                updateCartCount();

                // Анимация иконки
                const cartIcon = document.getElementById('cartIcon');
                if (cartIcon) {
                    cartIcon.classList.add('cart-bounce');
                    setTimeout(() => {
                        cartIcon.classList.remove('cart-bounce');
                    }, 600);
                }

                // Обновляем внешний вид кнопки
                updateCartButtonState(productId, true);

                // Сохраняем в localStorage
                let cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
                if (!cartItems.includes(productId)) {
                    cartItems.push(productId);
                    localStorage.setItem('cartItems', JSON.stringify(cartItems));
                }

                // Показываем уведомление
                showCartNotification('Товар добавлен в корзину');
            } else {
                showCartNotification(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error adding to cart:', error);
            showCartNotification('Ошибка при добавлении в корзину', 'error');
        });
}

// Функция для удаления из корзины
function removeFromCart(productId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    fetch(`/cart/remove/${productId}/`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Обновляем счетчик
                updateCartCount();

                // Обновляем внешний вид кнопки
                updateCartButtonState(productId, false);

                // Удаляем из localStorage
                let cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
                cartItems = cartItems.filter(id => id !== productId);
                localStorage.setItem('cartItems', JSON.stringify(cartItems));

                // Показываем уведомление
                showCartNotification('Товар удален из корзины');
            } else {
                showCartNotification(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error removing from cart:', error);
            showCartNotification('Ошибка при удалении из корзины', 'error');
        });
}

// Универсальная функция переключения состояния корзины
function toggleCart(productId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    if (isProductInCart(productId)) {
        removeFromCart(productId, event);
    } else {
        addToCart(productId, event);
    }
}

// Функция для показа уведомлений
function showCartNotification(message, type = 'success') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `cart-notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
    `;

    // Стили для уведомления
    notification.style.cssText = `
        position: fixed;
        top: 200px;
        right: 30px;
        background: ${type === 'success' ? '#2ecc71' : type === 'info' ? '#3498db' : '#e74c3c'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1001;
        font-family: 'Montserrat', sans-serif;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Восстанавливаем состояние кнопок при загрузке страницы
function restoreCartButtons() {
    const cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];

    // Обновляем все кнопки на странице
    document.querySelectorAll('.cart-btn').forEach(button => {
        const productCard = button.closest('[data-product-id]');
        if (productCard) {
            const productId = parseInt(productCard.dataset.productId);
            const isInCart = cartItems.includes(productId);
            updateCartButtonState(productId, isInCart);
        }
    });
}
// Функция для синхронизации с сервером (на случай расхождений)
function syncCartWithServer() {
    fetch('/cart/items/')
        .then(response => response.json())
        .then(data => {
            const serverCartItems = Object.keys(data.cart || {}).map(id => parseInt(id));
            localStorage.setItem('cartItems', JSON.stringify(serverCartItems));
            restoreCartButtons();
        })
        .catch(error => {
            console.error('Error syncing cart with server:', error);
        });
}

// Функция для перехода в корзину
function goToCart() {
    window.location.href = '/cart/';
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    updateCartCount();
    syncCartWithServer(); // Синхронизируем с сервером при загрузке
    delPatterns();

    // Дополнительная проверка через 1 секунду на случай рассинхронизации
    setTimeout(() => {
        restoreCartButtons();
    }, 1000);

    // Обработчик клика по иконке корзины
    const cartIcon = document.getElementById('cartIcon');
    if (cartIcon) {
        cartIcon.addEventListener('click', function() {
            goToCart();
        });
    }
});

// Добавляем стили для анимаций
const cartStyles = document.createElement('style');
cartStyles.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    @keyframes bounce {
        0%, 20%, 60%, 100% {
            transform: translateY(0);
        }
        40% {
            transform: translateY(-10px);
        }
        80% {
            transform: translateY(-5px);
        }
    }

    .cart-bounce {
        animation: bounce 0.6s ease;
    }
`;
document.head.appendChild(cartStyles);

// Добавляем функцию для перехода в корзину
function goToCart() {
    window.location.href = '/cart/';
}

// Обновляем обработчик клика по иконке корзины
document.addEventListener('DOMContentLoaded', function() {
    updateCartCount();
    restoreCartButtons();

    const cartIcon = document.getElementById('cartIcon');
    if (cartIcon) {
        cartIcon.addEventListener('click', function() {
            goToCart();
        });
    }
});

//  Функция для полной очистки корзины
function clearCart() {
    // Очищаем корзину на сервере
    fetch('/cart/clear/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Очищаем localStorage
            localStorage.removeItem('cartItems');

            // Обновляем счетчик
            updateCartCount();

            // Обновляем все кнопки корзины
            document.querySelectorAll('.cart-btn, .add-to-cart-btn-detail').forEach(button => {
                button.classList.remove('in-cart');
                button.textContent = 'В корзину';
            });

            // Перенаправляем на главную страницу
            window.location.href = '/';
        }
    })
    .catch(error => {
        console.error('Error clearing cart:', error);
        // В случае ошибки все равно очищаем localStorage и перенаправляем
        localStorage.removeItem('cartItems');
        window.location.href = '/';
    });
}
