(function () {
    'use strict';

    /* ========================================
       DOM ELEMENTS
       ======================================== */

    const header = document.querySelector('.header');
    const burger = document.querySelector('.burger');
    const mobileNav = document.querySelector('.mobile-nav');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav__link');
    const body = document.body;

    /* ========================================
       HEADER SCROLL EFFECT
       ======================================== */

    let lastScrollY = 0;
    let ticking = false;

    /**
     * Обновляет состояние хедера при скролле:
     * - Добавляет тень при скролле вниз
     */
    function updateHeader() {
        const scrollY = window.scrollY;

        if (scrollY > 50) {
            header.classList.add('header--scrolled');
        } else {
            header.classList.remove('header--scrolled');
        }

        lastScrollY = scrollY;
        ticking = false;
    }

    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(updateHeader);
            ticking = true;
        }
    }

    if (header) {
        window.addEventListener('scroll', onScroll, { passive: true });
        // Начальная проверка
        updateHeader();
    }

    /* ========================================
       MOBILE MENU (BURGER)
       ======================================== */

    let isMenuOpen = false;

    /**
     * Открывает / закрывает мобильное меню
     */
    function toggleMenu() {
        isMenuOpen = !isMenuOpen;

        burger.classList.toggle('burger--active', isMenuOpen);
        mobileNav.classList.toggle('mobile-nav--open', isMenuOpen);
        body.classList.toggle('no-scroll', isMenuOpen);

        // Обновляем ARIA
        burger.setAttribute('aria-expanded', isMenuOpen.toString());
        mobileNav.setAttribute('aria-hidden', (!isMenuOpen).toString());
    }

    /**
     * Закрывает мобильное меню
     */
    function closeMenu() {
        if (!isMenuOpen) return;
        isMenuOpen = false;

        burger.classList.remove('burger--active');
        mobileNav.classList.remove('mobile-nav--open');
        body.classList.remove('no-scroll');

        burger.setAttribute('aria-expanded', 'false');
        mobileNav.setAttribute('aria-hidden', 'true');
    }

    if (burger && mobileNav) {
        // Клик по бургеру
        burger.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleMenu();
        });

        // Клик по ссылкам в мобильном меню — закрыть
        mobileNavLinks.forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });

        // Закрытие по Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isMenuOpen) {
                closeMenu();
                burger.focus();
            }
        });

        // Закрытие при клике вне меню
        mobileNav.addEventListener('click', function (e) {
            if (e.target === mobileNav) {
                closeMenu();
            }
        });

        // Закрытие при ресайзе окна на десктоп
        window.addEventListener('resize', function () {
            if (window.innerWidth > 768 && isMenuOpen) {
                closeMenu();
            }
        });
    }

    /* ========================================
       SCROLL ANIMATIONS (Intersection Observer)
       ======================================== */

    /**
     * Инициализирует анимации появления элементов
     * при прокрутке страницы
     */
    function initScrollAnimations() {
        const elements = document.querySelectorAll('.animate-on-scroll');

        if (elements.length === 0) return;

        // Проверяем поддержку IntersectionObserver
        if (!('IntersectionObserver' in window)) {
            // Фоллбэк — просто показываем все элементы
            elements.forEach(function (el) {
                el.classList.add('animate-on-scroll--visible');
            });
            return;
        }

        const observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-on-scroll--visible');
                        // Отключаем наблюдение — анимация одноразовая
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                root: null,
                rootMargin: '0px 0px -60px 0px',
                threshold: 0.15
            }
        );

        elements.forEach(function (el) {
            observer.observe(el);
        });
    }

    /* ========================================
       ACTIVE NAV LINK HIGHLIGHT
       ======================================== */

    /**
     * Подсвечивает текущую страницу в навигации
     */
    function highlightActiveNavLink() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        // Десктоп навигация
        const navLinks = document.querySelectorAll('.nav__link');
        navLinks.forEach(function (link) {
            const href = link.getAttribute('href');
            if (href === currentPage || (currentPage === '' && href === 'index.html')) {
                link.classList.add('nav__link--active');
            } else {
                link.classList.remove('nav__link--active');
            }
        });

        // Мобильная навигация
        const mobileLinks = document.querySelectorAll('.mobile-nav__link');
        mobileLinks.forEach(function (link) {
            const href = link.getAttribute('href');
            if (href === currentPage || (currentPage === '' && href === 'index.html')) {
                link.classList.add('mobile-nav__link--active');
            } else {
                link.classList.remove('mobile-nav__link--active');
            }
        });
    }

    /* ========================================
       PRELOAD IMAGES UTILITY
       ======================================== */

    /**
     * Предзагрузка массива изображений
     * @param {string[]} paths — массив путей к изображениям
     * @param {function} [onComplete] — коллбэк по завершению
     */
    window.preloadImages = function (paths, onComplete) {
        let loaded = 0;
        const total = paths.length;

        if (total === 0 && onComplete) {
            onComplete();
            return;
        }

        paths.forEach(function (src) {
            const img = new Image();
            img.onload = img.onerror = function () {
                loaded++;
                if (loaded >= total && onComplete) {
                    onComplete();
                }
            };
            img.src = src;
        });
    };

    /* ========================================
       DEBOUNCE & THROTTLE UTILITIES
       ======================================== */

    /**
     * Дебаунс — откладывает вызов функции
     * @param {function} func
     * @param {number} wait — задержка в мс
     * @returns {function}
     */
    window.debounce = function (func, wait) {
        let timeout;
        return function () {
            var context = this;
            var args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function () {
                func.apply(context, args);
            }, wait);
        };
    };

    /**
     * Троттл — ограничивает частоту вызовов функции
     * @param {function} func
     * @param {number} limit — минимальный интервал в мс
     * @returns {function}
     */
    window.throttle = function (func, limit) {
        let inThrottle = false;
        return function () {
            var context = this;
            var args = arguments;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(function () {
                    inThrottle = false;
                }, limit);
            }
        };
    };

    /* ========================================
       EMOJI FAVICON (бонус)
       ======================================== */

    /**
     * Устанавливает эмодзи как favicon
     * @param {string} emoji
     */
    function setEmojiFavicon(emoji) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        var ctx = canvas.getContext('2d');
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 16, 18);

        var link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = canvas.toDataURL();
    }

    /* ========================================
       INITIALIZATION
       ======================================== */

    function init() {
        highlightActiveNavLink();
        initScrollAnimations();
        setEmojiFavicon('🐵');
    }

    // Запуск после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();