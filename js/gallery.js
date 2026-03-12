(function () {
    'use strict';

    /* ========================================
       CONFIGURATION
       ======================================== */

    const GALLERY_CONFIG = {
        // Сколько "экранов" изображений загружать за раз
        batchSize: 3,
        // Порог прокрутки для подгрузки новых элементов (px от края)
        loadThreshold: 500,
        // Через сколько мс скрыть подсказку после первого скролла
        hintHideDelay: 300,
        // Максимальное количество элементов в DOM (для производительности)
        maxDomElements: 60,
        // Дебаунс скролла (мс)
        scrollDebounce: 100,
    };

    /* ========================================
       DOM ELEMENTS
       ======================================== */

    const galleryPage = document.querySelector('.gallery-page');

    // Если нет галереи на странице — выходим
    if (!galleryPage) return;

    const feed = galleryPage.querySelector('.gallery-feed');
    const hint = galleryPage.querySelector('.gallery-hint');
    const progressContainer = galleryPage.querySelector('.gallery-progress');
    const sidebar = galleryPage.querySelector('.gallery-sidebar');

    /* ========================================
       STATE
       ======================================== */

    let imagePaths = [];
    let totalOriginalImages = 0;
    let currentItemIndex = 0;
    let totalItemsInDom = 0;
    let isLoadingMore = false;
    let hasScrolled = false;
    let likedItems = new Set();

    // Счётчик для уникальных ID элементов
    let itemIdCounter = 0;

    /* ========================================
       INITIALIZATION
       ======================================== */

    function init() {
        imagePaths = getAllImagePaths();

        if (imagePaths.length === 0) {
            showEmptyState();
            return;
        }

        totalOriginalImages = imagePaths.length;

        // Создаём начальные элементы
        appendItems(totalOriginalImages * GALLERY_CONFIG.batchSize);

        // Создаём прогресс-точки
        createProgressDots();

        // Обновляем счётчик и прогресс
        updateCurrentItem();

        // Привязываем события
        bindEvents();

        // Предзагрузка первых изображений
        preloadVisibleImages();
    }

    /* ========================================
       CREATE GALLERY ITEMS
       ======================================== */

    /**
     * Показывает заглушку если нет изображений
     */
    function showEmptyState() {
        feed.innerHTML =
            '<div class="gallery-item" style="justify-content:center;flex-direction:column;gap:16px;">' +
            '<span style="font-size:4rem;">🙈</span>' +
            '<p style="color:rgba(255,255,255,0.5);font-size:1.2rem;">Мемы пока не загружены</p>' +
            '<p style="color:rgba(255,255,255,0.3);font-size:0.9rem;">Добавьте изображения в папку memes/</p>' +
            '</div>';
    }

    /**
     * Создаёт DOM-элемент одного мема
     * @param {string} imagePath — путь к изображению
     * @param {number} originalIndex — индекс в оригинальном массиве (0-based)
     * @returns {HTMLElement}
     */
    function createGalleryItem(imagePath, originalIndex) {
        var itemId = itemIdCounter++;

        var item = document.createElement('div');
        item.className = 'gallery-item';
        item.dataset.id = itemId;
        item.dataset.originalIndex = originalIndex;
        item.dataset.imagePath = imagePath;

        // Изображение
        var img = document.createElement('img');
        img.className = 'gallery-item__image';
        img.alt = 'Мем #' + (originalIndex + 1);
        img.draggable = false;
        img.loading = 'lazy';

        // Ленивая загрузка — ставим data-src
        img.dataset.src = imagePath;
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect fill="%231a1a2e" width="1" height="1"/%3E%3C/svg%3E';

        // Оверлей с информацией
        var overlay = document.createElement('div');
        overlay.className = 'gallery-item__overlay';

        var counter = document.createElement('span');
        counter.className = 'gallery-item__counter';
        counter.textContent = '#' + (originalIndex + 1) + ' из ' + totalOriginalImages;

        var badge = document.createElement('span');
        badge.className = 'gallery-item__badge';
        badge.textContent = '🐵 Музей бибизян';

        overlay.appendChild(counter);
        overlay.appendChild(badge);

        item.appendChild(img);
        item.appendChild(overlay);

        return item;
    }

    /**
     * Добавляет N элементов в конец ленты
     * @param {number} count — количество элементов для добавления
     */
    function appendItems(count) {
        if (isLoadingMore) return;
        isLoadingMore = true;

        var fragment = document.createDocumentFragment();

        for (var i = 0; i < count; i++) {
            // Циклический индекс по оригинальному массиву
            var originalIndex = (totalItemsInDom + i) % totalOriginalImages;
            var path = imagePaths[originalIndex];

            var item = createGalleryItem(path, originalIndex);
            fragment.appendChild(item);
        }

        feed.appendChild(fragment);
        totalItemsInDom += count;

        // Ленивая загрузка новых изображений
        lazyLoadImages();

        isLoadingMore = false;
    }

    /* ========================================
       LAZY LOADING IMAGES
       ======================================== */

    let imageObserver = null;

    /**
     * Инициализирует IntersectionObserver для ленивой загрузки
     */
    function initLazyLoadObserver() {
        if (!('IntersectionObserver' in window)) {
            // Фоллбэк — загружаем все сразу
            loadAllImages();
            return;
        }

        imageObserver = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        var img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            delete img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        imageObserver.unobserve(img);
                    }
                });
            },
            {
                root: feed,
                rootMargin: '200% 0px',
                threshold: 0
            }
        );
    }

    /**
     * Подключает наблюдение за новыми изображениями
     */
    function lazyLoadImages() {
        if (!imageObserver) {
            initLazyLoadObserver();
        }

        if (!imageObserver) return;

        var images = feed.querySelectorAll('img[data-src]');
        images.forEach(function (img) {
            imageObserver.observe(img);
        });
    }

    /**
     * Фоллбэк — загружает все изображения
     */
    function loadAllImages() {
        var images = feed.querySelectorAll('img[data-src]');
        images.forEach(function (img) {
            if (img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
            }
        });
    }

    /**
     * Предзагрузка видимых и соседних изображений
     */
    function preloadVisibleImages() {
        var items = feed.querySelectorAll('.gallery-item');
        var count = Math.min(3, items.length);

        for (var i = 0; i < count; i++) {
            var img = items[i].querySelector('img[data-src]');
            if (img && img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
                img.removeAttribute('data-src');
            }
        }
    }

    /* ========================================
       PROGRESS DOTS
       ======================================== */

    let progressDots = [];

    /**
     * Создаёт точки прогресса (по количеству оригинальных изображений)
     */
    function createProgressDots() {
        if (!progressContainer) return;

        progressContainer.innerHTML = '';

        for (var i = 0; i < totalOriginalImages; i++) {
            var dot = document.createElement('span');
            dot.className = 'gallery-progress__dot';
            if (i === 0) {
                dot.classList.add('gallery-progress__dot--active');
            }
            progressContainer.appendChild(dot);
        }

        progressDots = Array.from(progressContainer.querySelectorAll('.gallery-progress__dot'));
    }

    /**
     * Обновляет активную точку прогресса
     * @param {number} originalIndex — индекс в оригинальном массиве
     */
    function updateProgressDots(originalIndex) {
        progressDots.forEach(function (dot, i) {
            if (i === originalIndex) {
                dot.classList.add('gallery-progress__dot--active');
            } else {
                dot.classList.remove('gallery-progress__dot--active');
            }
        });
    }

    /* ========================================
       SCROLL HANDLING
       ======================================== */

    /**
     * Определяет текущий видимый элемент и обновляет UI
     */
    function updateCurrentItem() {
        var items = feed.querySelectorAll('.gallery-item');
        if (items.length === 0) return;

        var feedRect = feed.getBoundingClientRect();
        var centerY = feedRect.top + feedRect.height / 2;

        var closest = null;
        var closestDistance = Infinity;

        items.forEach(function (item, i) {
            var rect = item.getBoundingClientRect();
            var itemCenterY = rect.top + rect.height / 2;
            var distance = Math.abs(itemCenterY - centerY);

            if (distance < closestDistance) {
                closestDistance = distance;
                closest = item;
                currentItemIndex = i;
            }
        });

        if (closest) {
            var originalIndex = parseInt(closest.dataset.originalIndex, 10);
            updateProgressDots(originalIndex);
            updateSidebarCounter(originalIndex);
        }
    }

    /**
     * Обновляет счётчик на боковой панели
     * @param {number} originalIndex
     */
    function updateSidebarCounter(originalIndex) {
        var counterEl = sidebar ? sidebar.querySelector('.gallery-sidebar__counter') : null;
        if (counterEl) {
            counterEl.textContent = (originalIndex + 1) + '/' + totalOriginalImages;
        }
    }

    /**
     * Проверяет, нужно ли подгрузить ещё элементов
     */
    function checkInfiniteScroll() {
        var scrollTop = feed.scrollTop;
        var scrollHeight = feed.scrollHeight;
        var clientHeight = feed.clientHeight;

        // Если до конца осталось меньше порога — подгружаем
        if (scrollHeight - scrollTop - clientHeight < GALLERY_CONFIG.loadThreshold) {
            appendItems(totalOriginalImages);
        }

        // Очистка старых элементов из DOM если их слишком много
        cleanupOldItems();
    }

    /**
     * Удаляет старые элементы из начала DOM для производительности
     */
    function cleanupOldItems() {
        var items = feed.querySelectorAll('.gallery-item');

        if (items.length <= GALLERY_CONFIG.maxDomElements) return;

        // Не удаляем если пользователь близко к началу
        if (feed.scrollTop < feed.clientHeight * 3) return;

        var removeCount = items.length - GALLERY_CONFIG.maxDomElements;

        // Запоминаем текущую позицию скролла
        var scrollBefore = feed.scrollTop;
        var removedHeight = 0;

        for (var i = 0; i < removeCount; i++) {
            removedHeight += items[i].getBoundingClientRect().height;
            feed.removeChild(items[i]);
        }

        // Корректируем скролл чтобы не было прыжка
        feed.scrollTop = scrollBefore - removedHeight;
    }

    /* ========================================
       HINT MANAGEMENT
       ======================================== */

    /**
     * Скрывает подсказку при первом скролле
     */
    function hideHint() {
        if (hasScrolled || !hint) return;
        hasScrolled = true;

        setTimeout(function () {
            hint.classList.add('gallery-hint--hidden');
        }, GALLERY_CONFIG.hintHideDelay);
    }

    /* ========================================
       SIDEBAR ACTIONS
       ======================================== */

    /**
     * Обрабатывает "лайк" текущего мема
     */
    function toggleLike() {
        var items = feed.querySelectorAll('.gallery-item');
        var currentItem = items[currentItemIndex];
        if (!currentItem) return;

        var itemId = currentItem.dataset.id;
        var likeBtn = sidebar ? sidebar.querySelector('[data-action="like"]') : null;
        var likeIcon = likeBtn ? likeBtn.querySelector('.gallery-sidebar__icon') : null;

        if (likedItems.has(itemId)) {
            likedItems.delete(itemId);
            if (likeIcon) likeIcon.textContent = '🤍';
        } else {
            likedItems.add(itemId);
            if (likeIcon) {
                likeIcon.textContent = '❤️';
                likeIcon.style.transform = 'scale(1.3)';
                setTimeout(function () {
                    likeIcon.style.transform = 'scale(1)';
                }, 300);
            }
        }
    }

    /**
     * "Шарит" текущий мем (копирует путь)
     */
    function shareMeme() {
        var items = feed.querySelectorAll('.gallery-item');
        var currentItem = items[currentItemIndex];
        if (!currentItem) return;

        var imagePath = currentItem.dataset.imagePath;
        var fullUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + imagePath;

        // Пытаемся использовать Web Share API
        if (navigator.share) {
            navigator.share({
                title: 'Музей бибизян 🐵',
                text: 'Смотри какой мем с обезьяной! 😂',
                url: fullUrl
            }).catch(function () {
                // Пользователь отменил
            });
        } else {
            // Фоллбэк — копируем в буфер
            copyToClipboard(fullUrl);
            showToast('Ссылка скопирована! 📋');
        }
    }

    /**
     * Копирует текст в буфер обмена
     * @param {string} text
     */
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(function () {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    /**
     * Фоллбэк копирования через textarea
     * @param {string} text
     */
    function fallbackCopy(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
        } catch (e) {
            // молча падаем
        }
        document.body.removeChild(textarea);
    }

    /**
     * Показывает всплывающее уведомление
     * @param {string} message
     */
    function showToast(message) {
        var existing = document.querySelector('.gallery-toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.className = 'gallery-toast';
        toast.textContent = message;
        toast.style.cssText =
            'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);' +
            'background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);' +
            'padding:12px 24px;border-radius:20px;color:white;font-size:0.9rem;' +
            'z-index:100;animation:fadeInUp 0.3s ease;pointer-events:none;';

        document.body.appendChild(toast);

        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(function () {
                toast.remove();
            }, 300);
        }, 2000);
    }

    /* ========================================
       KEYBOARD NAVIGATION
       ======================================== */

    /**
     * Скроллит к следующему / предыдущему элементу
     * @param {string} direction — 'next' или 'prev'
     */
    function navigateByKeyboard(direction) {
        var items = feed.querySelectorAll('.gallery-item');
        if (items.length === 0) return;

        var targetIndex;
        if (direction === 'next') {
            targetIndex = Math.min(currentItemIndex + 1, items.length - 1);
        } else {
            targetIndex = Math.max(currentItemIndex - 1, 0);
        }

        var targetItem = items[targetIndex];
        if (targetItem) {
            targetItem.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    /* ========================================
       DOUBLE TAP TO LIKE
       ======================================== */

    let lastTapTime = 0;

    /**
     * Обрабатывает двойной тап для лайка
     * @param {Event} e
     */
    function handleDoubleTap(e) {
        var now = Date.now();
        var timeDiff = now - lastTapTime;
        lastTapTime = now;

        if (timeDiff < 300 && timeDiff > 0) {
            e.preventDefault();
            toggleLike();
            showDoubleTapHeart(e);
        }
    }

    /**
     * Показывает анимацию сердечка при двойном тапе
     * @param {Event} e
     */
    function showDoubleTapHeart(e) {
        var heart = document.createElement('div');
        heart.textContent = '❤️';
        heart.style.cssText =
            'position:fixed;font-size:4rem;pointer-events:none;z-index:100;' +
            'animation:heartPop 0.8s ease forwards;';

        // Позиция — по центру клика / тапа
        var x, y;
        if (e.changedTouches) {
            x = e.changedTouches[0].clientX;
            y = e.changedTouches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }

        heart.style.left = (x - 30) + 'px';
        heart.style.top = (y - 30) + 'px';

        document.body.appendChild(heart);

        setTimeout(function () {
            heart.remove();
        }, 800);
    }

    // Добавляем анимацию сердечка в стили
    function injectHeartAnimation() {
        if (document.querySelector('#heart-pop-style')) return;

        var style = document.createElement('style');
        style.id = 'heart-pop-style';
        style.textContent =
            '@keyframes heartPop {' +
            '0% { transform: scale(0) rotate(-15deg); opacity: 1; }' +
            '50% { transform: scale(1.3) rotate(5deg); opacity: 1; }' +
            '100% { transform: scale(1.5) rotate(0deg) translateY(-40px); opacity: 0; }' +
            '}';
        document.head.appendChild(style);
    }

    /* ========================================
       EVENT BINDINGS
       ======================================== */

    function bindEvents() {
        // Инжектим дополнительные стили для анимаций
        injectHeartAnimation();

        // Скролл ленты — обновление UI и бесконечный скролл
        var debouncedUpdate = debounce(function () {
            updateCurrentItem();
            checkInfiniteScroll();
        }, GALLERY_CONFIG.scrollDebounce);

        feed.addEventListener('scroll', function () {
            hideHint();
            debouncedUpdate();
        }, { passive: true });

        // Клавиатурная навигация
        document.addEventListener('keydown', function (e) {
            switch (e.key) {
                case 'ArrowDown':
                case 'j':
                    e.preventDefault();
                    navigateByKeyboard('next');
                    break;
                case 'ArrowUp':
                case 'k':
                    e.preventDefault();
                    navigateByKeyboard('prev');
                    break;
                case 'l':
                    toggleLike();
                    break;
            }
        });

        // Двойной тап для лайка
        feed.addEventListener('touchend', handleDoubleTap);
        feed.addEventListener('dblclick', function (e) {
            toggleLike();
            showDoubleTapHeart(e);
        });

        // Кнопки сайдбара
        if (sidebar) {
            var likeBtn = sidebar.querySelector('[data-action="like"]');
            var shareBtn = sidebar.querySelector('[data-action="share"]');

            if (likeBtn) {
                likeBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    toggleLike();
                });
            }

            if (shareBtn) {
                shareBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    shareMeme();
                });
            }
        }

        // При ресайзе — пересчитываем текущий элемент
        window.addEventListener('resize', debounce(function () {
            updateCurrentItem();
        }, 200));
    }

    /* ========================================
       START
       ======================================== */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();