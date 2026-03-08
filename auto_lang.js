(function () {
    'use strict';

    var PLUGIN_NAME = 'auto_lang';

    var STORAGE_KEYS = {
        enabled: 'autolang_enabled',
        audio_lang: 'autolang_audio',
        sub_enabled: 'autolang_sub_enabled',
        sub_lang: 'autolang_subtitle',
        content_detect: 'autolang_content_detect'
    };

    var LANGUAGES = {
        eng: 'English',
        rus: 'Russian',
        ukr: 'Ukrainian',
        spa: 'Spanish',
        fre: 'French',
        ger: 'German',
        ita: 'Italian',
        por: 'Portuguese',
        jpn: 'Japanese',
        kor: 'Korean',
        chi: 'Chinese',
        ara: 'Arabic'
    };

    var ISO_MAP = {
        eng: 'en', en: 'eng',
        rus: 'ru', ru: 'rus',
        ukr: 'uk', uk: 'ukr',
        spa: 'es', es: 'spa',
        fre: 'fr', fr: 'fre',
        ger: 'de', de: 'ger',
        ita: 'it', it: 'ita',
        por: 'pt', pt: 'por',
        jpn: 'ja', ja: 'jpn',
        kor: 'ko', ko: 'kor',
        chi: 'zh', zh: 'chi',
        ara: 'ar', ar: 'ara'
    };

    // ========================
    // Language Matching
    // ========================

    function matchAudioTrack(track, langCode) {
        var lang = (track.language || track.lang || '').toLowerCase().replace(/\d+/g, '').trim();
        var name = (track.name || track.label || '').toLowerCase();
        var fullName = (LANGUAGES[langCode] || '').toLowerCase();
        var shortCode = ISO_MAP[langCode] || '';

        if (lang === langCode || lang === shortCode) return 3;
        if (fullName && name.indexOf(fullName) >= 0) return 2;
        if (new RegExp('\\b' + langCode + '\\b', 'i').test(name)) return 1;

        return 0;
    }

    function matchSubtitleByLabel(sub, langCode) {
        var label = (sub.label || '').toLowerCase();
        if (!label) return 0;

        var fullName = (LANGUAGES[langCode] || '').toLowerCase();
        var shortCode = ISO_MAP[langCode] || langCode;

        if (fullName && label.indexOf(fullName) >= 0) return 3;
        if (new RegExp('\\b' + langCode + '\\b', 'i').test(label)) return 2;
        if (new RegExp('\\b' + shortCode + '\\b', 'i').test(label)) return 1;

        return 0;
    }

    // ========================
    // Content-Based Detection
    // ========================

    function analyzeText(text) {
        var clean = text
            .replace(/\d{1,2}:\d{2}:\d{2}[.,]\d{2,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[.,]\d{2,3}/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\{[^}]+\}/g, '')
            .replace(/\d+/g, '')
            .trim();

        if (clean.length < 20) return null;

        var totalChars = clean.replace(/\s/g, '').length;
        if (totalChars === 0) return null;

        var cyrillicCount = (clean.match(/[\u0400-\u04FF]/g) || []).length;
        var latinCount = (clean.match(/[a-zA-Z]/g) || []).length;
        var cjkCount = (clean.match(/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g) || []).length;
        var arabicCount = (clean.match(/[\u0600-\u06FF]/g) || []).length;

        if (cyrillicCount / totalChars > 0.3) return 'rus';
        if (cjkCount / totalChars > 0.1) return 'chi';
        if (arabicCount / totalChars > 0.2) return 'ara';

        if (latinCount / totalChars > 0.5) {
            var words = clean.toLowerCase().split(/\s+/);
            var engWords = ['the', 'is', 'you', 'that', 'it', 'and', 'for', 'are', 'was', 'not', 'have', 'this', 'will', 'your', 'from'];
            var engHits = 0;
            for (var i = 0; i < words.length; i++) {
                if (engWords.indexOf(words[i]) >= 0) engHits++;
            }
            if (engHits >= 3 || (words.length > 10 && engHits / words.length > 0.04)) return 'eng';

            var spaWords = ['el', 'la', 'los', 'las', 'que', 'por', 'con', 'una', 'del', 'para'];
            var spaHits = 0;
            for (var j = 0; j < words.length; j++) {
                if (spaWords.indexOf(words[j]) >= 0) spaHits++;
            }
            if (spaHits >= 3) return 'spa';

            var freWords = ['le', 'la', 'les', 'des', 'que', 'est', 'pas', 'une', 'vous', 'dans'];
            var freHits = 0;
            for (var k = 0; k < words.length; k++) {
                if (freWords.indexOf(words[k]) >= 0) freHits++;
            }
            if (freHits >= 3) return 'fre';

            var gerWords = ['der', 'die', 'das', 'und', 'ist', 'nicht', 'ich', 'ein', 'eine', 'sich'];
            var gerHits = 0;
            for (var m = 0; m < words.length; m++) {
                if (gerWords.indexOf(words[m]) >= 0) gerHits++;
            }
            if (gerHits >= 3) return 'ger';
        }

        return null;
    }

    function detectLanguageFromContent(url, callback) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 5000;
            xhr.setRequestHeader('Range', 'bytes=0-2000');

            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 400) {
                    callback(analyzeText((xhr.responseText || '').substring(0, 3000)));
                } else {
                    callback(null);
                }
            };
            xhr.onerror = function () { callback(null); };
            xhr.ontimeout = function () { callback(null); };
            xhr.send();
        } catch (e) {
            callback(null);
        }
    }

    // ========================
    // Selection Engine
    // ========================

    function selectBestAudioTrack(tracks, langCode) {
        var best = null;
        var bestScore = 0;

        for (var i = 0; i < tracks.length; i++) {
            var score = matchAudioTrack(tracks[i], langCode);
            if (score > bestScore) {
                bestScore = score;
                best = tracks[i];
            }
        }

        return best;
    }

    function selectBestSubtitle(subs, langCode, enableContentDetect, callback) {
        var best = null;
        var bestScore = 0;

        for (var i = 0; i < subs.length; i++) {
            var score = matchSubtitleByLabel(subs[i], langCode);
            if (score > bestScore) {
                bestScore = score;
                best = subs[i];
            }
        }

        if (best) {
            callback(best);
            return;
        }

        if (!enableContentDetect || subs.length === 0) {
            callback(null);
            return;
        }

        var pending = subs.length;
        var results = [];

        for (var j = 0; j < subs.length; j++) {
            (function (sub) {
                if (!sub.url) {
                    pending--;
                    if (pending === 0) finalize();
                    return;
                }

                detectLanguageFromContent(sub.url, function (detectedLang) {
                    if (detectedLang) {
                        results.push({ sub: sub, lang: detectedLang });
                    }
                    pending--;
                    if (pending === 0) finalize();
                });
            })(subs[j]);
        }

        function finalize() {
            var target = langCode;
            var altTarget = ISO_MAP[langCode] || '';

            for (var k = 0; k < results.length; k++) {
                if (results[k].lang === target || results[k].lang === altTarget) {
                    callback(results[k].sub);
                    return;
                }
            }
            callback(null);
        }
    }

    // ========================
    // Player Event Hooks
    // ========================

    var session = {
        active: false,
        tracksProcessed: false,
        subsProcessed: false
    };

    function initPlayerHooks() {
        Lampa.Player.listener.follow('start', function () {
            session.active = true;
            session.tracksProcessed = false;
            session.subsProcessed = false;
        });

        Lampa.Player.listener.follow('destroy', function () {
            session.active = false;
        });

        Lampa.PlayerVideo.listener.follow('tracks', function (e) {
            if (!session.active || session.tracksProcessed) return;
            if (!Lampa.Storage.get(STORAGE_KEYS.enabled, true)) return;

            var tracks = e.tracks || [];
            if (tracks.length <= 1) return;

            var langCode = Lampa.Storage.get(STORAGE_KEYS.audio_lang, 'eng');
            var best = selectBestAudioTrack(tracks, langCode);

            if (best && !best.selected) {
                tracks.forEach(function (t) { t.selected = false; });
                best.enabled = true;
                best.selected = true;
                console.log('AutoLang', 'audio track selected:', best.name || best.label || best.language);
            }

            session.tracksProcessed = true;
        });

        Lampa.PlayerVideo.listener.follow('subs', function (e) {
            if (!session.active || session.subsProcessed) return;
            if (!Lampa.Storage.get(STORAGE_KEYS.sub_enabled, true)) return;

            var subs = e.subs || [];
            if (subs.length === 0) return;

            var langCode = Lampa.Storage.get(STORAGE_KEYS.sub_lang, 'eng');
            var contentDetect = Lampa.Storage.get(STORAGE_KEYS.content_detect, true);

            selectBestSubtitle(subs, langCode, contentDetect, function (best) {
                if (!session.active || session.subsProcessed) return;

                if (best) {
                    subs.forEach(function (s) {
                        s.mode = 'disabled';
                        s.selected = false;
                    });
                    best.mode = 'showing';
                    best.selected = true;
                    console.log('AutoLang', 'subtitle selected:', best.label || best.url);
                }

                session.subsProcessed = true;
            });
        });
    }

    // ========================
    // Settings
    // ========================

    function initSettings() {
        Lampa.SettingsApi.addComponent({
            component: PLUGIN_NAME,
            name: 'Auto Language',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36" height="36"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>'
        });

        Lampa.SettingsApi.addParam({
            component: PLUGIN_NAME,
            param: {
                name: STORAGE_KEYS.enabled,
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Auto-select audio track',
                description: 'Automatically select preferred audio language on playback start'
            }
        });

        Lampa.SettingsApi.addParam({
            component: PLUGIN_NAME,
            param: {
                name: STORAGE_KEYS.audio_lang,
                type: 'select',
                values: LANGUAGES,
                default: 'eng'
            },
            field: {
                name: 'Audio language',
                description: 'Preferred audio track language'
            }
        });

        Lampa.SettingsApi.addParam({
            component: PLUGIN_NAME,
            param: {
                name: STORAGE_KEYS.sub_enabled,
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Auto-select subtitles',
                description: 'Automatically enable subtitles in preferred language'
            }
        });

        Lampa.SettingsApi.addParam({
            component: PLUGIN_NAME,
            param: {
                name: STORAGE_KEYS.sub_lang,
                type: 'select',
                values: LANGUAGES,
                default: 'eng'
            },
            field: {
                name: 'Subtitle language',
                description: 'Preferred subtitle language'
            }
        });

        Lampa.SettingsApi.addParam({
            component: PLUGIN_NAME,
            param: {
                name: STORAGE_KEYS.content_detect,
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Detect language by content',
                description: 'Analyze subtitle file content when label has no language info (for torrent sources)'
            }
        });
    }

    // ========================
    // Initialization
    // ========================

    function startPlugin() {
        initSettings();
        initPlayerHooks();
        console.log('AutoLang', 'plugin v1.0 loaded');
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') startPlugin();
        });
    }
})();
