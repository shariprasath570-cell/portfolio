/* Portfolio interactions + content hydration.
   content.json is the canonical content source; the JSONBin/localStorage
   layers are kept so the existing admin panel keeps working. */

(function () {
    'use strict';

    var root = document.documentElement;
    root.classList.add('js');

    var motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------- navigation ---------------- */

    var navToggle = document.getElementById('navToggle');
    var nav = document.getElementById('primaryNav');
    var mobileQuery = window.matchMedia('(max-width: 760px)');

    function setNav(open) {
        if (!nav || !navToggle) return;
        nav.classList.toggle('is-open', open);
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        navToggle.textContent = open ? 'Close' : 'Menu';
    }

    if (navToggle && nav) {
        navToggle.addEventListener('click', function () {
            setNav(!nav.classList.contains('is-open'));
        });

        nav.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                if (mobileQuery.matches) setNav(false);
            });
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && nav.classList.contains('is-open')) {
                setNav(false);
                navToggle.focus();
            }
        });

        document.addEventListener('click', function (event) {
            if (!mobileQuery.matches || !nav.classList.contains('is-open')) return;
            if (nav.contains(event.target) || navToggle.contains(event.target)) return;
            setNav(false);
        });

        var onBreakpointChange = function (event) {
            if (!event.matches) setNav(false);
        };
        if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', onBreakpointChange);
        else if (mobileQuery.addListener) mobileQuery.addListener(onBreakpointChange);
    }

    /* ---------------- helpers ---------------- */

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeUrl(value) {
        var url = String(value == null ? '' : value).trim();
        return /^(https?:\/\/|mailto:)/i.test(url) ? url : '';
    }

    function text(selector, value) {
        if (!value) return;
        document.querySelectorAll(selector).forEach(function (el) {
            el.textContent = value;
        });
    }

    /* ---------------- motion: entrances ---------------- */

    /* Elements stay visible by default; only ones starting below the fold are
       hidden, so the page still reads with JS disabled or blocked. */
    var revealObserver = null;

    if (motionOK && 'IntersectionObserver' in window) {
        /* Toggled both ways, never unobserved: every pass through the viewport
           replays the entrance, including when scrolling back up. */
        revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                entry.target.classList.toggle('is-hidden', !entry.isIntersecting);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    }

    function prepareStagger(scope) {
        scope.querySelectorAll('[data-stagger]').forEach(function (group) {
            var anim = group.getAttribute('data-anim') || '';
            Array.prototype.forEach.call(group.children, function (child, index) {
                child.classList.add('reveal');
                child.style.setProperty('--i', String(Math.min(index, 8)));
                if (anim) child.setAttribute('data-anim', anim);
            });
        });
    }

    function prepareHeadings(scope) {
        scope.querySelectorAll('.section-head h2').forEach(function (heading) {
            if (!heading.querySelector('.wipe-inner')) {
                heading.innerHTML = '<span class="wipe-inner">' + heading.innerHTML + '</span>';
            }
            heading.classList.add('reveal');
            heading.setAttribute('data-anim', 'head');
        });
    }

    function watchReveals(scope) {
        if (!revealObserver) return;
        scope.querySelectorAll('.reveal').forEach(function (el) {
            if (el.dataset.revealWatched === '1') return;
            el.dataset.revealWatched = '1';

            var parentHidden = el.parentElement && el.parentElement.closest('.is-hidden');
            if (parentHidden || el.getBoundingClientRect().top > window.innerHeight) {
                el.classList.add('is-hidden');
            }

            revealObserver.observe(el);
        });
    }

    /* ---------------- motion: section hairlines ---------------- */

    var sectionObserver = null;

    if ('IntersectionObserver' in window) {
        sectionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                entry.target.classList.toggle('is-inview', entry.isIntersecting);
            });
        }, { threshold: 0.12 });
    }

    function observeSections(scope) {
        if (!sectionObserver) return;
        scope.querySelectorAll('.section').forEach(function (section) {
            sectionObserver.observe(section);
        });
    }

    /* ---------------- motion: count-up numbers ---------------- */

    var countObserver = null;

    if (motionOK && 'IntersectionObserver' in window) {
        countObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var el = entry.target;

                if (entry.isIntersecting) {
                    countUp(el);
                    return;
                }

                // Stop a run that is still going and go back to the final value.
                el._countToken = (el._countToken || 0) + 1;
                if (el.dataset.raw) el.textContent = el.dataset.raw;
            });
        }, { threshold: 0.5 });
    }

    function countUp(el) {
        if (!el.dataset.raw) el.dataset.raw = el.textContent.trim();

        var raw = el.dataset.raw;
        var match = raw.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
        if (!match) return;

        var prefix = match[1];
        var numberText = match[2];
        var suffix = match[3];
        var decimals = (numberText.split('.')[1] || '').length;
        var target = parseFloat(numberText.replace(/,/g, ''));
        if (!isFinite(target) || target === 0) return;

        var grouped = numberText.indexOf(',') !== -1;
        var start = null;
        var duration = 1100;
        var token = (el._countToken || 0) + 1;
        el._countToken = token;

        function frame(now) {
            if (el._countToken !== token) return;
            if (start === null) start = now;
            var progress = Math.min(1, (now - start) / duration);
            var eased = 1 - Math.pow(1 - progress, 3);
            var value = target * eased;
            var output = decimals
                ? value.toFixed(decimals)
                : String(Math.round(value));

            if (grouped) {
                output = Number(output).toLocaleString('en-US', {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                });
            }

            el.textContent = prefix + output + suffix;

            if (progress < 1) window.requestAnimationFrame(frame);
            else el.textContent = raw;
        }

        window.requestAnimationFrame(frame);
    }

    function observeCounts(scope) {
        if (!countObserver) return;
        scope.querySelectorAll('.metric-value').forEach(function (el) {
            if (el.dataset.counted === '1') return;
            el.dataset.counted = '1';
            countObserver.observe(el);
        });
    }

    /* ---------------- motion: terminal typing ---------------- */

    var termObserver = null;

    if (motionOK && 'IntersectionObserver' in window) {
        termObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var term = entry.target;

                if (entry.isIntersecting) {
                    typeTerminal(term);
                    return;
                }

                // Rewind to a blank slip so the next pass types it again.
                term._typeToken = (term._typeToken || 0) + 1;
                term.querySelectorAll('.term-line').forEach(function (line) {
                    line.classList.add('is-typing');
                });
            });
        }, { threshold: 0.35 });
    }

    function typeTerminal(term) {
        var lines = term.querySelectorAll('.term-body > .term-line');
        if (!lines.length) return;

        var token = (term._typeToken || 0) + 1;
        term._typeToken = token;

        lines.forEach(function (line) {
            line.classList.add('is-typing');
        });

        var index = 0;
        function next() {
            if (term._typeToken !== token || index >= lines.length) return;
            lines[index].classList.remove('is-typing');
            index += 1;
            window.setTimeout(next, 260);
        }

        window.setTimeout(next, 180);
    }

    function observeTerminals(scope) {
        if (!termObserver) return;
        scope.querySelectorAll('.term').forEach(function (term) {
            if (term.dataset.typed === '1') return;
            term.dataset.typed = '1';
            termObserver.observe(term);
        });
    }

    /* ---------------- motion: pointer highlight ---------------- */

    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function observeSpotlights(scope) {
        if (!finePointer) return;
        scope.querySelectorAll('.project').forEach(function (project) {
            if (project.dataset.spotlight === '1') return;
            project.dataset.spotlight = '1';

            project.addEventListener('pointermove', function (event) {
                var rect = project.getBoundingClientRect();
                project.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
                project.style.setProperty('--my', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
            });
        });
    }

    /* ---------------- motion: scroll loop ---------------- */

    var progress = document.getElementById('progress');
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-list a[href^="#"]'));
    var sectionTargets = navLinks.map(function (link) {
        return document.querySelector(link.getAttribute('href'));
    }).filter(Boolean);
    var mediaItems = [];
    var scrollTicking = false;

    function collectParallax(scope) {
        scope.querySelectorAll('.project-media').forEach(function (media) {
            if (mediaItems.indexOf(media) === -1) mediaItems.push(media);
        });
    }

    function updateActiveLink() {
        if (!sectionTargets.length) return;
        var probe = window.scrollY + window.innerHeight * 0.32;
        var activeIndex = -1;

        sectionTargets.forEach(function (section, index) {
            if (section.offsetTop <= probe) activeIndex = index;
        });

        // The last section can be shorter than the probe offset, so it would
        // never win on its own; at the bottom of the page it is the one shown.
        var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        if (atBottom) activeIndex = sectionTargets.length - 1;

        navLinks.forEach(function (link, index) {
            if (index === activeIndex) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
        });
    }

    var railLinks = Array.prototype.slice.call(document.querySelectorAll('.rail a[href^="#"]'));

    function updateRail() {
        if (!railLinks.length) return;
        var probe = window.scrollY + window.innerHeight * 0.45;
        var activeIndex = -1;

        railLinks.forEach(function (link, index) {
            var section = document.querySelector(link.getAttribute('href'));
            if (!section) return;
            if (section.offsetTop <= probe) activeIndex = index;
            link.classList.toggle('is-passed', section.offsetTop + section.offsetHeight < probe);
        });

        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
            activeIndex = railLinks.length - 1;
        }

        railLinks.forEach(function (link, index) {
            if (index === activeIndex) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
        });
    }

    /* Slow drift inside the screenshot frames, so the gallery has depth. */
    function updateGalleryDepth() {
        if (!finePointer) return;

        document.querySelectorAll('.gallery img').forEach(function (img) {
            var rect = img.parentElement.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) return;

            var progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / (window.innerHeight / 2);
            progress = Math.max(-1, Math.min(1, progress));
            img.style.setProperty('--py', (progress * -10).toFixed(1) + 'px');
        });
    }

    /* Each screenshot pops as it reaches the middle of the rail and recedes as
       it leaves, driven by its distance from the rail's centre. Runs off the
       page scroll (the pin moves the rail) and off the rail's own scroll. */
    function updateGalleryFocus() {
        if (!motionOK) return;

        document.querySelectorAll('.gallery').forEach(function (track) {
            var figures = Array.prototype.slice.call(track.querySelectorAll('figure'));
            if (!figures.length) return;

            var box = track.getBoundingClientRect();
            var centre = box.left + box.width / 2;

            /* One slide's width plus the gap is the distance at which a slide
               counts as fully out, so exactly one slide is ever popped. */
            var gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
            var reach = Math.max(1, figures[0].offsetWidth + gap);

            var deltas = figures.map(function (figure) {
                var rect = figure.getBoundingClientRect();
                return (rect.left + rect.width / 2) - centre;
            });

            var first = figures[0].getBoundingClientRect();
            if (first.bottom < -240 || first.top > window.innerHeight + 240) return;

            /* The closest slide is the popped one. At the two ends of the rail
               no slide can sit dead centre, so subtracting the smallest offset
               keeps the leading slide fully popped rather than half faded. */
            var nearest = deltas.reduce(function (best, delta) {
                return Math.min(best, Math.abs(delta));
            }, Infinity);

            figures.forEach(function (figure, index) {
                var d = Math.min(1, (Math.abs(deltas[index]) - nearest) / reach);
                figure.style.setProperty('--d', Math.max(0, d).toFixed(3));
            });
        });
    }

    function onScrollFrame() {
        scrollTicking = false;

        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (progress) {
            var ratio = max > 0 ? (window.scrollY / max) * 100 : 0;
            progress.style.width = Math.min(100, Math.max(0, ratio)) + '%';
        }

        updateActiveLink();
        updateRail();
        syncScreensPin();

        if (!motionOK) return;

        updateGalleryFocus();
        updateGalleryDepth();

        mediaItems.forEach(function (media) {
            var rect = media.getBoundingClientRect();
            if (rect.bottom < -80 || rect.top > window.innerHeight + 80) return;
            var offset = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - window.innerHeight / 2) / (window.innerHeight / 2)));
            media.style.transform = 'translate3d(0,' + (offset * -12).toFixed(1) + 'px,0)';
        });
    }

    /* The pinned screens section: set up by initScreensPin() once the rail
       exists, then driven from onScrollFrame. A no-op until then. */
    var syncScreensPin = function () {};

    window.addEventListener('scroll', function () {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(onScrollFrame);
    }, { passive: true });

    window.addEventListener('resize', function () {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(onScrollFrame);
    }, { passive: true });

    /* Runs every motion hook over a scope, for both static and rendered nodes. */
    function activate(scope) {
        prepareStagger(scope);
        prepareHeadings(scope);
        watchReveals(scope);
        observeSections(scope);
        observeCounts(scope);
        observeTerminals(scope);
        observeSpotlights(scope);
        collectParallax(scope);
    }

    /* ---------------- content fallback ---------------- */

    /* Editor saves win over content.json; content.json wins over the fallback. */
    var LAST_RESORT = {
        profile: {
            name: 'Hariprasath',
            lastName: 'S',
            intro: 'BSc IT student building a source-backed standards assistant for Smart India Hackathon, and a rule-based futures platform with a 1,118-trade backtest behind it.'
        },
        contact: {
            email: 'shariprasath4577@gmail.com',
            linkedin: 'https://www.linkedin.com/in/hariprasath-s-527823386/'
        },
        projects: [
            {
                id: 'sih',
                tags: ['SIH 2026', 'AI / RAG'],
                status: 'In progress',
                title: 'AI Assistant for BIS Standards',
                role: 'Smart India Hackathon · Ministry of Consumer Affairs',
                desc: 'A retrieval-backed assistant that turns a plain product description into the Indian Standards that apply, the BIS certification path, and the labs that can test it — answered in English or Hindi, with sources attached.',
                features: [
                    'Standard recommendation from a product description',
                    'BIS certification guidance and eligibility check',
                    'Hallmarking and testing-lab suggestions',
                    'Document checklist per product',
                    'Multilingual answers (English and Hindi)'
                ],
                tech: ['Next.js', 'Python · FastAPI', 'RAG + vector DB', 'Llama 3 via Groq'],
                metrics: [],
                visual: 'sih'
            },
            {
                id: 'steizen',
                tags: ['STEIZEN', 'FinTech'],
                status: 'In progress',
                title: 'STEIZEN — Rule-Based Trading Platform',
                role: 'Algorithmic trading system for Nasdaq futures (MNQ / NQ)',
                desc: 'A rule-based trading system that detects market structure, scores trade quality, sizes risk in R multiples, and executes through IBKR — with a full backtesting and journaling loop around it.',
                features: [
                    'BOS / CHoCH, fair value gaps, order blocks',
                    'Trade quality scoring before entry',
                    'R-multiple risk engine',
                    'IBKR paper and live execution',
                    'Backtesting and trade journal'
                ],
                tech: [],
                results: [
                    '1,118 trades · +133 R net',
                    'Expectancy +0.119 R',
                    'Profit factor 1.19',
                    '11/11 walk-forward windows positive'
                ],
                metrics: [
                    { value: '1,118', label: 'Trades' },
                    { value: '+133 R', label: 'Net' },
                    { value: '1.19', label: 'Profit factor' },
                    { value: '11/11', label: 'Walk-forward' }
                ],
                note: 'Backtested results, not live trading performance.',
                gallery: [
                    { file: 'steizen-shot.jpg', label: 'Platform overview' },
                    { file: 'frame-dash.jpg', label: 'Dashboard' },
                    { file: 'frame-chart.jpg', label: 'Chart' },
                    { file: 'frame-signals.jpg', label: 'Signals' },
                    { file: 'frame-analytics.jpg', label: 'Analytics' }
                ],
                hasVideo: true
            }
        ]
    };

    async function loadContent() {
        try {
            var apiKey = window.localStorage.getItem('jb-api');
            var binId = window.localStorage.getItem('jb-bin');
            if (apiKey && binId) {
                var cloud = await fetch('https://api.jsonbin.io/v3/b/' + encodeURIComponent(binId) + '/latest', {
                    headers: { 'X-Master-Key': apiKey }
                });
                if (cloud.ok) {
                    var payload = await cloud.json();
                    if (payload && payload.record) return payload.record;
                }
            }
        } catch (error) { /* offline or blocked — fall through */ }

        try {
            var stored = window.localStorage.getItem('portfolio-content');
            if (stored) {
                var parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (error) { /* ignore bad local snapshot */ }

        try {
            var response = await fetch('content.json', { cache: 'no-store' });
            if (response.ok) return await response.json();
        } catch (error) { /* file:// or missing file — fall through */ }

        return null;
    }

    /* ---------------- project rendering ---------------- */

    var TERMINAL_BODY = [
        { prompt: true, text: 'query "40 mm MS angle, structural use"' },
        { prompt: false, text: 'IS 2062 · IS 808 — applicable' },
        { prompt: false, text: 'certification: BIS licence mandatory' },
        { prompt: true, text: 'query "gold jewellery hallmarking"' },
        { prompt: false, text: 'HUID required · 2 testing labs listed' },
        { prompt: true, text: 'ask "documents for BIS licence?"' },
        { prompt: false, text: '7 documents · checklist ready' }
    ];

    function terminalPanel(project) {
        var lines = TERMINAL_BODY.map(function (line) {
            if (line.prompt) {
                return '<div class="term-line"><span class="term-prompt">&gt;</span>' + escapeHtml(line.text) + '</div>';
            }
            return '<div class="term-line term-out">' + escapeHtml(line.text) + '</div>';
        }).join('');

        return '' +
            '<div class="term">' +
                '<div class="term-bar"><span>' + escapeHtml(project.id || 'assistant') + ' / rag-pipeline</span><span>EN · HI</span></div>' +
                '<div class="term-body">' + lines +
                    '<div class="term-line"><span class="term-prompt">&gt;</span><span class="cursor" aria-hidden="true"></span></div>' +
                '</div>' +
            '</div>';
    }

    /* A project's own captures, rendered beneath its write-up. */
    function projectGallery(project) {
        var items = (project.gallery || []).filter(function (item) {
            return item && typeof item.file === 'string' && /^(?:assets\/)?[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|avif)$/i.test(item.file.trim());
        });
        if (!items.length) return '';

        var slides = items.map(function (item, index) {
            var file = item.file.trim();
            var label = item.label || 'Screen ' + (index + 1);
            return '' +
                '<figure>' +
                    '<img src="' + escapeHtml(file) + '" alt="' + escapeHtml(project.title || 'Project') + ' — ' + escapeHtml(label) + ' screen"' +
                    ' width="1280" height="800" loading="lazy" decoding="async">' +
                    '<figcaption>' + escapeHtml(label) + '</figcaption>' +
                '</figure>';
        }).join('');

        var label = (project.title || 'Project') + ' screenshots';

        return '' +
            '<div class="gallery-wrap reveal">' +
                '<div class="gallery" role="region" tabindex="0" aria-label="' + escapeHtml(label) + '">' + slides + '</div>' +
                '<div class="gallery-bar">' +
                    '<p class="gallery-hint">Scroll sideways for more</p>' +
                    '<div class="gallery-buttons">' +
                        '<button type="button" class="gallery-btn" data-gallery="prev" aria-label="Previous screenshot">' +
                            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m15 18-6-6 6-6"></path></svg>' +
                        '</button>' +
                        '<button type="button" class="gallery-btn" data-gallery="next" aria-label="Next screenshot">' +
                            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 18 6-6-6-6"></path></svg>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    /* The screenshot rail: buttons step one slide, and disable at each end. */
    function initGallery(host) {
        var track = host.querySelector('.gallery');
        if (!track) return;

        var buttons = Array.prototype.slice.call(host.querySelectorAll('[data-gallery]'));
        if (!buttons.length) return;

        function slideStep() {
            var figure = track.querySelector('figure');
            if (!figure) return track.clientWidth;
            var gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
            /* offsetWidth, not the rendered rect: the focus effect scales the
               slides, and a scaled measure would step short. */
            return figure.offsetWidth + gap;
        }

        function sync() {
            var max = track.scrollWidth - track.clientWidth - 1;
            buttons.forEach(function (button) {
                var forward = button.getAttribute('data-gallery') === 'next';
                button.disabled = forward ? track.scrollLeft >= max : track.scrollLeft <= 1;
            });
        }

        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                var forward = button.getAttribute('data-gallery') === 'next';
                var max = track.scrollWidth - track.clientWidth;
                var target = track.scrollLeft + (forward ? 1 : -1) * slideStep();
                /* Assign directly: scrollBy() is unreliable while the case
                   study is offscreen. Refresh the button states here because
                   a programmatic jump may not emit a scroll event. */
                track.scrollLeft = Math.max(0, Math.min(target, max));
                sync();
            });
        });

        var focusTicking = false;
        function scheduleFocus() {
            if (focusTicking) return;
            focusTicking = true;
            window.requestAnimationFrame(function () {
                focusTicking = false;
                updateGalleryFocus();
            });
        }

        track.addEventListener('scroll', sync, { passive: true });
        track.addEventListener('scroll', scheduleFocus, { passive: true });
        window.addEventListener('resize', function () {
            sync();
            scheduleFocus();
        }, { passive: true });
        sync();
        updateGalleryFocus();
    }

    /* On wide screens the screens section holds still: scrolling down pushes the
       rail sideways. The pin is a spacer exactly as tall as the travel, so the
       moment the last slide arrives the page carries on down normally. */
    function initScreensPin() {
        var pin = document.getElementById('screensPin');
        var stage = pin && pin.querySelector('.screens-stage');
        var wrap = document.querySelector('#screensMount .gallery-wrap');
        var track = wrap && wrap.querySelector('.gallery');
        if (!pin || !stage || !track) return;

        var wide = window.matchMedia('(min-width: 900px)');
        var header = document.querySelector('.site-header');
        var hint = wrap.querySelector('.gallery-hint');
        var hintText = hint ? hint.textContent : '';
        var active = false;

        function travel() {
            return Math.max(0, track.scrollWidth - track.clientWidth);
        }

        function sync() {
            if (!active) return;
            var span = travel();
            if (span <= 0) return;

            var headerH = header ? header.offsetHeight : 0;
            var progress = (headerH - pin.getBoundingClientRect().top) / span;
            progress = Math.max(0, Math.min(1, progress));
            track.scrollLeft = progress * span;
        }

        function off() {
            active = false;
            pin.style.height = '';
            track.classList.remove('is-driven');
            wrap.classList.remove('is-driven');
            if (hint) hint.textContent = hintText;
            syncScreensPin = function () {};
        }

        function refresh() {
            var wants = motionOK && wide.matches;
            var span = wants ? travel() : 0;

            if (!wants) {
                off();
                return;
            }

            /* A resized layout can be a beat away from its final width; try
               once more rather than leaving the pin switched off. */
            if (span < 80) {
                off();
                window.setTimeout(function () {
                    if (!active && motionOK && wide.matches && travel() >= 80) refresh();
                }, 220);
                return;
            }

            active = true;
            pin.style.height = Math.round(stage.offsetHeight + span) + 'px';
            track.classList.add('is-driven');
            wrap.classList.add('is-driven');
            if (hint) hint.textContent = 'Scroll to move through the screens';
            syncScreensPin = sync;
            sync();
        }

        var refreshTimer = 0;
        var scheduleRefresh = function () {
            window.clearTimeout(refreshTimer);
            refreshTimer = window.setTimeout(refresh, 140);
        };

        window.addEventListener('resize', scheduleRefresh, { passive: true });
        if (wide.addEventListener) wide.addEventListener('change', scheduleRefresh);
        else if (wide.addListener) wide.addListener(scheduleRefresh);

        refresh();
    }

    function videoPanel(project) {
        return '' +
            '<div class="project-video reveal">' +
                '<video controls playsinline preload="none" poster="steizen-shot.jpg"' +
                    ' controlslist="nodownload noplaybackrate" disablepictureinpicture>' +
                    '<source src="steizen-demo.mp4" type="video/mp4">' +
                    'Your browser does not support the video tag.' +
                '</video>' +
            '</div>';
    }

    function projectMarkup(project, index) {
        var tags = (project.tags || []).map(function (tag) {
            return '<span class="tag">' + escapeHtml(tag) + '</span>';
        }).join('');

        if (project.status) {
            tags += '<span class="tag tag-status">' + escapeHtml(project.status) + '</span>';
        }

        var metrics = '';
        if (project.metrics && project.metrics.length) {
            metrics = '<div class="project-metrics" data-stagger>' + project.metrics.map(function (metric) {
                return '' +
                    '<div class="metric">' +
                        '<span class="metric-value">' + escapeHtml(metric.value) + '</span>' +
                        '<span class="metric-label">' + escapeHtml(metric.label) + '</span>' +
                    '</div>';
            }).join('') + '</div>';
        }

        var features = (project.features || []).map(function (feature) {
            return '<li>' + escapeHtml(feature) + '</li>';
        }).join('');

        var tech = (project.tech || []).map(function (item) {
            return '<li>' + escapeHtml(item) + '</li>';
        }).join('');

        var results = (project.results || []).map(function (item) {
            return '<li>' + escapeHtml(item) + '</li>';
        }).join('');

        var second = tech
            ? '<div class="project-col"><h4>Stack</h4><ul class="stack-list" data-stagger>' + tech + '</ul></div>'
            : (results ? '<div class="project-col"><h4>Backtest results</h4><ul class="dash-list" data-stagger>' + results + '</ul></div>' : '');

        var note = project.note
            ? '<p class="project-note">' + escapeHtml(project.note) + '</p>'
            : '';

        var liveUrl = safeUrl(project.url);
        var live = liveUrl
            ? '<a class="project-live" href="' + escapeHtml(liveUrl) + '" target="_blank" rel="noopener noreferrer">View live app <span aria-hidden="true">↗</span></a>'
            : '';

        /* Local captures are filenames, not absolute URLs: accept only a
           single image file at the site root or in assets/. */
        var shotFile = typeof project.image === 'string' ? project.image.trim() : '';
        if (shotFile && !/^(?:assets\/)?[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|avif)$/i.test(shotFile)) shotFile = '';
        var shot = shotFile
            ? '<figure class="project-shot">' +
                '<img src="' + escapeHtml(shotFile) + '" alt="' + escapeHtml(project.imageAlt || ((project.title || 'Project') + ' screenshot')) + '" width="1280" height="900" loading="lazy" decoding="async">' +
                (project.imageCaption ? '<figcaption>' + escapeHtml(project.imageCaption) + '</figcaption>' : '') +
            '</figure>'
            : '';

        /* A project can carry its own captures; the demo video still has its
           own section further down the page. */
        var media = '';
        if (project.visual === 'sih' || project.id === 'sih') {
            media = terminalPanel(project);
        }
        if (project.gallery && project.gallery.length) {
            media += projectGallery(project);
        }

        return '' +
            '<article class="project reveal">' +
                '<div class="project-head">' +
                    '<p class="project-index">' + String(index + 1).padStart(2, '0') + '</p>' +
                    '<div class="project-heading">' +
                        '<div class="project-tags">' + tags + '</div>' +
                        '<h3>' + escapeHtml(project.title || '') + '</h3>' +
                        '<p class="project-role">' + escapeHtml(project.role || '') + '</p>' +
                        '<p class="project-summary">' + escapeHtml(project.desc || '') + '</p>' +
                        live +
                        metrics +
                        note +
                    '</div>' +
                '</div>' +
                shot +
                '<div class="project-columns">' +
                    '<div class="project-col"><h4>What it does</h4><ul class="dash-list" data-stagger>' + features + '</ul></div>' +
                    second +
                '</div>' +
                (media ? '<div class="project-media">' + media + '</div>' : '') +
            '</article>';
    }

    /* The demo recording keeps its own full-width section below the work. */
    function mountMedia(projects) {
        var videoHost = document.getElementById('demoMount');

        function firstWith(key) {
            for (var i = 0; i < projects.length; i += 1) {
                if (projects[i] && projects[i][key]) return projects[i];
            }
            return null;
        }

        function fill(host, html) {
            if (!host) return;
            if (!html) {
                var section = host.closest('section');
                if (section) section.hidden = true;
                return;
            }
            host.innerHTML = html;
            activate(host);
            initGallery(host);
            initScreensPin();
        }

        var videoProject = firstWith('hasVideo');

        fill(videoHost, videoProject ? videoPanel(videoProject) : '');
    }

    function renderProjects(projects) {
        var mount = document.getElementById('workMount');
        if (!mount) return;

        if (!projects || !projects.length) {
            mount.innerHTML = '<p class="section-note">Project write-ups are on the way. Meanwhile, the code is on <a class="accent" href="https://github.com/shariprasath570-cell" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>';
            return;
        }

        mount.innerHTML = projects.map(projectMarkup).join('');
        activate(mount);
        initGallery(mount);
        mountMedia(projects);
    }

    /* ---------------- hydrate ---------------- */

    function hydrate(data) {
        var profile = data.profile || {};
        var contact = data.contact || {};

        if (profile.intro) text('[data-field="intro"]', profile.intro);

        var fullName = [profile.name, profile.lastName].filter(Boolean).join(' ').trim();
        if (fullName) {
            text('[data-field="brand-name"]', fullName);
            text('[data-field="figure-name"]', fullName);
        }
        if (profile.name) text('[data-field="initials"]', (profile.name[0] || '') + (profile.lastName ? profile.lastName[0] : ''));

        /* Only a plain address reaches the mailto: link, so a crafted content
           value cannot turn it into something else. */
        var email = contact.email ? String(contact.email).trim() : '';
        if (email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) email = '';
        if (email) {
            document.querySelectorAll('[data-contact="email"]').forEach(function (link) {
                link.setAttribute('href', 'mailto:' + email);
            });
        }

        var linkedin = safeUrl(contact.linkedin);
        if (linkedin) {
            document.querySelectorAll('[data-contact="linkedin"]').forEach(function (link) {
                link.setAttribute('href', linkedin);
            });
        }

        var projects = Array.isArray(data.projects) && data.projects.length
            ? data.projects
            : LAST_RESORT.projects;

        renderProjects(projects);
    }

    /* ---------------- media guard ---------------- */

    /* Deterrents for the project captures: no context menu, no drag-to-desktop,
       no selection, and a blur while another window holds focus. Nothing here
       can stop an OS screenshot or a screen recorder, and it is not meant to. */
    function guardMedia() {
        var selector = '.gallery, .project-video';

        function inMedia(target) {
            return target && target.closest && target.closest(selector);
        }

        document.addEventListener('contextmenu', function (event) {
            if (inMedia(event.target)) event.preventDefault();
        });

        document.addEventListener('dragstart', function (event) {
            if (inMedia(event.target)) event.preventDefault();
        });

        document.addEventListener('selectstart', function (event) {
            if (inMedia(event.target)) event.preventDefault();
        });

        function shield() {
            document.body.classList.add('media-shielded');
        }

        function unshield() {
            document.body.classList.remove('media-shielded');
        }

        window.addEventListener('blur', shield);
        window.addEventListener('focus', unshield);
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) shield();
            else unshield();
        });
    }

    /* ---------------- theme ---------------- */

    var themeButton = document.getElementById('themeToggle');
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    var lightQuery = window.matchMedia('(prefers-color-scheme: light)');

    function syncTheme() {
        var light = root.dataset.theme === 'light';
        if (themeButton) {
            themeButton.setAttribute('aria-pressed', light ? 'true' : 'false');
            themeButton.setAttribute('aria-label', light ? 'Switch to the dark theme' : 'Switch to the light theme');
            themeButton.setAttribute('title', light ? 'Switch to dark' : 'Switch to light');
        }
        if (themeMeta) themeMeta.setAttribute('content', light ? '#f7f8f5' : '#090b0e');
    }

    function applyTheme(next) {
        root.dataset.theme = next;
        try {
            localStorage.setItem('hs-theme', next);
        } catch (error) {
            /* Private mode: the choice just won't persist. */
        }
        syncTheme();
    }

    function toggleTheme(event) {
        var next = root.dataset.theme === 'light' ? 'dark' : 'light';

        if (!document.startViewTransition || !motionOK || !themeButton) {
            applyTheme(next);
            return;
        }

        var rect = themeButton.getBoundingClientRect();
        var x = event && typeof event.clientX === 'number' && event.clientX ? event.clientX : rect.left + rect.width / 2;
        var y = event && typeof event.clientY === 'number' && event.clientY ? event.clientY : rect.top + rect.height / 2;
        var radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

        /* Dark to light: the new theme opens outward from the button.
           Light to dark: the old theme collapses back into it. */
        var collapsing = next === 'dark';
        if (collapsing) root.classList.add('theme-collapse');

        var transition = document.startViewTransition(function () {
            applyTheme(next);
        });

        var cleanup = function () {
            root.classList.remove('theme-collapse');
        };
        transition.finished.then(cleanup, cleanup);

        transition.ready.then(function () {
            var start = collapsing ? radius + 'px' : '0px';
            var end = collapsing ? '0px' : radius + 'px';

            /* `fill: forwards` holds the last frame. Without it the clip snaps
               back to full screen between the animation ending and the snapshot
               being removed, which flashes the old theme for a frame or two. */
            root.animate({
                clipPath: [
                    'circle(' + start + ' at ' + x + 'px ' + y + 'px)',
                    'circle(' + end + ' at ' + x + 'px ' + y + 'px)'
                ]
            }, {
                duration: 1200,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'forwards',
                pseudoElement: collapsing ? '::view-transition-old(root)' : '::view-transition-new(root)'
            });
        }).catch(function () {
            /* Older Chromium: the theme still switched, just without the wipe. */
        });
    }

    if (themeButton) {
        themeButton.addEventListener('click', toggleTheme);
        syncTheme();

        // Follow the OS only while the visitor has not chosen a theme.
        var onSchemeChange = function (event) {
            var stored = null;
            try {
                stored = localStorage.getItem('hs-theme');
            } catch (error) { /* ignore */ }
            if (stored) return;
            applyTheme(event.matches ? 'light' : 'dark');
        };
        if (lightQuery.addEventListener) lightQuery.addEventListener('change', onSchemeChange);
        else if (lightQuery.addListener) lightQuery.addListener(onSchemeChange);
    }

    /* ---------------- magnetic buttons ---------------- */

    function initMagnets() {
        if (!finePointer || !motionOK) return;

        document.querySelectorAll('.btn').forEach(function (btn) {
            btn.addEventListener('pointermove', function (event) {
                var rect = btn.getBoundingClientRect();
                var dx = (event.clientX - (rect.left + rect.width / 2)) * 0.16;
                var dy = (event.clientY - (rect.top + rect.height / 2)) * 0.26;
                btn.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)';
            });

            btn.addEventListener('pointerleave', function () {
                btn.style.transform = '';
            });
        });
    }

    /* ---------------- pointer glow ---------------- */

    function initPointerGlow() {
        var glow = document.querySelector('.cursor-glow');
        if (!glow || !finePointer || !motionOK) return;

        window.addEventListener('pointermove', function (event) {
            if (event.pointerType === 'touch') return;

            glow.style.setProperty('--gx', ((event.clientX / window.innerWidth) * 100).toFixed(2) + '%');
            glow.style.setProperty('--gy', ((event.clientY / window.innerHeight) * 100).toFixed(2) + '%');
        }, { passive: true });
    }

    /* The background mind map: root → branches → milestones, joined by curves
       measured from the laid-out boxes and redrawn whenever the map resizes. */
    function initMindmap() {
        var map = document.getElementById('mindmap');
        if (!map) return;

        var svg = map.querySelector('.mindmap-links');
        if (!svg) return;

        var wide = window.matchMedia('(min-width: 940px)');
        var animated = false;

        /* Layout offsets, not rendered rects: the reveal animation translates
           these nodes, and a measured rect would drag the curves with it. */
        function boxOf(el) {
            return {
                x: el.offsetLeft + map.clientLeft,
                y: el.offsetTop + map.clientTop,
                w: el.offsetWidth,
                h: el.offsetHeight
            };
        }

        function curve(from, to) {
            var x1 = from.x + from.w;
            var y1 = from.y + from.h / 2;
            var x2 = to.x;
            var y2 = to.y + to.h / 2;
            var bend = Math.max(24, (x2 - x1) * 0.55);
            return 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
                'C' + (x1 + bend).toFixed(1) + ' ' + y1.toFixed(1) +
                ', ' + (x2 - bend).toFixed(1) + ' ' + y2.toFixed(1) +
                ', ' + x2.toFixed(1) + ' ' + y2.toFixed(1);
        }

        function node(id) {
            return map.querySelector('[data-mm="' + id + '"]');
        }

        function draw(animate) {
            if (!wide.matches) {
                svg.innerHTML = '';
                return;
            }

            var root = node('root');
            if (!root) return;

            var origin = boxOf(root);
            var branches = {};
            var marks = '';

            ['b1', 'b2'].forEach(function (id) {
                var el = node(id);
                if (!el) return;
                branches[id] = boxOf(el);
                marks += '<path class="mm-link" d="' + curve(origin, branches[id]) + '"></path>';
                marks += '<circle class="mm-node-dot" cx="' + (branches[id].x - 1).toFixed(1) +
                    '" cy="' + (branches[id].y + branches[id].h / 2).toFixed(1) + '" r="3.5"></circle>';
            });

            [['b1', 'l1'], ['b1', 'l2'], ['b2', 'l3'], ['b2', 'l4']].forEach(function (pair) {
                var el = node(pair[1]);
                if (!el || !branches[pair[0]]) return;
                var target = boxOf(el);
                marks += '<path class="mm-link mm-link--leaf" d="' + curve(branches[pair[0]], target) + '"></path>';
            });

            svg.setAttribute('width', String(Math.round(map.clientWidth)));
            svg.setAttribute('height', String(Math.round(map.clientHeight)));
            svg.innerHTML = marks;

            Array.prototype.forEach.call(svg.querySelectorAll('.mm-link'), function (path, index) {
                var length = 0;
                try {
                    length = path.getTotalLength();
                } catch (error) {
                    length = 0;
                }
                if (!length) return;

                path.style.strokeDasharray = length + ' ' + length;

                if (animate) {
                    path.style.strokeDashoffset = String(length);
                    window.requestAnimationFrame(function () {
                        path.style.transitionDelay = (0.1 + index * 0.08).toFixed(2) + 's';
                        path.style.strokeDashoffset = '0';
                    });
                } else {
                    path.style.strokeDashoffset = '0';
                }
            });
        }

        draw(false);

        /* The curves trace themselves the first time the map is reached. */
        if ('IntersectionObserver' in window) {
            var watcher = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting || animated) return;
                    animated = true;
                    draw(motionOK);
                });
            }, { threshold: 0.2 });
            watcher.observe(map);
        }

        var resizeTimer = 0;
        window.addEventListener('resize', function () {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(function () {
                draw(false);
            }, 150);
        }, { passive: true });

        if (wide.addEventListener) {
            wide.addEventListener('change', function () {
                draw(false);
            });
        }

        /* Web fonts land after first paint and can shift the boxes. */
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                draw(false);
            });
        }
    }

    function initScrollHint() {
        var hint = document.querySelector('.scroll-hint');
        if (!hint) return;

        var update = function () {
            hint.classList.toggle('is-gone', window.scrollY > 80);
        };

        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    initMagnets();
    initPointerGlow();
    initMindmap();
    initScrollHint();
    guardMedia();
    activate(document);
    onScrollFrame();

    loadContent().then(function (data) {
        hydrate(data || LAST_RESORT);
    }).catch(function () {
        hydrate(LAST_RESORT);
    });
})();
