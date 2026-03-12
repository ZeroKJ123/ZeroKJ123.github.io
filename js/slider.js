(function () {
    'use strict';

    /* ========================================
       CONFIGURATION
       ======================================== */

    const SLIDER_CONFIG = {
        autoplayInterval: 5000,     // Интервал автоперелистывания (мс)
        transitionDuration: 1000,   // Длительность перехода (мс)
        swipeThreshold: 50,         // Минимальное расстояние свайпа (px)
        progressUpdateRate: 50,     // Частота обновления прогресс-бара (мс)
        pauseOnHover: true,         // Пауза при наведении мыши
    };

    /* ========================================
       DOM ELEMENTS
       ======================================== */

    const sliderContainer = document.querySelector('.slider');

    // Если нет слайдера на странице — выходим
    if (!sliderContainer) return;

    const sliderTrack = sliderContainer.querySelector('.slider__track');
    const dotsContainer = sliderContainer.querySelector('.slider__dots');
    const progressBar = sliderContainer.querySelector('.slider__progress');
    const prevBtn = sliderContainer.querySelector('.slider__arrow--prev');
    const nextBtn = sliderContainer.querySelector('.slider__arrow--next');

    /* ========================================
       STATE
       ======================================== */

    let slides = [];
    let dots = [];
    let currentIndex = 0;
    let totalSlides = 0;
    let autoplayTimer = null;
    let progressTimer = null;
    let progressStart = 0;
    let isPaused = false;
    let isTransitioning = false;

    // Свайп
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isSwiping = false;

    /* ========================================
       INITIALIZATION
       ======================================== */

    function init() {
        const imagePaths = getAllImagePaths();

        if (imagePaths.length === 0) {
            console.warn('[Slider] Нет изображений для слайдера');
            return;
        }

        totalSlides = imagePaths.length;

        // Создаём слайды
        createSlides(imagePaths);

        // Создаём точки навигации
        createDots();

        // Показываем первый слайд
        goToSlide(0, false);

        // Запускаем автоплей
        startAutoplay();

        // Привязываем события
        bindEvents();

        // Предзагрузка соседних изображений
        preloadNeighbors(0);
    }

    /* ========================================
       CREATE SLIDES
       ======================================== */

    /**
     * Создаёт DOM-элементы слайдов из массива путей
     * @param {string[]} imagePaths
     */
    function createSlides(imagePaths) {
        // Очищаем трек
        sliderTrack.innerHTML = '';

        imagePaths.forEach(function (path, index) {
            var slide = document.createElement('div');
            slide.className = 'slider__slide';
            slide.setAttribute('role', 'tabpanel');
            slide.setAttribute('aria-label', 'Слайд ' + (index + 1) + ' из ' + imagePaths.length);

            var img = document.createElement('img');
            img.className = 'slider__image';
            img.alt = 'Мем с обезьяной #' + (index + 1);
            img.loading = index === 0 ? 'eager' : 'lazy';
            img.draggable = false;

            // Для первого слайда — загружаем сразу, остальные лениво
            if (index === 0) {
                img.src = path;
            } else {
                img.dataset.src = path;
                // Ставим пустой пиксель пока не загрузится
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
            }

            slide.appendChild(img);
            sliderTrack.appendChild(slide);
        });

        slides = Array.from(sliderTrack.querySelectorAll('.slider__slide'));
    }

    /* ========================================
       CREATE DOTS
       ======================================== */

    /**
     * Создаёт точки навигации под слайдером
     */
    function createDots() {
        if (!dotsContainer) return;

        dotsContainer.innerHTML = '';

        for (var i = 0; i < totalSlides; i++) {
            var dot = document.createElement('button');
            dot.className = 'slider__dot';
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', 'Перейти к слайду ' + (i + 1));
            dot.setAttribute('aria-selected', 'false');
            dot.dataset.index = i;

            dot.addEventListener('click', function () {
                var idx = parseInt(this.dataset.index, 10);
                if (idx !== currentIndex && !isTransitioning) {
                    goToSlide(idx);
                    resetAutoplay();
                }
            });

            dotsContainer.appendChild(dot);
        }

        dots = Array.from(dotsContainer.querySelectorAll('.slider__dot'));
    }

    /* ========================================
       SLIDE NAVIGATION
       ======================================== */

    /**
     * Переходит к слайду по индексу
     * @param {number} index — индекс целевого слайда
     * @param {boolean} [animate=true] — анимировать переход
     */
    function goToSlide(index, animate) {
        if (animate === undefined) animate = true;

        if (isTransitioning && animate) return;

        // Нормализуем индекс (зацикливание)
        index = ((index % totalSlides) + totalSlides) % totalSlides;

        // Ленивая загрузка изображения
        lazyLoadSlide(index);

        var prevIndex = currentIndex;
        currentIndex = index;

        // Обновляем слайды
        slides.forEach(function (slide, i) {
            if (i === currentIndex) {
                slide.classList.add('slider__slide--active');
            } else {
                slide.classList.remove('slider__slide--active');
            }
        });

        // Обновляем точки
        dots.forEach(function (dot, i) {
            if (i === currentIndex) {
                dot.classList.add('slider__dot--active');
                dot.setAttribute('aria-selected', 'true');
            } else {
                dot.classList.remove('slider__dot--active');
                dot.setAttribute('aria-selected', 'false');
            }
        });

        // Блокируем переход на время анимации
        if (animate && prevIndex !== currentIndex) {
            isTransitioning = true;
            setTimeout(function () {
                isTransitioning = false;
            }, SLIDER_CONFIG.transitionDuration);
        }

        // Предзагрузка соседних слайдов
        preloadNeighbors(currentIndex);

        // Сброс прогресса
        resetProgress();
    }

    /**
     * Следующий слайд
     */
    function nextSlide() {
        if (!isTransitioning) {
            goToSlide(currentIndex + 1);
        }
    }

    /**
     * Предыдущий слайд
     */
    function prevSlide() {
        if (!isTransitioning) {
            goToSlide(currentIndex - 1);
        }
    }

    /* ========================================
       LAZY LOADING
       ======================================== */

    /**
     * Подгружает изображение слайда если ещё не загружено
     * @param {number} index
     */
    function lazyLoadSlide(index) {
        var slide = slides[index];
        if (!slide) return;

        var img = slide.querySelector('.slider__image');
        if (img && img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
        }
    }

    /**
     * Предзагружает соседние слайды
     * @param {number} index — текущий индекс
     */
    function preloadNeighbors(index) {
        var prevIdx = ((index - 1) + totalSlides) % totalSlides;
        var nextIdx = (index + 1) % totalSlides;
        lazyLoadSlide(prevIdx);
        lazyLoadSlide(nextIdx);
    }

    /* ========================================
       AUTOPLAY
       ======================================== */

    /**
     * Запускает автоматическую прокрутку
     */
    function startAutoplay() {
        stopAutoplay();

        if (isPaused) return;

        progressStart = Date.now();

        autoplayTimer = setTimeout(function () {
            nextSlide();
            startAutoplay();
        }, SLIDER_CONFIG.autoplayInterval);

        // Запускаем обновление прогресс-бара
        startProgress();
    }

    /**
     * Останавливает автоматическую прокрутку
     */
    function stopAutoplay() {
        if (autoplayTimer) {
            clearTimeout(autoplayTimer);
            autoplayTimer = null;
        }
        stopProgress();
    }

    /**
     * Перезапускает автоплей (после взаимодействия)
     */
    function resetAutoplay() {
        stopAutoplay();
        resetProgress();
        startAutoplay();
    }

    /**
     * Приостанавливает автоплей
     */
    function pauseAutoplay() {
        isPaused = true;
        stopAutoplay();
    }

    /**
     * Возобновляет автоплей
     */
    function resumeAutoplay() {
        isPaused = false;
        startAutoplay();
    }

    /* ========================================
       PROGRESS BAR
       ======================================== */

    /**
     * Запускает анимацию прогресс-бара
     */
    function startProgress() {
        if (!progressBar) return;

        stopProgress();

        progressTimer = setInterval(function () {
            var elapsed = Date.now() - progressStart;
            var progress = Math.min(elapsed / SLIDER_CONFIG.autoplayInterval, 1);
            progressBar.style.width = (progress * 100) + '%';
        }, SLIDER_CONFIG.progressUpdateRate);
    }

    /**
     * Останавливает обновление прогресс-бара
     */
    function stopProgress() {
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
    }

    /**
     * Сбрасывает прогресс-бар в 0
     */
    function resetProgress() {
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        progressStart = Date.now();
    }

    /* ========================================
       EVENT BINDINGS
       ======================================== */

    function bindEvents() {
        // Стрелки
        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                prevSlide();
                resetAutoplay();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                nextSlide();
                resetAutoplay();
            });
        }

        // Пауза при наведении
        if (SLIDER_CONFIG.pauseOnHover) {
            sliderContainer.addEventListener('mouseenter', pauseAutoplay);
            sliderContainer.addEventListener('mouseleave', resumeAutoplay);
        }

        // Клавиатурная навигация
        document.addEventListener('keydown', function (e) {
            // Только если слайдер виден на экране
            if (!isSliderInView()) return;

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    prevSlide();
                    resetAutoplay();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    nextSlide();
                    resetAutoplay();
                    break;
            }
        });

        // Свайп на тач-устройствах
        sliderContainer.addEventListener('touchstart', onTouchStart, { passive: true });
        sliderContainer.addEventListener('touchmove', onTouchMove, { passive: true });
        sliderContainer.addEventListener('touchend', onTouchEnd);

        // Пауза при уходе со вкладки
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                pauseAutoplay();
            } else {
                resumeAutoplay();
            }
        });
    }

    /* ========================================
       TOUCH / SWIPE HANDLING
       ======================================== */

    function onTouchStart(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        isSwiping = true;
    }

    function onTouchMove(e) {
        if (!isSwiping) return;
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
    }

    function onTouchEnd(e) {
        if (!isSwiping) return;
        isSwiping = false;

        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;

        var diffX = touchStartX - touchEndX;
        var diffY = touchStartY - touchEndY;

        // Проверяем, что горизонтальный свайп значительнее вертикального
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > SLIDER_CONFIG.swipeThreshold) {
            if (diffX > 0) {
                // Свайп влево — следующий слайд
                nextSlide();
            } else {
                // Свайп вправо — предыдущий слайд
                prevSlide();
            }
            resetAutoplay();
        }
    }

    /* ========================================
       UTILITY
       ======================================== */

    /**
     * Проверяет, виден ли слайдер на экране
     * @returns {boolean}
     */
    function isSliderInView() {
        var rect = sliderContainer.getBoundingClientRect();
        return (
            rect.top < window.innerHeight &&
            rect.bottom > 0
        );
    }

    /* ========================================
       START
       ======================================== */

    // Ждём загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();