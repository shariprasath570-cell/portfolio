/* ==========================================================================
   Portfolio admin
   A draft model (data-path bindings) rather than scraping the DOM on save:
   every control writes straight into `draft`, so the editor can re-render,
   reorder or delete a project without losing what was typed.
   ========================================================================== */

(function () {
    'use strict';

    /* A local convenience gate, not authentication: anyone who can load this
       page can read this line. The deployed site 404s this file, and cloud
       writes still need the JSONBin key, which never ships with the site. */
    var PASSWORD = 'hari2026';
    var SESSION_KEY = 'hs-admin-open';
    var THEME_KEY = 'hs-theme';
    var STORE_KEY = 'portfolio-content';
    var MAX_IMPORT_BYTES = 512 * 1024;

    var SAVE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>';
    var UP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m18 15-6-6-6 6"/></svg>';
    var DOWN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
    var COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    var TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
    var PLUS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>';
    var MINUS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14"/></svg>';
    var CHEVRON_ICON = '<svg class="proj-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';

    var VIEW_TITLES = {
        profile: 'Profile',
        contact: 'Contact',
        projects: 'Projects',
        settings: 'Settings'
    };

    var FALLBACK = {
        profile: {
            name: '',
            lastName: '',
            role: '',
            intro: '',
            photo: 'assets/profile.webp',
            openToWork: true,
            freelance: true
        },
        contact: { email: '', whatsapp: '', linkedin: '' },
        projects: []
    };

    var draft = null;
    var savedJson = '';
    var savedAt = null;
    var savedScope = 'device';
    var view = 'profile';
    var openCards = {};
    var toastTimer = 0;

    function $(id) {
        return document.getElementById(id);
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function getPath(target, path) {
        return path.split('.').reduce(function (node, key) {
            return node == null ? undefined : node[key];
        }, target);
    }

    function setPath(target, path, value) {
        var keys = path.split('.');
        var last = keys.pop();
        var node = target;
        keys.forEach(function (key, index) {
            if (node[key] == null || typeof node[key] !== 'object') {
                node[key] = /^\d+$/.test(keys[index + 1] || '') ? [] : {};
            }
            node = node[key];
        });
        node[last] = value;
    }

    /* ---------------- toast & state ---------------- */

    function toast(message, tone) {
        var el = $('toast');
        if (!el) return;
        el.textContent = message;
        el.className = 'toast show' + (tone ? ' is-' + tone : '');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () {
            el.className = 'toast' + (tone ? ' is-' + tone : '');
        }, 3200);
    }

    function dirty() {
        return !!draft && JSON.stringify(draft) !== savedJson;
    }

    var SCOPE_LABEL = {
        cloud: 'Saved to cloud',
        device: 'Saved on device',
        file: 'Loaded from file',
        new: 'Nothing saved yet'
    };

    function refreshState() {
        var state = $('saveState');

        var cfg = cloudCfg();
        $('sideState').textContent = cfg.apiKey && cfg.binId ? 'Cloud linked' : 'Local draft';
        $('sideSaved').textContent = savedAt
            ? 'saved ' + savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'no save yet';

        if (!draft) {
            state.textContent = 'Loading';
            state.className = 'state';
            $('saveBtn').disabled = true;
            return;
        }

        var isDirty = dirty();
        state.textContent = isDirty ? 'Unsaved changes' : (SCOPE_LABEL[savedScope] || 'Saved');
        state.className = 'state' + (isDirty ? ' is-dirty' : ' is-saved');
        $('saveBtn').disabled = !isDirty;
    }

    /* ---------------- data ---------------- */

    function cloudCfg() {
        var apiKey = '';
        var binId = '';
        try {
            apiKey = localStorage.getItem('jb-api') || '';
            binId = localStorage.getItem('jb-bin') || '';
        } catch (error) { /* private mode */ }
        return { apiKey: apiKey, binId: binId };
    }

    function binUrl(binId) {
        return 'https://api.jsonbin.io/v3/b/' + encodeURIComponent(binId);
    }

    function normalise(raw) {
        var data = raw && typeof raw === 'object' ? clone(raw) : {};
        data.profile = data.profile && typeof data.profile === 'object' ? data.profile : {};
        data.contact = data.contact && typeof data.contact === 'object' ? data.contact : {};
        data.projects = Array.isArray(data.projects) ? data.projects : [];

        /* Drop anything that is not a plain object: a stray null or string in
           a hand-edited file would otherwise become a blank phantom project. */
        data.projects = data.projects.filter(function (project) {
            return project && typeof project === 'object' && !Array.isArray(project);
        }).map(function (project, index) {
            var item = project;
            item.id = String(item.id || 'project-' + (index + 1));
            item.title = String(item.title || '');
            item.tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
            item.features = Array.isArray(item.features) ? item.features.map(String) : [];
            item.tech = Array.isArray(item.tech) ? item.tech.map(String) : [];
            item.results = Array.isArray(item.results) ? item.results.map(String) : [];
            item.metrics = Array.isArray(item.metrics) ? item.metrics.map(function (metric) {
                return {
                    value: String((metric && metric.value) || ''),
                    label: String((metric && metric.label) || '')
                };
            }) : [];
            return item;
        });

        return data;
    }

    function loadCloud() {
        var cfg = cloudCfg();
        if (!cfg.apiKey || !cfg.binId) return Promise.resolve(null);

        return fetch(binUrl(cfg.binId) + '/latest', {
            headers: { 'X-Master-Key': cfg.apiKey },
            cache: 'no-store'
        }).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        }).then(function (payload) {
            return payload && payload.record ? payload.record : null;
        }).catch(function () {
            return null;
        });
    }

    function loadData() {
        return loadCloud().then(function (cloud) {
            if (cloud) return { source: 'cloud', data: cloud };

            try {
                var stored = localStorage.getItem(STORE_KEY);
                if (stored) {
                    var parsed = JSON.parse(stored);
                    if (parsed && typeof parsed === 'object') return { source: 'device', data: parsed };
                }
            } catch (error) { /* bad local snapshot */ }

            return fetch('content.json', { cache: 'no-store' })
                .then(function (response) {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.json();
                })
                .then(function (data) {
                    return { source: 'file', data: data };
                })
                .catch(function () {
                    return { source: 'blank', data: FALLBACK };
                });
        });
    }

    /* ---------------- rendering ---------------- */

    function fillControls() {
        Array.prototype.forEach.call(document.querySelectorAll('[data-path]'), function (input) {
            var value = getPath(draft, input.dataset.path);
            if (input.dataset.type === 'bool') {
                input.checked = !!value;
            } else {
                input.value = value == null ? '' : String(value);
            }
        });

        var cfg = cloudCfg();
        $('cfg-api').value = cfg.apiKey;
        $('cfg-bin').value = cfg.binId;
        updateCloudState();
    }

    function updateCloudState() {
        var cfg = cloudCfg();
        var el = $('cloudState');
        if (cfg.apiKey && cfg.binId) {
            el.textContent = 'Cloud linked · bin ' + cfg.binId.slice(0, 6) + '…';
            el.className = 'cloud-state is-linked';
        } else {
            el.textContent = 'Cloud not linked — saving keeps the draft in this browser';
            el.className = 'cloud-state';
        }
    }

    function metricsMarkup(project, index) {
        var rows = project.metrics.map(function (metric, metricIndex) {
            return '' +
                '<div class="metric-row">' +
                    '<input type="text" data-path="projects.' + index + '.metrics.' + metricIndex + '.value" value="' + esc(metric.value) + '" placeholder="1,118" aria-label="Metric ' + (metricIndex + 1) + ' value">' +
                    '<input type="text" data-path="projects.' + index + '.metrics.' + metricIndex + '.label" value="' + esc(metric.label) + '" placeholder="Trades" aria-label="Metric ' + (metricIndex + 1) + ' label">' +
                    '<button type="button" class="icon-btn" data-act="remove-metric" data-index="' + index + '" data-metric="' + metricIndex + '" aria-label="Remove metric">' + MINUS_ICON + '</button>' +
                '</div>';
        }).join('');

        if (!rows) {
            rows = '<p class="metric-empty">No metrics — the numbers row stays hidden on the site.</p>';
        }

        return rows +
            '<button type="button" class="add-row" data-act="add-metric" data-index="' + index + '">' + PLUS_ICON + ' Add metric</button>';
    }

    function projectMarkup(project, index) {
        var isOpen = !!openCards[index];
        var title = project.title || 'Untitled project';

        return '' +
            '<article class="proj' + (isOpen ? ' is-open' : '') + '" data-card="' + index + '">' +
                '<button type="button" class="proj-head" data-act="toggle" data-index="' + index + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
                    '<span class="proj-index">' + String(index + 1).padStart(2, '0') + '</span>' +
                    '<span class="proj-title">' + esc(title) + '</span>' +
                    '<span class="proj-tag">' + esc(project.status || 'no status') + '</span>' +
                    CHEVRON_ICON +
                '</button>' +

                '<div class="proj-body">' +
                    '<div class="group">' +
                        '<p class="group-title">Identity</p>' +
                        '<div class="field">' +
                            '<label>Title</label>' +
                            '<input type="text" data-path="projects.' + index + '.title" value="' + esc(project.title) + '">' +
                        '</div>' +
                        '<div class="grid-2">' +
                            '<div class="field">' +
                                '<label>Status</label>' +
                                '<input type="text" data-path="projects.' + index + '.status" value="' + esc(project.status) + '" placeholder="In progress">' +
                            '</div>' +
                            '<div class="field">' +
                                '<label>Slug / id</label>' +
                                '<input type="text" data-path="projects.' + index + '.id" value="' + esc(project.id) + '">' +
                            '</div>' +
                        '</div>' +
                        '<div class="field">' +
                            '<label>Role line</label>' +
                            '<input type="text" data-path="projects.' + index + '.role" value="' + esc(project.role) + '">' +
                        '</div>' +
                        '<div class="field">' +
                            '<label>Tags</label>' +
                            '<input type="text" data-list="projects.' + index + '.tags" value="' + esc(project.tags.join(', ')) + '" placeholder="FinTech, AI / RAG">' +
                        '</div>' +
                    '</div>' +

                    '<div class="group">' +
                        '<p class="group-title">Copy</p>' +
                        '<div class="field">' +
                            '<label>Summary</label>' +
                            '<textarea data-path="projects.' + index + '.desc">' + esc(project.desc) + '</textarea>' +
                        '</div>' +
                        '<div class="field">' +
                            '<label>What it does</label>' +
                            '<textarea data-lines="projects.' + index + '.features" placeholder="One feature per line">' + esc(project.features.join('\n')) + '</textarea>' +
                        '</div>' +
                        '<div class="field">' +
                            '<label>Stack</label>' +
                            '<textarea data-lines="projects.' + index + '.tech" placeholder="One technology per line">' + esc(project.tech.join('\n')) + '</textarea>' +
                        '</div>' +
                        '<div class="field">' +
                            '<label>Results</label>' +
                            '<textarea data-lines="projects.' + index + '.results" placeholder="One result per line">' + esc(project.results.join('\n')) + '</textarea>' +
                        '</div>' +
                        '<div class="field">' +
                            '<label>Footnote</label>' +
                            '<input type="text" data-path="projects.' + index + '.note" value="' + esc(project.note) + '" placeholder="Backtested results, not live trading performance.">' +
                        '</div>' +
                    '</div>' +

                    '<div class="group">' +
                        '<p class="group-title">Metrics</p>' +
                        metricsMarkup(project, index) +
                    '</div>' +

                    '<div class="group">' +
                        '<p class="group-title">Media &amp; visual</p>' +
                        '<div class="field">' +
                            '<label>Visual</label>' +
                            '<input type="text" data-path="projects.' + index + '.visual" value="' + esc(project.visual) + '" placeholder="none">' +
                            '<p class="hint"><span class="mono">sih</span> renders the terminal panel; <span class="mono">none</span> leaves the case study text-only.</p>' +
                        '</div>' +
                        '<div class="switch-row">' +
                            '<label class="check">' +
                                '<input type="checkbox" data-path="projects.' + index + '.hasGallery" data-type="bool"' + (project.hasGallery ? ' checked' : '') + '>' +
                                '<span>Screenshots section</span>' +
                            '</label>' +
                            '<label class="check">' +
                                '<input type="checkbox" data-path="projects.' + index + '.hasVideo" data-type="bool"' + (project.hasVideo ? ' checked' : '') + '>' +
                                '<span>Video section</span>' +
                            '</label>' +
                        '</div>' +
                    '</div>' +

                    '<div class="danger-zone">' +
                        '<p>Move, duplicate or delete this project.</p>' +
                        '<div class="projects-tools">' +
                            '<button type="button" class="icon-btn" data-act="up" data-index="' + index + '" aria-label="Move project up"' + (index === 0 ? ' disabled' : '') + '>' + UP_ICON + '</button>' +
                            '<button type="button" class="icon-btn" data-act="down" data-index="' + index + '" aria-label="Move project down"' + (index === draft.projects.length - 1 ? ' disabled' : '') + '>' + DOWN_ICON + '</button>' +
                            '<button type="button" class="icon-btn" data-act="duplicate" data-index="' + index + '" aria-label="Duplicate project">' + COPY_ICON + '</button>' +
                            '<button type="button" class="icon-btn" data-act="delete" data-index="' + index + '" aria-label="Delete project">' + TRASH_ICON + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</article>';
    }

    function renderProjects() {
        var list = $('projectsList');
        var projects = draft.projects || [];

        $('navProjectsCount').textContent = String(projects.length);
        $('projectsState').textContent = projects.length === 1 ? '1 project' : projects.length + ' projects';

        if (!projects.length) {
            list.innerHTML = '' +
                '<div class="empty-state">' +
                    '<span class="mono">No projects yet</span>' +
                    '<p>Add one and it becomes a case study on the work page.</p>' +
                '</div>';
            return;
        }

        list.innerHTML = projects.map(projectMarkup).join('');
    }

    function renderAll() {
        fillControls();
        renderProjects();
        refreshState();
    }

    /* ---------------- editing ---------------- */

    function syncCardLabels() {
        Array.prototype.forEach.call(document.querySelectorAll('[data-card]'), function (card) {
            var index = Number(card.dataset.card);
            var project = draft.projects[index];
            if (!project) return;
            card.querySelector('.proj-title').textContent = project.title || 'Untitled project';
            card.querySelector('.proj-tag').textContent = project.status || 'no status';
        });
    }

    function onEdit(event) {
        var input = event.target;
        if (!input || !draft) return;

        if (input.dataset.path) {
            var value = input.dataset.type === 'bool'
                ? !!input.checked
                : input.value;

            setPath(draft, input.dataset.path, value);

            if (/^projects\.\d+\.(title|status)$/.test(input.dataset.path)) {
                syncCardLabels();
            }
        } else if (input.dataset.list) {
            var items = input.value.split(',').map(function (item) {
                return item.trim();
            }).filter(Boolean);
            setPath(draft, input.dataset.list, items);
        } else if (input.dataset.lines) {
            var lines = input.value.split('\n').map(function (line) {
                return line.trim();
            }).filter(Boolean);
            setPath(draft, input.dataset.lines, lines);
        } else {
            return;
        }

        refreshState();
    }

    function bindEvents() {
        document.addEventListener('input', onEdit);
        document.addEventListener('change', onEdit);

        document.addEventListener('click', function (event) {
            var button = event.target.closest('[data-act]');
            if (!button) return;

            var action = button.dataset.act;
            var index = Number(button.dataset.index);

            if (action === 'toggle') {
                openCards[index] = !openCards[index];
                var card = document.querySelector('[data-card="' + index + '"]');
                if (card) {
                    card.classList.toggle('is-open', !!openCards[index]);
                }
                button.setAttribute('aria-expanded', openCards[index] ? 'true' : 'false');
                return;
            }

            if (action === 'add-metric') {
                draft.projects[index].metrics.push({ value: '', label: '' });
                openCards[index] = true;
                renderProjects();
                focusCard(index, 'metrics');
                refreshState();
                return;
            }

            if (action === 'remove-metric') {
                draft.projects[index].metrics.splice(Number(button.dataset.metric), 1);
                openCards[index] = true;
                renderProjects();
                refreshState();
                return;
            }

            if (action === 'up' || action === 'down') {
                var to = action === 'up' ? index - 1 : index + 1;
                if (to < 0 || to >= draft.projects.length) return;
                var moved = draft.projects.splice(index, 1)[0];
                draft.projects.splice(to, 0, moved);
                openCards[to] = true;
                delete openCards[index];
                renderProjects();
                refreshState();
                return;
            }

            if (action === 'duplicate') {
                var copy = clone(draft.projects[index]);
                copy.id = copy.id + '-copy-' + Date.now().toString(36);
                copy.title = (copy.title || 'Untitled project') + ' (copy)';
                draft.projects.splice(index + 1, 0, copy);
                openCards[index + 1] = true;
                renderProjects();
                refreshState();
                toast('Project duplicated', 'ok');
                return;
            }

            if (action === 'delete') {
                var project = draft.projects[index];
                if (!window.confirm('Delete "' + (project.title || 'this project') + '"? This removes it from the draft until you save.')) return;
                draft.projects.splice(index, 1);
                delete openCards[index];
                renderProjects();
                refreshState();
                return;
            }
        });

        Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (button) {
            button.addEventListener('click', function () {
                setView(button.dataset.view);
            });
        });

        /* A link like admin.html#projects pasted into an already-open tab only
           fires hashchange, so follow it instead of ignoring it. */
        window.addEventListener('hashchange', function () {
            var next = (window.location.hash || '').replace('#', '');
            if (!VIEW_TITLES[next] || next === view) return;
            if ($('appView').classList.contains('hidden')) return;
            setView(next);
        });

        $('addProject').addEventListener('click', function () {
            draft.projects.push({
                id: 'project-' + Date.now().toString(36),
                tags: [],
                status: 'In progress',
                title: 'New project',
                role: '',
                desc: '',
                features: [],
                tech: [],
                results: [],
                metrics: [],
                note: '',
                visual: 'none',
                hasVideo: false,
                hasGallery: false
            });
            openCards[draft.projects.length - 1] = true;
            renderProjects();
            refreshState();

            var card = document.querySelector('[data-card="' + (draft.projects.length - 1) + '"]');
            if (card) {
                card.scrollIntoView({ block: 'center', behavior: 'smooth' });
                var title = card.querySelector('[data-path$=".title"]');
                if (title) {
                    title.focus();
                    title.select();
                }
            }
        });

        $('saveBtn').addEventListener('click', save);
        $('exportBtn').addEventListener('click', exportJson);
        $('importBtn').addEventListener('click', function () {
            $('importFile').click();
        });
        $('importFile').addEventListener('change', importJson);
        $('saveCfg').addEventListener('click', saveCloudCfg);
        $('testCloud').addEventListener('click', testCloud);
        $('reloadBtn').addEventListener('click', reloadFile);
        $('logoutBtn').addEventListener('click', logout);
        $('themeBtn').addEventListener('click', toggleTheme);
        $('loginForm').addEventListener('submit', onLogin);

        document.addEventListener('keydown', function (event) {
            var mod = event.metaKey || event.ctrlKey;
            if (mod && event.key.toLowerCase() === 's') {
                event.preventDefault();
                if (dirty()) save();
            }
        });

        window.addEventListener('beforeunload', function (event) {
            if (!dirty()) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }

    function focusCard(index, group) {
        var card = document.querySelector('[data-card="' + index + '"]');
        if (!card) return;
        var target = card.querySelector('.group [data-path*=".' + group + '"]') ||
            card.querySelector('input[data-path]');
        if (target) target.focus();
    }

    function setView(next) {
        view = next || 'profile';

        Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (button) {
            var active = button.dataset.view === view;
            button.classList.toggle('is-active', active);
            if (active) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });

        Array.prototype.forEach.call(document.querySelectorAll('.content [data-view]'), function (panel) {
            panel.classList.toggle('hidden', panel.dataset.view !== view);
        });

        $('viewTitle').textContent = VIEW_TITLES[view] || 'Admin';

        if (window.location.hash !== '#' + view) {
            try {
                history.replaceState(null, '', '#' + view);
            } catch (error) { /* file:// */ }
        }
    }

    /* ---------------- save / export / import ---------------- */

    function markSaved(scope) {
        savedJson = JSON.stringify(draft);
        savedAt = new Date();
        savedScope = scope || 'device';
        refreshState();
    }

    function save() {
        if (!draft) return;

        var json = JSON.stringify(draft);
        try {
            localStorage.setItem(STORE_KEY, json);
        } catch (error) {
            toast('This browser refused to store the draft — export it instead', 'error');
            return;
        }

        var cfg = cloudCfg();
        if (!cfg.apiKey || !cfg.binId) {
            markSaved('device');
            toast('Saved on this device — link cloud storage to publish', 'ok');
            return;
        }

        var button = $('saveBtn');
        button.disabled = true;

        fetch(binUrl(cfg.binId), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': cfg.apiKey
            },
            body: json
        }).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            markSaved('cloud');
            toast('Saved to cloud — the live site picks it up on next load', 'ok');
        }).catch(function () {
            markSaved('device');
            toast('Cloud save failed — the draft is kept on this device only', 'error');
        }).then(function () {
            refreshState();
        });
    }

    function exportJson() {
        if (!draft) return;
        var blob = new Blob([JSON.stringify(draft, null, 2) + '\n'], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var stamp = new Date().toISOString().slice(0, 10);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'content-' + stamp + '.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
        toast('Exported content-' + stamp + '.json', 'ok');
    }

    function importJson(event) {
        var file = event.target.files && event.target.files[0];

        /* Cleared first so picking the same file again after an error still
           fires a change event. */
        event.target.value = '';
        if (!file) return;

        if (file.size > MAX_IMPORT_BYTES) {
            toast('That file is over 512 KB — export a fresh copy from this editor', 'error');
            return;
        }

        var reader = new FileReader();
        reader.onload = function () {
            var parsed;
            try {
                parsed = JSON.parse(String(reader.result));
            } catch (error) {
                toast('That file is not valid JSON', 'error');
                return;
            }

            if (!parsed || typeof parsed !== 'object' || !parsed.profile || !Array.isArray(parsed.projects)) {
                toast('Expected an object with profile and projects', 'error');
                return;
            }

            if (dirty() && !window.confirm('Replace the current unsaved draft with this file?')) return;

            draft = normalise(parsed);
            renderAll();
            setView('profile');
            toast('Imported ' + draft.projects.length + ' projects — save to publish', 'ok');
        };
        reader.readAsText(file);
    }

    function reloadFile() {
        if (dirty() && !window.confirm('Throw away the unsaved draft and reload content.json?')) return;

        fetch('content.json', { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (data) {
                draft = normalise(data);
                savedJson = JSON.stringify(draft);
                savedAt = new Date();
                savedScope = 'file';
                renderAll();
                toast('Reloaded content.json', 'ok');
            })
            .catch(function () {
                toast('Could not read content.json — open the site over http, not file://', 'error');
            });
    }

    /* ---------------- cloud settings ---------------- */

    function saveCloudCfg() {
        var apiKey = $('cfg-api').value.trim();
        var binId = $('cfg-bin').value.trim();

        try {
            if (apiKey) localStorage.setItem('jb-api', apiKey);
            else localStorage.removeItem('jb-api');

            if (binId) localStorage.setItem('jb-bin', binId);
            else localStorage.removeItem('jb-bin');
        } catch (error) {
            toast('This browser refused to store the settings', 'error');
            return;
        }

        updateCloudState();
        refreshState();
        toast(apiKey && binId ? 'Cloud settings saved' : 'Cloud settings cleared', 'ok');
    }

    function testCloud() {
        var apiKey = $('cfg-api').value.trim();
        var binId = $('cfg-bin').value.trim();

        if (!apiKey || !binId) {
            toast('Add both the API key and the bin ID first', 'error');
            return;
        }

        toast('Testing connection…');

        fetch(binUrl(binId) + '/latest', {
            headers: { 'X-Master-Key': apiKey },
            cache: 'no-store'
        }).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        }).then(function (payload) {
            var record = payload && payload.record;
            var count = record && Array.isArray(record.projects) ? record.projects.length : 0;
            toast('Connected — the bin holds ' + count + (count === 1 ? ' project' : ' projects'), 'ok');
        }).catch(function (error) {
            toast('Connection failed (' + error.message + ')', 'error');
        });
    }

    /* ---------------- session ---------------- */

    function onLogin(event) {
        event.preventDefault();
        var input = $('password');
        var error = $('loginError');

        if (input.value !== PASSWORD) {
            error.textContent = 'Wrong password.';
            var card = $('loginCard');
            card.classList.remove('shake');
            void card.offsetWidth;
            card.classList.add('shake');
            input.select();
            return;
        }

        error.textContent = '';

        try {
            sessionStorage.setItem(SESSION_KEY, '1');
        } catch (err) { /* private mode */ }

        enterAdmin();
    }

    function enterAdmin() {
        $('loginView').classList.add('hidden');
        $('appView').classList.remove('hidden');

        var start = (window.location.hash || '').replace('#', '');
        setView(VIEW_TITLES[start] ? start : 'profile');

        loadData().then(function (result) {
            draft = normalise(result.data);
            savedJson = JSON.stringify(draft);
            savedAt = result.source === 'blank' ? null : new Date();
            savedScope = result.source === 'blank' ? 'new' : result.source;
            renderAll();
        });
    }

    function logout() {
        if (dirty() && !window.confirm('Log out with unsaved changes? They will be lost.')) return;

        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (error) { /* private mode */ }

        draft = null;
        savedJson = '';
        $('appView').classList.add('hidden');
        $('loginView').classList.remove('hidden');
        $('password').value = '';
        $('loginError').textContent = '';
        $('password').focus();
    }

    /* ---------------- theme ---------------- */

    function toggleTheme() {
        var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch (error) { /* private mode */ }
    }

    /* ---------------- boot ---------------- */

    bindEvents();
    updateCloudState();
    refreshState();

    var alreadyOpen = false;
    try {
        alreadyOpen = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch (error) { /* private mode */ }

    if (alreadyOpen) {
        enterAdmin();
    } else {
        $('password').focus();
    }
})();
